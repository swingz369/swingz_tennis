/**
 * ════════════════════════════════════════════════════════════════════════════════
 * app/api/clubs/[id]/hardware-vendor/route.ts — Q3 ticket 3.1.3 API
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Endpoint
 *   PUT /api/clubs/[id]/hardware-vendor — Set the club-level hardware-vendor
 *
 * Body
 *   { hardware_vendor: 'nuki' | 'shelly' | 'loxone' }
 *
 * Auth + Role-Gate
 *   withApiAuth + verifyRole(auth, 'admin') + club-scoped check (auth.clubId === id)
 *
 * Persistenz
 *   Shallow-JSONB-Merge in clubs.features (mirror lib/services/tier-features-sync.ts
 *   Pattern) — andere `features`-Keys bleiben unverändert.
 *
 * ADR-002 Forensic-Policy
 *   - Kein throw auf User-Facing-Error; explizite status-Codes mit detail-Message
 *   - audit_logs-Insert: action='hardware_vendor_update' mit previous/new-Snapshot
 *   - Audit-Insert-Fail → log.warn + continue (verhindert Datenverlust bei
 *     transientem audit-table-Issue)
 *
 * Idempotency
 *   Bei previous === new → unchanged=true Response, kein Update, kein Audit-Log
 *   (saves roundtrip + reduces audit-table-noise)
 *
 * Missing-Env-Detection
 *   Service-side-detect: process.env[HARDWARE_ENV_VARS[vendor]]-Presence → missing_env-Flag
 *   in Response. Frontend zeigt Warning-Toast.
 *
 * Rate-Limit
 *   RATE_LIMITS.STANDARD (analog app/api/clubs/[id]/route.ts)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { HARDWARE_ENV_VARS, HARDWARE_VENDORS, HardwareVendor } from '@/lib/hardware/adapter';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:[id]:hardware-vendor');

// ─── Zod-Validation (Q5 + Q8) ────────────────────────────────────────────────
// HARDWARE_VENDORS ist die Single-Source-of-Truth (const-array in lib/hardware/adapter):
// Neue Vendors werden einmal dort hinzugefügt → route.ts übernimmt die Z.enum-Validation
// automatisch via Runtime-Array-Iteration. TypeScript prüft via `satisfies readonly HardwareVendor[]`.
const HardwareVendorEnum = z.enum(HARDWARE_VENDORS);
const BodySchema = z.object({
  hardware_vendor: HardwareVendorEnum,
});

type HardwareVendorType = z.infer<typeof HardwareVendorEnum>;

// ─── PUT-Handler ─────────────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withApiAuth(req, async (auth) => {
    // 1. Role-Gate
    if (!(await verifyRole(auth, 'admin'))) {
      return forbiddenResponse('Admin access required');
    }

    // 2. Rate-Limit
    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    // 3. Club-Scope-Check (admin darf nur eigenen Club modifizieren)
    const { id: clubIdParam } = await params;
    if (!auth.clubId || auth.clubId !== clubIdParam) {
      return forbiddenResponse('Cannot modify other clubs');
    }

    // 4. Body-Parse + Zod-Validation
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid hardware_vendor',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const newVendor: HardwareVendorType = parsed.data.hardware_vendor;

    // 5. Service-Client (RLS-bypass für Audit + Update — auth-layer = HMAC-Gate)
    const serviceSb = createServiceClient();

    // 6. Read-Before (für previous/new-Snapshot in Audit-Log)
    const { data: beforeClub, error: beforeErr } = await serviceSb
      .from('clubs')
      .select('features')
      .eq('id', clubIdParam)
      .maybeSingle();

    if (beforeErr) {
      log.error('Failed to read club features (before-update)', {
        club_id: clubIdParam,
        error: beforeErr.message,
      });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const existingFeatures = (beforeClub?.features ?? {}) as Record<string, unknown>;
    const previousVendorRaw = existingFeatures.hardware_vendor;
    const previousVendor: HardwareVendor | null =
      previousVendorRaw === 'nuki' ||
      previousVendorRaw === 'shelly' ||
      previousVendorRaw === 'loxone'
        ? previousVendorRaw
        : null;

    // 7. Idempotency-Check (kein Update wenn Wert bereits korrekt)
    if (previousVendor === newVendor) {
      return NextResponse.json({
        success: true,
        previous_vendor: previousVendor,
        new_vendor: newVendor,
        unchanged: true,
        missing_env: !process.env[HARDWARE_ENV_VARS[newVendor]],
      });
    }

    // 8. Shallow-JSONB-Merge + Update
    const updatedFeatures = { ...existingFeatures, hardware_vendor: newVendor };
    const { error: updateErr } = await serviceSb
      .from('clubs')
      .update({
        features: updatedFeatures,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clubIdParam);

    if (updateErr) {
      log.error('Failed to update club features', {
        club_id: clubIdParam,
        error: updateErr.message,
      });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // 9. ADR-002 Audit-Log (Q9 + Q10: action + previous/new snapshot + actor)
    //    audit_logs schema (src/infrastructure/persistence/schema.ts):
    //      actor_id UUID NOT NULL, action VARCHAR(50), resource_type VARCHAR(50),
    //      resource_id UUID, details JSONB DEFAULT '{}', created_at TIMESTAMP
    const { error: auditErr } = await serviceSb.from('audit_logs').insert({
      action: 'hardware_vendor_update',
      resource_type: 'club',
      resource_id: clubIdParam,
      actor_id: auth.user.id,
      details: {
        club_id: clubIdParam,
        previous_vendor: previousVendor,
        new_vendor: newVendor,
      },
    });
    if (auditErr) {
      // Don't fail the request — hardware_vendor update is already committed.
      // Manual reconciliation possible via audit-table-event-replay.
      log.warn('audit_logs insert failed (continuing)', {
        club_id: clubIdParam,
        error: auditErr.message,
      });
    }

    // 10. Missing-Env-Detection (UX-Hint)
    const envVarName = HARDWARE_ENV_VARS[newVendor];
    const missingEnv = !process.env[envVarName];

    log.info('hardware_vendor updated', {
      club_id: clubIdParam,
      actor_id: auth.user.id,
      previous: previousVendor,
      new: newVendor,
      missing_env: missingEnv,
    });

    return NextResponse.json({
      success: true,
      previous_vendor: previousVendor,
      new_vendor: newVendor,
      unchanged: false,
      missing_env: missingEnv,
    });
  });
}
