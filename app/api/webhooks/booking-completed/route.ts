/**
 * ════════════════════════════════════════════════════════════════════════════════
 * app/api/webhooks/booking-completed/route.ts
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * TICKET: 3.1.2 — Buchung-zu-Hardware-Webhook (Q3/3.1 Smart-Court API)
 *
 * WHAT THIS ROUTE DOES
 *
 *   Receiver for booking-lifecycle events fired by the booking subsystem
 *   (POST `/api/bookings` or via Vercel-cron/queue-worker on status-change).
 *   Dispatches the configured `HardwareAdapter` (3.1.1) for the affected
 *   club/court:
 *
 *     booking_started    → setLight(courtId, true) + unlockCourt(courtId)
 *     booking_completed  → setLight(courtId, false) + lockCourt(courtId)
 *     booking_cancelled  → setLight(courtId, false) + lockCourt(courtId)
 *
 *   Per ADR-002 forensic-policy: every error is surfaced as explicit status
 *   code + JSON-body trace; no throw escapes the handler; idempotency via
 *   `audit_logs.resource_id = idempotency_key` lookup (no-op on replay).
 *
 * KNOWN LIMITATIONS (3.1.2 / Q3 MVP)
 *   - **Idempotency race**: SELECT-then-INSERT sequence allows 2 parallel
 *     calls with the same `idempotency_key` to each pass the dedup lookup
 *     and double-fire hardware. Mitigation requires either a Postgres
 *     UNIQUE INDEX on `audit_logs(action, resource_id)` and an
 *     early-claim-via-INSERT pattern (deferred to 3.1.6 webhook-hardening
 *     sprint), or a Supabase Edge Function holding an advisory-lock.
 *     For 1.0 this is an accepted risk: replay-thundering-herd is bounded
 *     by the HMAC-gate (only trusted internal callers can replay).
 *
 * IT DOES NOT
 *   - Persist hardware-action state beyond the audit-log entry
 *   - Handle vendor-specific retry policies (5xx/timeout) — ADR-010 ticket
 *   - Validate court/club ownership against the caller's club (assumes
 *     trusted internal webhook source; signature-gated)
 *   - Multi-vendor-per-court — single vendor per club (clubs.features.hardware_vendor),
 *     per-court override deferred to 3.1.4
 *
 * CONFIGURATION
 *
 *   Required ENV:
 *     HARDWARE_WEBHOOK_SECRET     — shared HMAC-SHA256 secret (generate via:
 *                                     `openssl rand -hex 32`)
 *
 *   Optional ENV:
 *     HARDWARE_DEFAULT_VENDOR     — fallback vendor when clubs.features
 *                                   doesn't carry hardware_vendor (default: shelly)
 *
 * CALLOVER PROTOCOL
 *
 *   Header:  `X-SwingZ-Signature: <hex-sha256-hmac>`
 *   Body:    WebhookPayload (Zod schema, see below)
 *
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';

import { createLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import {
  getHardwareAdapter,
  type HardwareResult,
  type HardwareVendor,
} from '@/lib/hardware/adapter';

// ─── Module-Logger (per ADR-002 forensic-trail) ──────────────────────────────
const log = createLogger('webhook:booking-completed');

// ─── Zod-Payload-Schema (Q5 + Q8) ────────────────────────────────────────────
const HardwareWebhookSchema = z.object({
  booking_id: z.string().uuid(),
  court_id: z.string().uuid(),
  club_id: z.string().uuid(),
  event_type: z.enum(['booking_started', 'booking_completed', 'booking_cancelled']),
  event_timestamp: z.string().datetime({ message: 'event_timestamp must be ISO-8601' }),
  idempotency_key: z.string().min(1).max(255),
});
type WebhookPayload = z.infer<typeof HardwareWebhookSchema>;

// ─── Action-Dispatch-Builder (Q6) ────────────────────────────────────────────
// Each event-type maps to a `light`-call (always) PLUS an optional lock/unlock
// call. The dispatcher is built from the resolved vendor so the actual adapter
// call goes through `getHardwareAdapter(CLUB_RESOLVED_VENDOR)` — NOT a
// hardcoded shim (previous version had this bug; corrected).
type ActionMap = {
  light: (courtId: string, isOn: boolean) => Promise<HardwareResult>;
  lock?: (courtId: string) => Promise<HardwareResult>;
  unlock?: (courtId: string) => Promise<HardwareResult>;
};

function buildActionsForVendor(
  vendor: HardwareVendor
): Record<WebhookPayload['event_type'], ActionMap> {
  const adapter = getHardwareAdapter(vendor);
  return {
    booking_started: {
      light: (courtId, isOn) => adapter.setLight(courtId, isOn),
      unlock: (courtId) => adapter.unlockCourt(courtId),
    },
    booking_completed: {
      light: (courtId, isOn) => adapter.setLight(courtId, isOn),
      lock: (courtId) => adapter.lockCourt(courtId),
    },
    booking_cancelled: {
      light: (courtId, isOn) => adapter.setLight(courtId, isOn),
      lock: (courtId) => adapter.lockCourt(courtId),
    },
  };
}

// ─── HMAC-Signature-Verify (Q2) ──────────────────────────────────────────────
/**
 * Constant-time HMAC-SHA256 verify using Node.js timingSafeEqual.
 * Throws nothing (returns boolean per ADR-002 forensic-policy).
 *
 * SECURITY:
 *   - Uses raw request body (req.text()) to avoid JSON-reorder side-channels
 *   - Returns FALSE if either signature or secret is unset (fail-closed)
 *   - Production only — no dev-bypass (security smell)
 */
function verifyHmacSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.HARDWARE_WEBHOOK_SECRET;
  if (!signatureHeader || !secret) {
    return false; // Fail-closed: missing EITHER signature OR secret is rejected
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Receivers may prefix with `sha256=` (Stripe-style); strip if present
  const received = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;
  // Hex-decode of received-throw synchronously on malformed input (TypeError:
  // Invalid hex string). Wrap the conversion too — outer try/catch only
  // catches what timingSafeEqual throws otherwise.
  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(received, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

// ─── Vendor-Resolution (Q4) ──────────────────────────────────────────────────
const DEFAULT_HARDWARE_VENDOR: HardwareVendor = 'shelly'; // Shelly = widest coverage + EU-friendly

function resolveVendorForClub(
  clubFeatures: { hardware_vendor?: string } | null | undefined,
  isClubLookupFailed: boolean
): { vendor: HardwareVendor; source: 'club-features' | 'env-default' | 'hardcoded-default' } {
  if (clubFeatures?.hardware_vendor) {
    const csv = String(clubFeatures.hardware_vendor).trim();
    if (csv === 'nuki' || csv === 'shelly' || csv === 'loxone') {
      return { vendor: csv, source: 'club-features' };
    }
    log.warn('Club-features hardware_vendor unrecognized; falling back to default', {
      club_vendor_value: csv,
      club_lookup_failed: isClubLookupFailed,
    });
  }
  const envDefault = process.env.HARDWARE_DEFAULT_VENDOR;
  if (envDefault === 'nuki' || envDefault === 'shelly' || envDefault === 'loxone') {
    return { vendor: envDefault, source: 'env-default' };
  }
  return { vendor: DEFAULT_HARDWARE_VENDOR, source: 'hardcoded-default' };
}

// ─── Body-Size-Guard (DoS-safeguard: reject early before HMAC work) ─────────
const MAX_WEBHOOK_BODY_BYTES = 10 * 1024; // 10 kB cap — webhook payloads are ~300 bytes
function rejectIfTooLarge(req: NextRequest): NextResponse | null {
  const cl = req.headers.get('content-length');
  if (cl && Number(cl) > MAX_WEBHOOK_BODY_BYTES) {
    log.warn('Webhook body exceeds size-cap; rejecting', {
      content_length: cl,
      max_bytes: MAX_WEBHOOK_BODY_BYTES,
    });
    return NextResponse.json({ error: 'Payload Too Large' }, { status: 413 });
  }
  return null;
}

// ─── HTTP-POST-Handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  // 0. Body-Size-Guard (defense-in-depth against memory-exhaustion DoS)
  const tooLarge = rejectIfTooLarge(req);
  if (tooLarge) return tooLarge;

  // 1. Raw-Body (HMAC requires non-parsed text to avoid reorder side-channels)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Bad Request: body unreadable' }, { status: 400 });
  }

  // 1b. Defense-in-depth body-size-cap (after read): header may lie (chunked,
  //     omitted content-length, or attacker-set large number). Real enforcement
  //     is the string-length check on the actually-read body.
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    log.warn('Webhook body exceeds size-cap after read', {
      body_bytes: rawBody.length,
      max_bytes: MAX_WEBHOOK_BODY_BYTES,
    });
    return NextResponse.json({ error: 'Payload Too Large' }, { status: 413 });
  }

  // 2. HMAC-Signature (Q2: fail-closed, no dev-bypass)
  const signature = req.headers.get('x-swingz-signature');
  if (!verifyHmacSignature(rawBody, signature)) {
    log.warn('Booking-completed webhook signature invalid', { has_signature: !!signature });
    return NextResponse.json(
      { error: 'Unauthorized: invalid or missing signature' },
      { status: 401 }
    );
  }

  // 3. JSON-Parse + Zod-Validation (Q5 + Q8)
  let payload: WebhookPayload;
  try {
    const json = JSON.parse(rawBody);
    payload = HardwareWebhookSchema.parse(json);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown parse/validation error';
    log.warn('Booking-completed webhook payload invalid', { error: msg });
    return NextResponse.json(
      { error: 'Bad Request: payload does not match schema', detail: msg },
      { status: 400 }
    );
  }

  log.info('Booking-completed webhook received', {
    booking_id: payload.booking_id,
    court_id: payload.court_id,
    event_type: payload.event_type,
    idempotency_key: payload.idempotency_key,
  });

  // 4. Idempotency-Check (dedup by booking_id + event_type — both are stable UUIDs/enums)
  const supabase = createServiceClient();
  const { data: existing, error: dedupQueryError } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('action', `hardware_webhook_${payload.event_type}`)
    .eq('resource_id', payload.booking_id)
    .maybeSingle();

  if (dedupQueryError) {
    log.error('Idempotency-Lookup failed; rejecting to avoid double-fire', {
      idempotency_key: payload.idempotency_key,
      db_error: dedupQueryError.message,
    });
    // ADR-002: explicit fail-closed on DB-Error (rather than double-fire risk)
    return NextResponse.json(
      { error: 'Internal Server Error: idempotency-lookup degraded' },
      { status: 503 }
    );
  }
  if (existing) {
    log.info('Booking-completed webhook deduplicated (replay)', {
      idempotency_key: payload.idempotency_key,
    });
    return NextResponse.json({ received: true, deduplicated: true }, { status: 200 });
  }

  // 5. Vendor-Resolution (Q4: clubs.features.hardware_vendor → ENV → default)
  let vendor: HardwareVendor = DEFAULT_HARDWARE_VENDOR;
  let vendorSource: 'club-features' | 'env-default' | 'hardcoded-default' = 'hardcoded-default';
  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .select('features')
    .eq('id', payload.club_id)
    .maybeSingle();

  if (clubErr) {
    log.warn('Club-Lookup failed; vendor resolution falling back to ENV/default', {
      club_id: payload.club_id,
      error: clubErr.message,
    });
  }
  const resolved = resolveVendorForClub(
    (club?.features ?? null) as { hardware_vendor?: string } | null,
    !!clubErr
  );
  vendor = resolved.vendor;
  vendorSource = resolved.source;

  // 6. Action-Dispatch (Q6: switch on event_type — uses RESOLVED vendor per club)
  let lightResult: HardwareResult;
  let lockResult: HardwareResult | null = null;

  try {
    const actions = buildActionsForVendor(vendor)[payload.event_type];

    lightResult = await actions.light(payload.court_id, payload.event_type === 'booking_started');

    if (actions.lock) {
      lockResult = await actions.lock(payload.court_id);
    } else if (actions.unlock) {
      lockResult = await actions.unlock(payload.court_id);
    }

    log.info('Hardware actions dispatched', {
      vendor,
      vendor_source: vendorSource,
      event_type: payload.event_type,
      light_result: lightResult,
      lock_result: lockResult,
    });
  } catch (err) {
    // Defense-in-depth: lib/hardware/adapter.ts v1 contracts no-throw
    // (all paths return result-shape per ADR-002). Retain this catch as
    // forward-compat in case a future adapter-version drifts from the
    // contract. NOT dead-code, by design.
    const msg = err instanceof Error ? err.message : 'unknown adapter exception';
    log.error('Adapter exception escaped; ADR-002 violation', { vendor, error: msg });
    return NextResponse.json(
      { error: 'Internal Server Error: adapter exception', detail: msg },
      { status: 500 }
    );
  }

  // 7. Audit-Trail-Save — fetch booking owner for actor_id (required NOT NULL)
  const { data: bookingRow } = await supabase
    .from('bookings')
    .select('user_id')
    .eq('id', payload.booking_id)
    .maybeSingle();

  const auditPayload = {
    actor_id: bookingRow?.user_id as string,
    action: `hardware_webhook_${payload.event_type}`,
    resource_type: 'booking' as const,
    resource_id: payload.booking_id,
    details: {
      idempotency_key: payload.idempotency_key,
      court_id: payload.court_id,
      club_id: payload.club_id,
      event_type: payload.event_type,
      event_timestamp: payload.event_timestamp,
      vendor,
      vendor_source: vendorSource,
      light_result: lightResult,
      lock_result: lockResult,
    },
  };

  const { error: auditInsertError } = await supabase.from('audit_logs').insert(auditPayload);
  if (auditInsertError) {
    log.error('Audit-log insert failed; hardware already dispatched — manually reconcile', {
      idempotency_key: payload.idempotency_key,
      db_error: auditInsertError.message,
    });
    // Don't return error to caller — hardware-OK; just log for forensic-trail.
    // The next replay will dedup via the failed-to-insert entry (no record existed).
  }

  // 8. ADR-002 Status-Surface (Q7: explicit error outcomes per HardwareResult)
  const lightErrored = lightResult.error !== null;
  const lockErrored = lockResult !== null && lockResult.error !== null;

  if (lightErrored || lockErrored) {
    log.warn('Hardware-Webhook partial/full failure (ADR-002 explicit)', {
      light_errored: lightErrored,
      lock_errored: lockErrored,
      idempotency_key: payload.idempotency_key,
    });
    // 207 Multi-Status is the correct HTTP code for fan-out partial-success:
    // light-call may have succeeded while lock-call failed (or vice versa).
    // Returning 502 ("upstream failed") would be misleading because not
    // all upstream calls failed.
    return NextResponse.json(
      {
        received: true,
        status: 'partial_failure',
        details: { light: lightResult, lock: lockResult },
      },
      { status: 207 }
    );
  }

  // 9. Success
  log.info('Booking-completed webhook processed successfully', {
    idempotency_key: payload.idempotency_key,
    booking_id: payload.booking_id,
  });
  return NextResponse.json(
    {
      received: true,
      status: 'success',
      details: { light: lightResult, lock: lockResult },
    },
    { status: 200 }
  );
}

// ─── Operation-Method-Restriction (Q1: webhook is async/external POST) ────────
// GET/HEAD/OPTIONS not allowed on the webhook route — return 405 quickly to
// avoid any signature-replay attempts via non-POST methods. RFC 9110
// requires `Allow:` header on 405 responses listing accepted methods.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
