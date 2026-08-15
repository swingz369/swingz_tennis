import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { signHardDeleteToken } from '@/lib/security/hard-delete-token';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { AuditServiceImpl } from '@/infrastructure/audit/audit.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:[id]:hard-delete-token');
// Module-scope singleton safe: `AuditServiceImpl` stateless except for shared DB pool. Switch to per-request getter if it ever grows mutable state.
const auditService = new AuditServiceImpl();

/**
 * POST /api/clubs/[id]/hard-delete-token
 *
 * Issues a short-lived HMAC token authorizing ONE hard-delete of the given
 * club. Consumed by `DELETE /api/clubs/[id]?hard=true`. Token is scoped to
 * `${userId}:${clubId}:${ts}` so:
 *
 *   - Tokens for Club A cannot be reused against Club B (even by the same actor).
 *   - Tokens expire after 5 minutes (HARDC_DELETE_TOKEN_TTL_MS).
 *   - HMAC verification uses constant-time comparison.
 *
 * Auth gate: `verifyRole('superadmin')`. Owner bypasses via role hierarchy
 * (owner > superadmin). verifyClubAccess scopes a superadmin to clubs they
 * actually administer — Owner is exempted (platform staff, sees all).
 *
 * The matching verify-side helper lives in
 * `lib/security/hard-delete-token.ts` and is invoked from
 * `app/api/clubs/[id]/route.ts` DELETE.
 *
 * ─── Why POST (not GET)?
 * Tokens are sensitive: never put them in URL fragments, browser address
 * bars, or referrer headers. POST with the token as an outbound
 * `X-Hard-Delete-Token` header keeps the token off the URL and out of the
 * server access log.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'superadmin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Superadmins');
    }

    // Rate-limit matches the surrounding DELETE route (RATE_LIMITS.STANDARD)
    // — token-issue is rare in normal flows and the standard bucket throttles
    // any automation that tries to brute-flood tokens to compensate for the
    // short TTL. Audit logs the issuance itself for the OWNER/SECURITY trail.
    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    if (!verifyClubAccess(auth, id)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const issued = signHardDeleteToken(auth.user.id, id);

      // Audit the issuance itself — gives the OWNER/SECURITY trail a record
      // of "who asked, when, and for which club" without needing the actual
      // token (which is short-lived anyway and never persisted).
      try {
        await auditService.log({
          userId: auth.user.id,
          action: 'update', // 'token_issued' isn't a core action; semantically it's a configuration-change audit
          entityType: 'club',
          entityId: id,
          clubId: id,
          details: {
            event: 'hard_delete_token_issued',
            ttl_seconds: issued.ttlSeconds,
            expires_at: new Date(issued.expiresAt).toISOString(),
            actor_role: auth.role,
          },
        });
      } catch (auditError) {
        // Audit failure MUST NOT block token issuance — the user is going to
        // perform a destructive operation, which itself logs in detail.
        // We log the warning here so the SRE team notices if audit is broken.
        log.warn('Audit log failed for hard-delete-token issuance:', auditError);
      }

      return NextResponse.json({
        token: issued.token,
        expiresAt: issued.expiresAt,
        ttlSeconds: issued.ttlSeconds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error issuing hard-delete token:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
