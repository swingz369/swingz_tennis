/**
 * Tests for lib/services/anonymize.service.ts (F6.1 service skeleton).
 *
 * Mirrors the existing `src/__tests__/lib/services/` style (konsolidiert; die
 * frühere `tests/unit/lib/dsgvo/anonymize-flow.test.ts`-Vorlage existiert nicht mehr):
 * stub the persistence layer via `vi.mock` + an in-memory mock chain so
 * we don't need a live Postgres. Tests focus on:
 *
 *   1. Happy path on existing user → wipe PII, deactivate memberships,
 *      write intent + finalize audit rows.
 *   2. Idempotency: a second call with the same userId short-circuits
 *      and returns the same pseudonyms + idempotent=true.
 *   3. `user_not_found` for missing user.
 *   4. `invalid_user_id` for empty/non-string input.
 *   5. Determinism: pseudonyms are derived deterministically from
 *      `userId` (no clock, no randomness).
 *
 * FUTURE refactor: when this test suite exceeds ~20 cases, swap to
 * `@electric-sql/pglite` + `drizzle-orm/pglite` so the suite exercises
 * real PostgreSQL semantics. The current mock correctly exercises the
 * service orchestration but does NOT exercise actual JSONB queries,
 * unique-constraint errors, or transaction isolation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Types for the mock backing store ───────────────────────────────────
interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
}
interface MembershipRow {
  id: string;
  user_id: string;
  club_id: string;
  is_active: boolean;
}
interface UserRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
}

const dbState: {
  users: Map<string, UserRow>;
  memberships: MembershipRow[];
  auditEntries: AuditEntry[];
  nextAuditId: number;
} = {
  users: new Map(),
  memberships: [],
  auditEntries: [],
  nextAuditId: 1,
};

// ── Mocked schema: tag each column with `__kind` so `eq(col, val)` ─────
// knows which predicate bucket the value belongs to.
vi.mock('@/src/infrastructure/persistence/schema', () => ({
  users: {
    _: 'users',
    id: { __kind: 'id' },
    email: { __kind: 'col' },
    full_name: { __kind: 'col' },
    phone: { __kind: 'col' },
    avatar_url: { __kind: 'col' },
  },
  userClubMemberships: {
    _: 'userClubMemberships',
    id: { __kind: 'id' },
    user_id: { __kind: 'user_id' },
    club_id: { __kind: 'col' },
    is_active: { __kind: 'is_active' },
  },
  auditLogs: {
    _: 'auditLogs',
    id: { __kind: 'id' },
    actor_id: { __kind: 'user_id' },
    action: { __kind: 'action' },
    resource_type: { __kind: 'resource_type' },
    resource_id: { __kind: 'resource_id' },
    details: { __kind: 'col' },
    ip_address: { __kind: 'col' },
    user_agent: { __kind: 'col' },
  },
  // Step 5c (SEPA bank-detail scrub) + step 5d (trainer-note hard-delete)
  // added after this test was authored — the service imports both from
  // schema, so they must exist here even though no test asserts their
  // mutated state (the mocked `db.update`/`db.delete` below no-op for
  // any table that isn't 'users' or 'userClubMemberships').
  sepaMandates: {
    _: 'sepaMandates',
    memberId: { __kind: 'user_id' },
    iban: { __kind: 'col' },
    accountHolder: { __kind: 'col' },
    bankName: { __kind: 'col' },
    address: { __kind: 'col' },
    isActive: { __kind: 'col' },
    revokedAt: { __kind: 'col' },
    revokeReason: { __kind: 'col' },
  },
  trainerMemberNotes: {
    _: 'trainerMemberNotes',
    member_id: { __kind: 'user_id' },
  },
}));

// ── Mocked db: stateful in-memory. select / update / insert / chain. ────
// Each predicate reads its bucket without bleeding across kinds.
type Pred = {
  _id?: string;
  _resourceId?: string;
  _userId?: string;
  _action?: string;
  _resourceType?: string;
  _isActive?: boolean;
};

vi.mock('@/src/infrastructure/persistence/db', () => {
  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: (predicate: unknown) => ({
            limit: async () => {
              const t = table as { _: 'users' | 'auditLogs' | 'userClubMemberships' };
              const pred = predicate as Pred | undefined;
              const id = pred?._id ?? pred?._resourceId ?? pred?._userId;
              if (t._ === 'users' && typeof id === 'string') {
                const u = dbState.users.get(id);
                return u ? [u] : [];
              }
              if (t._ === 'auditLogs' && typeof id === 'string') {
                const rows = dbState.auditEntries.filter(
                  (a) => a.resource_id === id && a.action === 'DSGVO_DELETE'
                );
                // The service uses `LIMIT 1` for idempotency check.
                return rows.slice(0, 1);
              }
              return [];
            },
          }),
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Partial<UserRow> & { is_active?: boolean }) => ({
          where: (predicate: unknown) => {
            const t = table as { _: 'users' | 'userClubMemberships' };
            const pred = predicate as Pred | undefined;
            const id = pred?._id ?? pred?._resourceId ?? pred?._userId;
            if (t._ === 'users' && typeof id === 'string') {
              const u = dbState.users.get(id);
              if (u) Object.assign(u, values);
              return Promise.resolve();
            }
            if (t._ === 'userClubMemberships' && typeof id === 'string') {
              const matching = dbState.memberships.filter((m) => {
                if (m.user_id !== id) return false;
                if (pred?._isActive === undefined) return true;
                return m.is_active === pred._isActive;
              });
              const updated: MembershipRow[] = [];
              for (const m of matching) {
                m.is_active = false;
                updated.push({ ...m });
              }
              return { returning: async (_cols: unknown) => updated };
            }
            return Promise.resolve();
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: (entry: Omit<AuditEntry, 'id'>) => {
          const t = table as { _: 'auditLogs' };
          if (t._ === 'auditLogs') {
            dbState.auditEntries.push({
              id: `audit_${dbState.nextAuditId++}`,
              ...entry,
            });
          }
          return Promise.resolve();
        },
      }),
      // Step 5b: raw-SQL address/emergency-contact wipe (not modeled in the
      // Drizzle schema — the service issues `db.execute(sql\`...\`)` directly).
      // No test asserts on this; a resolving no-op is sufficient.
      execute: async (_query: unknown) => ({ rows: [] }),
      // Step 5d: hard-delete trainer notes (sensitive PII, not GoBD-locked).
      // No test asserts on this table's contents; no-op resolve.
      delete: (_table: unknown) => ({
        where: async (_predicate: unknown) => Promise.resolve(),
      }),
    },
  };
});

// ── Mocked drizzle primitives ──────────────────────────────────────────
// `eq` looks at col.__kind and routes the value into the right bucket.
// `and` merges via Object.assign (last-wins per key).
// `sql` is an opaque proxy (the JSONB operator is documented but skipped
// in this F6.1 skeleton — see the service file's JSDoc).
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => {
    const kind =
      typeof col === 'object' && col !== null && '__kind' in col
        ? (col as { __kind: string }).__kind
        : 'unknown';
    const out: Pred = {};
    if (kind === 'id' || kind === 'user_id') {
      out._id = String(val);
      out._userId = String(val);
    }
    if (kind === 'resource_id') {
      out._resourceId = String(val);
    }
    if (kind === 'action') {
      out._action = String(val);
    }
    if (kind === 'resource_type') {
      out._resourceType = String(val);
    }
    if (kind === 'is_active') {
      out._isActive = Boolean(val);
    }
    return out;
  },
  and: (...conds: Pred[]) => Object.assign({}, ...conds),
  sql: (() => {
    // Opaque self-referential Proxy: any property access or call returns
    // the proxy again. Explicit `: any` annotation avoids TS7022 (self-ref
    // inference). The mock represents drizzle-orm's sql`` tag template,
    // which is never inspected by the F6.1 service skeleton — see
    // AnonymizeService JSDoc about the JSONB operator we skip in mocks.
    const proxy: any = new Proxy(() => proxy, {
      get: () => proxy,
      apply: () => proxy,
    });
    return proxy;
  })(),
}));

import { AnonymizeService } from '@/lib/services/anonymize.service';

function seedUser(id: string, overrides: Partial<UserRow> = {}) {
  dbState.users.set(id, {
    id,
    email: `${id}@example.test`,
    full_name: `Tennis Spieler ${id}`,
    phone: '+49 30 123 456',
    avatar_url: 'https://x.test/avatar.png',
    ...overrides,
  });
  // Seed 3 memberships — 2 active, 1 already inactive.
  dbState.memberships = [
    { id: 'm1', user_id: id, club_id: 'club_a', is_active: true },
    { id: 'm2', user_id: id, club_id: 'club_b', is_active: true },
    { id: 'm3', user_id: id, club_id: 'club_c', is_active: false },
  ];
}

beforeEach(() => {
  dbState.users.clear();
  dbState.memberships = [];
  dbState.auditEntries = [];
  dbState.nextAuditId = 1;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AnonymizeService.anonymizeUser — happy path', () => {
  it('wipes PII, deactivates only active memberships, writes intent+finalize audit', async () => {
    const userId = 'user_happy';
    seedUser(userId);

    const result = await AnonymizeService.anonymizeUser(userId);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');

    expect(result.idempotent).toBe(false);

    // ── PII was wiped ────────────────────────────────────────────────
    const u = dbState.users.get(userId)!;
    expect(u.email).toBe(`deleted-${userId}@deleted.invalid`);
    expect(u.full_name).toBe('Gelöschter Nutzer');
    expect(u.phone).toBeNull();
    expect(u.avatar_url).toBeNull();

    // ── Memberships: 2 active → both deactivated (3rd was already off) ─
    expect(result.membershipsDeactivated).toBe(2);
    // Per-row invariant: the 2 active rows flipped to false (deactivated by
    // the service), the already-inactive row stayed false (untouched — the
    // mock filter on `is_active: true` correctly excluded it). The previous
    // attempt used `filter(m.is_active)` which returned 0 (not 1) because
    // m3 was seeded as inactive and stays inactive — the load-bearing
    // check is the `membershipsDeactivated` count above, not this snapshot.
    expect(dbState.memberships.find((m) => m.id === 'm1')?.is_active).toBe(false);
    expect(dbState.memberships.find((m) => m.id === 'm2')?.is_active).toBe(false);
    expect(dbState.memberships.find((m) => m.id === 'm3')?.is_active).toBe(false);

    // ── Audit log: 2 entries — INTENT then FINALIZE ─────────────────
    expect(dbState.auditEntries).toHaveLength(2);
    const [intent, finalize] = dbState.auditEntries;
    expect(intent.action).toBe('DSGVO_DELETE_INTENT');
    expect(intent.resource_type).toBe('user');
    expect(intent.resource_id).toBe(userId);
    expect(intent.details.step).toBe('intent');
    expect(intent.details.schema_version).toBe(2);

    expect(finalize.action).toBe('DSGVO_DELETE');
    expect(finalize.resource_id).toBe(userId);
    expect(finalize.details.step).toBe('finalize');
    expect(finalize.details.schema_version).toBe(2);
    expect(finalize.details.membershipsDeactivated).toBe(2);
    expect(finalize.details.pseudonymKey).toBe(intent.details.pseudonymKey);
    expect(finalize.details.pseudonymEmail).toBe(intent.details.pseudonymEmail);
  });

  it('propagates ipAddress + userAgent + triggeredBy into BOTH audit rows', async () => {
    const userId = 'user_audit_ctx';
    seedUser(userId);

    await AnonymizeService.anonymizeUser(userId, {
      ipAddress: '203.0.113.42',
      userAgent: 'Mozilla/5.0 (compatible; TestRunner)',
      triggeredBy: 'admin',
    });

    expect(dbState.auditEntries).toHaveLength(2);
    for (const a of dbState.auditEntries) {
      expect(a.ip_address).toBe('203.0.113.42');
      expect(a.user_agent).toBe('Mozilla/5.0 (compatible; TestRunner)');
      expect(a.details.triggered_by).toBe('admin');
    }
  });

  it('pseudonym values are deterministic across separate runs', async () => {
    const userId = 'user_determinism';
    seedUser(userId);
    const r1 = await AnonymizeService.anonymizeUser(userId);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error('expected ok');
    const emailA = r1.pseudonymEmail;
    const keyA = r1.pseudonymKey;

    // Reset DB but re-seed with the SAME userId and call again.
    dbState.users.clear();
    dbState.memberships = [];
    dbState.auditEntries = [];
    seedUser(userId);
    const r2 = await AnonymizeService.anonymizeUser(userId);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error('expected ok');

    expect(r2.pseudonymEmail).toBe(emailA);
    expect(r2.pseudonymKey).toBe(keyA);
  });
});

describe('AnonymizeService.anonymizeUser — idempotency', () => {
  it('returns idempotent=true on the second call WITHOUT re-writing', async () => {
    const userId = 'user_idem';
    seedUser(userId);

    const first = await AnonymizeService.anonymizeUser(userId);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('expected ok');
    expect(first.idempotent).toBe(false);

    // Snapshot the audit log size.
    const auditsAfterFirst = dbState.auditEntries.length;

    // Tamper with the user row to detect a re-write on the idempotent path.
    dbState.users.get(userId)!.email = 'tampered@example.test';

    const second = await AnonymizeService.anonymizeUser(userId);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('expected ok');
    expect(second.idempotent).toBe(true);
    expect(second.pseudonymEmail).toBe(first.pseudonymEmail);
    expect(second.pseudonymKey).toBe(first.pseudonymKey);
    expect(second.durationMs).toBe(0);
    expect(second.membershipsDeactivated).toBe(first.membershipsDeactivated);

    // The user table must NOT have been rewritten by the second call.
    expect(dbState.users.get(userId)!.email).toBe('tampered@example.test');

    // Audit log must NOT have grown.
    expect(dbState.auditEntries.length).toBe(auditsAfterFirst);
  });
});

describe('AnonymizeService.anonymizeUser — error paths', () => {
  it('returns invalid_user_id for empty string', async () => {
    const res = await AnonymizeService.anonymizeUser('');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected err');
    expect(res.code).toBe('invalid_user_id');
  });

  it('returns user_not_found when the user does not exist', async () => {
    const res = await AnonymizeService.anonymizeUser('user_missing');
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected err');
    expect(res.code).toBe('user_not_found');
    expect(dbState.auditEntries).toHaveLength(0); // no intent log on no-op
  });

  it('never throws — returns a typed object with `ok` discriminator', async () => {
    const userId = 'user_typed';
    seedUser(userId);

    // Sanity: calling the service must return a typed object — neither
    // throw nor return a Promise that rejects.
    const result = await AnonymizeService.anonymizeUser(userId);
    expect(typeof result).toBe('object');
    if (result === null) throw new Error('expected object');
    expect(typeof result.ok).toBe('boolean');
  });
});
