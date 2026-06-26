/**
 * AnonymizeService — Drizzle/Postgres-js based PII-anonymization service.
 *
 * Ticket: Q1.Epic F6 / F6.1 — Anonymize-Service skelettieren.
 *
 * Replaces/supplements the older Supabase-js-based flow
 * (`lib/dsgvo/anonymize-flow.ts`) with the codebase-mandated Drizzle
 * persistence path. Mirrors the same DSGVO Art. 17 + § 147 AO balancing
 * (anonymize PII + preserve GoBD financial records) but writes through
 * the shared `db` client so it composes with the rest of the service
 * layer (transactions, audit logs, query ctx, etc.).
 *
 * ## Audit-first design
 *
 * 1. Idempotency: An existing audit row with `action='DSGVO_DELETE' &&
 *    resource_id=userId` short-circuits the call as a no-op success
 *    (returns the SAME pseudonyms as the original run, so retries
 *    produce a stable, deterministic result). The original flow uses
 *    `users.pseudonymized_at IS NOT NULL` as a sentinel; we cannot rely
 *    on that column today (the migration is queued but not applied on
 *    this branch), so we use the audit-log row as the durable sentinel
 *    — equivalent semantics for retry safety, zero-migration coupling.
 *
 * 2. Intent-before-mutation: An "intent" audit log (`DSGVO_DELETE_INTENT`)
 *    is written BEFORE the user-row wipe. If the wipe step crashes, the
 *    intent log is already on the bookshelf and a retry can pick up
 *    where it left off. This trades off rollback safety for forensic
 *    completeness — the trade-off is intentional and matches the
 *    existing `lib/dsgvo/anonymize-flow.runDsgvoDeleteFlow` design.
 *
 * 3. Chunked writes (no `db.transaction`): Sequential `UPDATE users`,
 *    `UPDATE user_club_memberships`, `INSERT audit_logs`. Each step is
 *    idempotent (the second run is a no-op via step 1's check), so a
 *    crash mid-way can be re-run safely. We deliberately don't wrap
 *    the whole sequence in a single Postgres transaction because that
 *    would erase the intent audit log if a downstream step failed.
 *
 * 4. Invoices preserved by reference: `invoices.member_id` is NEVER
 *    modified; the user-row's PII is wiped, but the FK remains so the
 *    GoBD chain stays queryable. This is the trade-off that requires
 *    the PII-mapping doc's clarification that the "member_id" of an
 *    anonymized invoice points to a "deleted user" tombstone — auditor
 *    queries must JOIN via the pseudonym on the user side, not the
 *    raw full_name.
 *
 * ## Migration dependencies
 *
 * No-blocker: this file does NOT depend on a `users.pseudonymized_at`
 * column. The migration (`2026xxxx_anon_users.sql` in the PII-mapping
 * roadmap) is queued but not required for this skeleton — the audit-log
 * row is the durable idempotency sentinel.
 *
 * Out-of-scope here:
 *   - Hard-delete of `trainer_member_notes` (F6.5 follow-up —
 *     trainer notes are sensitive PII, not GoBD-locked).
 *   - Supabase-Auth deletion (caller orchestrates — same as the
 *     existing flow which calls `deleteSupabaseAuthUser` from the
 *     caller).
 *   - Cascading anonymization of related tables (bookings, RSVPs,
 *     notifications, audit_logs.actor_id snapshots) — each is a
 *     separate ticket (F6.5..F6.7).
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/src/infrastructure/persistence/db';
import { users, userClubMemberships, auditLogs } from '@/src/infrastructure/persistence/schema';
import { hashIdentifier } from '@/lib/dsgvo/anonymize';

// ═══════════════════════════════════════════════
// PII mapping (kept in one place — easy to audit)
// ═══════════════════════════════════════════════

/**
 * Columns on `users` that MUST be wiped on anonymization (DSGVO Art. 4
 * Nr. 1 Direct PII). The set is narrow on purpose — only columns that
 * are guaranteed-present in the live schema are wiped today. Keep this
 * list small + explicit, not "everything that looks PII-ish".
 *
 * Per `docs/dsgvo-pii-mapping.md` §2 PII-Klassifikation:
 *   (A) Direct PII → wipe to NULL/placeholder
 *   (B) Indirect PII → preserve (audit-trail continuity)
 */
const WIPE_USER_COLUMNS = {
  email: (id: string) => `deleted-${id}@deleted.invalid`,
  full_name: () => 'Gelöschter Nutzer' as const,
  phone: () => null as string | null,
  avatar_url: () => null as string | null,
} as const;

/** Audit-action codes — mirror the existing `lib/dsgvo/anonymize-flow.ts`. */
const AUDIT_ACTION_INTENT = 'DSGVO_DELETE_INTENT';
const AUDIT_ACTION_FINALIZE = 'DSGVO_DELETE';

/** JSON details shape written to `audit_logs.details`. `schema_version` is
 * the durable compatibility sentinel — bump only on shape change. */
const AUDIT_SCHEMA_VERSION = 2;

// ═══════════════════════════════════════════════
// Result type (discriminated union — match codebase convention)
// ═══════════════════════════════════════════════

export interface AnonymizeSuccess {
  ok: true;
  /** The user that was anonymized (matches `users.id`). */
  userId: string;
  /** Deterministic placeholder email — stable across re-runs. */
  pseudonymEmail: string;
  /** Deterministic opaque pseudonym key (`hashIdentifier`-derived). */
  pseudonymKey: string;
  /** Number of `user_club_memberships` rows soft-deactivated. */
  membershipsDeactivated: number;
  /** Wall-clock duration of the call, useful for ops dashboards. */
  durationMs: number;
  /**
   * Was this call a no-op (user was already anonymized in a prior run)?
   * Lets callers distinguish a fresh wipe from an idempotent retry.
   */
  idempotent: boolean;
}

export interface AnonymizeError {
  ok: false;
  error: string;
  code: 'user_not_found' | 'invalid_user_id' | 'internal';
}

export type AnonymizeResult = AnonymizeSuccess | AnonymizeError;

export interface AnonymizeOptions {
  /** Audit-log context — propagated into both intent + finalize logs. */
  ipAddress?: string | null;
  userAgent?: string | null;
  /**
   * Origin marker persisted in the audit `details.triggered_by` field.
   * Distinguishes user-driven self-service deletes from admin-driven
   * (e.g. "data subject request" forwarded by DPO) deletes.
   * Defaults to "self_service".
   */
  triggeredBy?: 'self_service' | 'admin' | 'data_subject_request';
}

// ═══════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════

export interface AnonymizeAuditDetailsV2 {
  /** Schema version for forward-compat migrations. */
  schema_version: 2;
  /** Pipeline stage: "intent" before the wipe, "finalize" after. */
  step: 'intent' | 'finalize';
  /** Stable email used as the anonymized placeholder. */
  pseudonymEmail: string;
  /** Stable opaque pseudonym key (hashIdentifier-derived). */
  pseudonymKey: string;
  /** deleted-membership count; only present on step="finalize". */
  membershipsDeactivated?: number;
  /** Caller-supplied origin marker (self_service | admin | data_subject_request). */
  triggered_by: 'self_service' | 'admin' | 'data_subject_request';
}

/**
 * Static-method service skeleton mirroring {@link AutoPlanningService}.
 * Single-shot: pass a `userId`, get a typed Result. No singleton state.
 *
 * Callers (F6.2 `runDsgvoDeleteFlow`, F6.3 audit-write, F6.4 E2E) will
 * layer additional steps (hard-delete trainer notes, supabase auth
 * delete) around this primitive. This file is the **persistence-layer**
 * anonymization primitive; the Flow orchestration lives in the
 * existing `lib/dsgvo/anonymize-flow.ts` (or a future v2 that delegates
 * here).
 */
export class AnonymizeService {
  /**
   * Anonymize one user. Idempotent. See file header.
   */
  static async anonymizeUser(
    userId: string,
    options: AnonymizeOptions = {}
  ): Promise<AnonymizeResult> {
    if (!userId || typeof userId !== 'string') {
      return { ok: false, error: 'userId is required', code: 'invalid_user_id' };
    }

    const t0 = Date.now();
    const triggeredBy = options.triggeredBy ?? 'self_service';

    try {
      // ─── Step 1: Load user (404 if missing) ──────────────────────────
      const userRows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const user = userRows[0];
      if (!user) {
        return { ok: false, error: 'User nicht gefunden', code: 'user_not_found' };
      }

      // ─── Step 2: Idempotency — pre-existing DSGVO_DELETE audit row? ─
      // Using `auditLogs.details->>'schema_version' = '2'` keeps the
      // query robust against older schema-version rows (e.g. from
      // initial flow migrations) being mis-identified.
      const existing = await db
        .select({ id: auditLogs.id, details: auditLogs.details })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, AUDIT_ACTION_FINALIZE),
            eq(auditLogs.resource_type, 'user'),
            eq(auditLogs.resource_id, userId),
            sql`${auditLogs.details}->>'schema_version' = ${AUDIT_SCHEMA_VERSION.toString()}`
          )
        )
        .limit(1);

      if (existing[0] && existing[0].details && typeof existing[0].details === 'object') {
        const stored = existing[0].details as Partial<AnonymizeAuditDetailsV2>;
        return {
          ok: true,
          userId,
          pseudonymEmail:
            typeof stored.pseudonymEmail === 'string'
              ? stored.pseudonymEmail
              : WIPE_USER_COLUMNS.email(userId),
          pseudonymKey:
            typeof stored.pseudonymKey === 'string'
              ? stored.pseudonymKey
              : hashIdentifier(userId, 'anon_user', 16),
          membershipsDeactivated:
            typeof stored.membershipsDeactivated === 'number' ? stored.membershipsDeactivated : 0,
          durationMs: 0,
          idempotent: true,
        };
      }

      // ─── Step 3: Deterministic pseudonyms ───────────────────────────
      const pseudonymEmail = WIPE_USER_COLUMNS.email(userId);
      const pseudonymKey = hashIdentifier(userId, 'anon_user', 16);

      // ─── Step 4: Audit INTENT log (BEFORE the wipe) ─────────────────
      await db.insert(auditLogs).values({
        actor_id: userId,
        action: AUDIT_ACTION_INTENT,
        resource_type: 'user',
        resource_id: userId,
        details: {
          schema_version: AUDIT_SCHEMA_VERSION,
          step: 'intent' as const,
          pseudonymEmail,
          pseudonymKey,
          triggered_by: triggeredBy,
        } satisfies AnonymizeAuditDetailsV2,
        ip_address: options.ipAddress ?? null,
        user_agent: options.userAgent ?? null,
      });

      // ─── Step 5: Wipe PII on `users` (idempotent re-run is a no-op) ─
      await db
        .update(users)
        .set({
          email: pseudonymEmail,
          full_name: WIPE_USER_COLUMNS.full_name(),
          phone: WIPE_USER_COLUMNS.phone(),
          avatar_url: WIPE_USER_COLUMNS.avatar_url(),
        })
        .where(eq(users.id, userId));

      // ─── Step 6: Soft-deactivate memberships (not hard-delete — GoBD) ─
      const deactivated = await db
        .update(userClubMemberships)
        .set({ is_active: false })
        .where(
          and(eq(userClubMemberships.user_id, userId), eq(userClubMemberships.is_active, true))
        )
        .returning({ id: userClubMemberships.id });

      // ─── Step 7: Audit FINALIZE log (after the wipe) ───────────────
      await db.insert(auditLogs).values({
        actor_id: userId,
        action: AUDIT_ACTION_FINALIZE,
        resource_type: 'user',
        resource_id: userId,
        details: {
          schema_version: AUDIT_SCHEMA_VERSION,
          step: 'finalize' as const,
          pseudonymEmail,
          pseudonymKey,
          membershipsDeactivated: deactivated.length,
          triggered_by: triggeredBy,
        } satisfies AnonymizeAuditDetailsV2,
        ip_address: options.ipAddress ?? null,
        user_agent: options.userAgent ?? null,
      });

      return {
        ok: true,
        userId,
        pseudonymEmail,
        pseudonymKey,
        membershipsDeactivated: deactivated.length,
        durationMs: Date.now() - t0,
        idempotent: false,
      };
    } catch (err) {
      // Defensive: any unhandled DB error → typed Result, never a thrown
      // rejection. Callers can pattern-match on `ok` cleanly.
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
        code: 'internal',
      };
    }
  }
}

export default AnonymizeService;
