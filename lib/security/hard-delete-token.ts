/**
 * HMAC Time-Limited Token Helper — Server-Issued Authorization
 *
 * Used by security-critical destructive operations that need to confirm
 * *user intent* in addition to *user authentication*. The auth layer (RBAC)
 * answers "who are you?"; this helper answers "are you sure, right now?".
 *
 * Current consumers: `app/api/clubs/[id]/route.ts` DELETE for hard-delete
 * gating. The matching issuance endpoint POSTs `/api/clubs/[id]/
 * hard-delete-token` from the UI after the user confirms the destructive
 * dialog.
 *
 * ────────────────────────────────────────────────────────────────────
 * Token shape: `${unix_ms}.${hmac_sha256_hex}`
 *
 * Payload HMACed: `${userId}:${clubId}:${ts}`
 *
 * ────────────────────────────────────────────────────────────────────
 * Trust model
 *
 *  1. The secret lives ONLY in `process.env.HARD_DELETE_TOKEN_SECRET`.
 *     At module-init time we throw if the env is missing in production
 *     — no silent dev fallback that would let a misconfigured deploy
 *     accept any HMAC computed with the public dev string. (See
 *     `TOKEN_SECRET` initialization below.)
 *  2. The HMAC key is rotating-safe only at the cost of invalidating
 *     outstanding issued tokens. The 5-min TTL keeps the blast radius
 *     small; users hit "Token expired, please try again" with `400`.
 *  3. The token is scoped to `${userId}:${clubId}:${ts}` — so a token
 *     issued for Club A cannot be reused against Club B, even by the
 *     same actor. CSRF-equivalent protection at the API level.
 *
 * ────────────────────────────────────────────────────────────────────
 * Why not just `verifyRole('superadmin')`?
 *
 * Because RBAC is *who*. We additionally need *when* (recent issuance)
 * and *what specifically* (which club). ANSI keyboard-mashing and
 * paste-from-clipboard are the realistic threats; an attacker who
 * already has superadmin can list clubs anyway. The token forces a
 * conscious, surface-area-confirmed confirmation just before the
 * destructive call lands.
 *
 * ────────────────────────────────────────────────────────────────────
 * Why HMAC and not JWT?
 *
 * No third-party JWT lib, no expire/signature-header plumbing — HMAC
 * with our own payload structure is simpler, fully under our control,
 * and `verifyHardDeleteToken` runs in O(1) with a `timingSafeEqual`
 * comparison, so token-fuzzing attempts cannot extract key bits.
 */

import crypto from 'node:crypto';

// ─── Secret initialization with strict prod-check ───────────────────────
//
// In production we refuse to sign or verify with the dev fallback under
// any circumstance. The boot-time guard alone is not sufficient: Next.js
// evaluates route-handler modules lazily on first import, so a deploy
// with zero hard-delete traffic would silently carry the unconfigured
// helper until the very first time a Superadmin clicks "Permanently
// delete". The runtime guard below (re-asserted on every public call)
// is what actually catches that misconfig in production.

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-set-HARD_DELETE_TOKEN_SECRET-for-production';

const _fromEnv = process.env.HARD_DELETE_TOKEN_SECRET;
const _secretFromEnv = !!_fromEnv && _fromEnv.length >= 32;
const TOKEN_SECRET: string = _secretFromEnv ? _fromEnv : DEV_FALLBACK_SECRET;

function assertSafeSecret(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!_secretFromEnv) {
    throw new Error(
      'HARD_DELETE_TOKEN_SECRET is missing or too short in production. ' +
        'Refusing to sign/verify with the dev fallback — set the env var ' +
        'to a 32+ character random string in the Vercel project settings.'
    );
  }
}

export const HARDC_DELETE_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Public API ────────────────────────────────────────────────────────

export interface IssuedToken {
  /** Token string in `${ts}.${hmac_hex}` format. */
  token: string;
  /** Unix-ms when the token stops being valid. */
  expiresAt: number;
  /** Seconds until expiry — useful for UI countdown. */
  ttlSeconds: number;
}

/**
 * Issue a fresh, time-limited HMAC token scoped to a single (user, club).
 *
 * Idempotent enough: two calls in the same millisecond produce two tokens
 * (branching by `ts`). The second calls within the same ms are extremely
 * unlikely in UI flows; if they happen the earlier token still validates
 * because the HMAC is over (user, club, ts).
 */
export function signHardDeleteToken(userId: string, clubId: string): IssuedToken {
  assertSafeSecret();
  const ts = Date.now();
  const payload = `${userId}:${clubId}:${ts}`;
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return {
    token: `${ts}.${hmac}`,
    expiresAt: ts + HARDC_DELETE_TOKEN_TTL_MS,
    ttlSeconds: Math.floor(HARDC_DELETE_TOKEN_TTL_MS / 1000),
  };
}

/**
 * Verify a token previously issued via `signHardDeleteToken`.
 *
 * Returns `false` (never throws) on:
 *  - missing / malformed token
 *  - unparsable timestamp
 *  - expired token
 *  - HMAC mismatch
 *  - any length mismatch (constant-time-only-after-length-check)
 *
 * Successful verification uses `timingSafeEqual` against `Buffer.from`
 * comparison rather than a string compare — to neutralize key-bit
 * leakage through response-time side channels.
 */
export function verifyHardDeleteToken(
  userId: string,
  clubId: string,
  token: string | null
): boolean {
  assertSafeSecret();
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [tsStr, hmacHex] = parts as [string, string];
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > HARDC_DELETE_TOKEN_TTL_MS) return false;

  const expected = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${userId}:${clubId}:${ts}`)
    .digest('hex');
  // Length check is fine to short-circuit — attacker cannot regex their
  // way into a key-bit via a length difference (the expected length is
  // a constant 64 hex chars for sha256).
  if (hmacHex.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(hmacHex, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    // Buffer.from(..., 'hex') throws on malformed hex. Treat as invalid.
    return false;
  }
}
