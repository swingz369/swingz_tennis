import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * DecisionService gegen einen gemockten Supabase-Service-Client getestet.
 *
 * Pattern: `expectFromQueue(...entries)` — jedes Makro `from(table)` wird
 * konsumiert in Reihenfolge und gibt die nächste registrierte Mock-Chain
 * zurück. `entry.table` ist die Tabellenzuordnung; insert/update/upsert
 * erfassen `table` + payload für Spy-Assertions.
 *
 * Vor jedem Test wird `__resetForTests()` aufgerufen, um den modul-lokalen
 * `actorLabelCache` zu leeren — sonst persistiert er über Test-Grenzen
 * hinweg und Lookup-Hits verändern die Reihenfolge der `from()`-Aufrufe.
 */

// Mocks VOR Service-Import (vi.mock wird gehoisted).
const { mockFrom, capturedWrites, capturedUpserts } = vi.hoisted(() => {
  const capturedWrites: Array<{ table: string; op: 'insert' | 'update'; payload: unknown }> = [];
  const capturedUpserts: Array<{ table: string; payload: unknown; opts: unknown }> = [];
  const mockFrom = vi.fn();
  return { mockFrom, capturedWrites, capturedUpserts };
});

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

import { decisionService, __resetForTests } from '@/lib/decisions/decision.service';

type MockEntry = {
  table: string;
  data?: unknown;
  count?: number;
  error: null | { message: string };
};

/**
 * Erzeugt einen chainable Builder, dessen Terminal-Calls (single/maybeSingle)
 * ODER direkt await die gegebene Response zurückliefert.
 *
 * Erfasst alle insert/update/upsert-Payloads mit tabellenzuordnung.
 */
function chainReturning(entry: MockEntry) {
  const response = Promise.resolve({
    data: entry.data ?? null,
    count: entry.count ?? 0,
    error: entry.error ?? null,
  });
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn((payload: unknown) => {
      capturedWrites.push({ table: entry.table, op: 'insert', payload });
      return chain;
    }),
    update: vi.fn((payload: unknown) => {
      capturedWrites.push({ table: entry.table, op: 'update', payload });
      return chain;
    }),
    upsert: vi.fn((payload: unknown, opts: unknown) => {
      capturedUpserts.push({ table: entry.table, payload, opts });
      return chain;
    }),
    single: vi.fn(() => response),
    maybeSingle: vi.fn(() => response),
  };
  // `await supabase.from(...).select(...).eq(...)` ohne terminal resolves.
  chain.then = (resolve: (v: unknown) => void) => response.then(resolve);
  return chain;
}

/** Sequenz-Setup: jede `from()`-Aufruf konsumiert die nächste entry. */
function expectFromQueue(...entries: MockEntry[]) {
  mockFrom.mockReset();
  entries.forEach((e) => mockFrom.mockReturnValueOnce(chainReturning(e)));
}

beforeEach(() => {
  mockFrom.mockReset();
  capturedWrites.length = 0;
  capturedUpserts.length = 0;
  // Modul-lokaler actorLabelCache muss geleert werden, sonst liefert die
  // 2. Test-Aufruf nach der 1. einen Cache-Hit und Production spart die
  // `from('users')`-Lookup — die Queue-Entries für ‘users` werden dann von
  // späteren Tabellen-Operationen konsumiert (falsche Tabellen-Zuordnung).
  __resetForTests();
});

describe('DecisionService.createDecision', () => {
  it('legt einen Beschluss an (status="draft" wenn kein meeting_date)', async () => {
    const inserted = {
      id: 'd-1',
      club_id: 'c-1',
      title: 'Beitragserhöhung 2027',
      description: null,
      decision_type: 'mitgliederversammlung',
      meeting_date: null,
      status: 'draft',
      created_by: 'u-1',
    };
    // 1) board_decisions insert → single, 2) users lookup (recordChange), 3) decision_changes insert
    expectFromQueue(
      { table: 'board_decisions', data: inserted, error: null },
      { table: 'users', data: { full_name: 'Admin' }, error: null },
      { table: 'decision_changes', error: null }
    );

    const result = await decisionService.createDecision('c-1', 'u-1', {
      title: 'Beitragserhöhung 2027',
      decision_type: 'mitgliederversammlung',
    });

    expect(result.id).toBe('d-1');
    expect(result.status).toBe('draft');

    // Audit-Insert geschrieben (action='created')
    const createdAudit = capturedWrites.find(
      (w) => w.table === 'decision_changes' && (w.payload as any)?.action === 'created'
    );
    expect(createdAudit).toBeDefined();
  });

  it('mit meeting_date wird status="scheduled" + erstellt Einladungen', async () => {
    const inserted = {
      id: 'd-2',
      club_id: 'c-1',
      title: 'Saisonplanung 2027',
      description: null,
      decision_type: 'mitgliederversammlung',
      meeting_date: '2027-03-15',
      status: 'scheduled',
      created_by: 'u-1',
    };
    // Reihenfolge:
    // 1) board_decisions insert → single
    // 2) meeting_invitations insert (await ohne terminal)
    // 3) users lookup (recordChange)
    // 4) decision_changes insert (invitation_sent)
    // 5) decision_changes insert (created)
    expectFromQueue(
      { table: 'board_decisions', data: inserted, error: null },
      { table: 'meeting_invitations', error: null },
      { table: 'users', data: { full_name: 'Admin' }, error: null },
      { table: 'decision_changes', error: null }, // invitation_sent
      { table: 'decision_changes', error: null } // created
    );

    const result = await decisionService.createDecision('c-1', 'u-1', {
      title: 'Saisonplanung 2027',
      decision_type: 'mitgliederversammlung',
      meeting_date: '2027-03-15',
      invited_member_ids: ['m-1', 'm-2', 'm-3'],
    });

    expect(result.status).toBe('scheduled');
    // capturedWrites enthält 3 inserts: 1× meeting_invitations + 2× decision_changes
    const insertTables = capturedWrites.filter((w) => w.op === 'insert').map((w) => w.table);
    expect(insertTables).toContain('meeting_invitations');
    expect(insertTables.filter((t) => t === 'decision_changes').length).toBe(2);
  });
});

describe('DecisionService.updateDecision', () => {
  it('schreibt Audit mit action="status_changed" bei Statusübergang', async () => {
    const before = { id: 'd-1', status: 'draft', title: 'X', decision_type: 'vorstandsbeschluss' };
    const updated = {
      id: 'd-1',
      status: 'in_progress',
      title: 'X',
      decision_type: 'vorstandsbeschluss',
    };

    expectFromQueue(
      { table: 'board_decisions', data: before, error: null }, // getDecisionById
      { table: 'board_decisions', data: updated, error: null }, // update → single
      { table: 'users', data: { full_name: 'Admin' }, error: null }, // recordChange actor lookup
      { table: 'decision_changes', error: null } // audit insert
    );

    await decisionService.updateDecision('d-1', 'u-1', { status: 'in_progress' });

    const auditInsert = capturedWrites.find(
      (w) => w.table === 'decision_changes' && (w.payload as any)?.action === 'status_changed'
    );
    expect(auditInsert).toBeDefined();
    expect((auditInsert!.payload as any).old_values.status).toBe('draft');
    expect((auditInsert!.payload as any).new_values.status).toBe('in_progress');
  });

  it('schreibt Audit mit action="cancelled" bei Übergang auf cancelled', async () => {
    const before = { id: 'd-1', status: 'scheduled', title: 'X' };
    const updated = { id: 'd-1', status: 'cancelled', title: 'X' };

    expectFromQueue(
      { table: 'board_decisions', data: before, error: null },
      { table: 'board_decisions', data: updated, error: null },
      { table: 'users', data: { full_name: 'Admin' }, error: null },
      { table: 'decision_changes', error: null }
    );

    await decisionService.updateDecision('d-1', 'u-1', { status: 'cancelled' });

    const auditInsert = capturedWrites.find(
      (w) => w.table === 'decision_changes' && (w.payload as any)?.action === 'cancelled'
    );
    expect(auditInsert).toBeDefined();
  });
});

describe('DecisionService.castVote — Idempotenz', () => {
  it('castVote nutzt upsert mit onConflict=decision_id,voter_id (Re-Voting erlaubt)', async () => {
    // 2 castVote-Calls = 2 upserts + 2 recordChange-Sequenzen (users + decision_changes) = 6 from() Calls
    expectFromQueue(
      // 1. castVote (for)
      { table: 'decision_votes', error: null }, // upsert (no terminal, resolves via await)
      { table: 'users', data: { full_name: 'Voter 1' }, error: null },
      { table: 'decision_changes', error: null },
      // 2. castVote (against)
      { table: 'decision_votes', error: null },
      { table: 'users', data: { full_name: 'Voter 1' }, error: null }, // cache hit
      { table: 'decision_changes', error: null }
    );

    await decisionService.castVote('d-1', 'u-1', { choice: 'for' });
    await decisionService.castVote('d-1', 'u-1', { choice: 'against' }); // Re-Vote

    const voteUpserts = capturedUpserts.filter((u) => u.table === 'decision_votes');
    expect(voteUpserts).toHaveLength(2);
    // Beide nutzen den SELBEN onConflict-Schlüssel → idempotent
    expect((voteUpserts[0]!.opts as any).onConflict).toBe('decision_id,voter_id');
    expect((voteUpserts[1]!.opts as any).onConflict).toBe('decision_id,voter_id');
    expect((voteUpserts[1]!.payload as any).choice).toBe('against');
  });
});

describe('DecisionService.computeQuorum — BGB §32 Modi', () => {
  it('mitgliederversammlung ohne system_settings → default-always-quorate (§32 Abs. 1)', async () => {
    expectFromQueue(
      {
        table: 'meeting_invitations',
        data: [{ status: 'accepted' }, { status: 'declined' }, { status: 'accepted' }],
        error: null,
      },
      { table: 'decision_votes', count: 5, error: null },
      { table: 'system_settings', data: null, error: null }
    );

    const result = await decisionService.computeQuorum('d-1', 'mitgliederversammlung', 'c-1');

    expect(result.acceptedCount).toBe(2);
    expect(result.declinedCount).toBe(1);
    expect(result.votersCount).toBe(5);
    expect(result.quorumMet).toBe(true);
    expect(result.mode).toBe('mv_default_always_quorate');
  });

  it('mitgliederversammlung mit mv_quorum_required_pct=25 → prüft Anwesenheit', async () => {
    expectFromQueue(
      {
        table: 'meeting_invitations',
        data: [
          { status: 'accepted' },
          { status: 'accepted' },
          { status: 'tentative' },
          { status: 'declined' },
        ],
        error: null,
      },
      { table: 'decision_votes', count: 3, error: null },
      { table: 'system_settings', data: { value: '25' }, error: null },
      { table: 'user_club_memberships', count: 8, error: null }
    );

    const result = await decisionService.computeQuorum('d-1', 'mitgliederversammlung', 'c-1');

    expect(result.acceptedCount).toBe(2);
    expect(result.tentativeCount).toBe(1);
    expect(result.requiredMin).toBe(2); // ceil(8 × 25 / 100) = 2
    expect(result.quorumMet).toBe(true);
    expect(result.mode).toBe('mv_pct_threshold');
  });

  it('vorstandsbeschluss ohne Einladungen + ohne Stimmen → fallback + quorumMet=false', async () => {
    expectFromQueue(
      { table: 'meeting_invitations', data: [], error: null },
      { table: 'decision_votes', count: 0, error: null },
      { table: 'system_settings', data: null, error: null }
    );

    const result = await decisionService.computeQuorum('d-1', 'vorstandsbeschluss', 'c-1');

    expect(result.acceptedCount).toBe(0);
    expect(result.requiredMin).toBe(1);
    expect(result.quorumMet).toBe(false);
    expect(result.mode).toBe('fallback_one_vote');
  });

  it('vorstandsbeschluss mit 1 Stimme → fallback_one_vote + quorumMet=true', async () => {
    expectFromQueue(
      { table: 'meeting_invitations', data: [], error: null },
      { table: 'decision_votes', count: 1, error: null },
      { table: 'system_settings', data: null, error: null }
    );

    const result = await decisionService.computeQuorum('d-1', 'vorstandsbeschluss', 'c-1');

    expect(result.quorumMet).toBe(true);
    expect(result.mode).toBe('fallback_one_vote');
  });

  it('vorstandsbeschluss mit 2 angenommenen Einladungen → board_min_members + quorumMet=true', async () => {
    expectFromQueue(
      {
        table: 'meeting_invitations',
        data: [{ status: 'accepted' }, { status: 'accepted' }],
        error: null,
      },
      { table: 'decision_votes', count: 2, error: null },
      { table: 'system_settings', data: null, error: null }
    );

    const result = await decisionService.computeQuorum('d-1', 'vorstandsbeschluss', 'c-1');

    expect(result.acceptedCount).toBe(2);
    expect(result.quorumMet).toBe(true);
    expect(result.mode).toBe('board_min_members');
  });
});

describe('DecisionService.finalizeDecision — Auto-Quorum + Tally', () => {
  it('setzt status=completed + outcome + quorum_met + aggregierte Votes + audit finalized', async () => {
    const before = {
      id: 'd-99',
      club_id: 'c-1',
      decision_type: 'mitgliederversammlung',
      status: 'in_progress',
      outcome: null,
      quorum_met: null,
    };
    const updated = {
      ...before,
      status: 'completed',
      outcome: 'approved',
      quorum_met: true,
      votes_for: 3,
      votes_against: 1,
      votes_abstain: 1,
      approved_by: 'u-1',
    };

    expectFromQueue(
      { table: 'board_decisions', data: before, error: null }, // 1. getDecisionById
      {
        table: 'meeting_invitations',
        data: [{ status: 'accepted' }, { status: 'accepted' }],
        error: null,
      }, // 2. quorum
      { table: 'decision_votes', count: 5, error: null }, // 3. quorum voters count
      { table: 'system_settings', data: null, error: null }, // 4. quorum pct lookup (null → default)
      {
        table: 'decision_votes',
        data: [
          // 5. tally
          { choice: 'for' },
          { choice: 'for' },
          { choice: 'for' },
          { choice: 'against' },
          { choice: 'abstain' },
        ],
        error: null,
      },
      { table: 'board_decisions', data: updated, error: null }, // 6. update → single
      { table: 'users', data: { full_name: 'Admin' }, error: null }, // 7. recordChange actor
      { table: 'decision_changes', error: null } // 8. recordChange audit
    );

    const result = await decisionService.finalizeDecision('d-99', 'approved', 'u-1');

    expect(result.status).toBe('completed');
    expect(result.outcome).toBe('approved');
    expect(result.quorum_met).toBe(true);
    expect(result.votes_for).toBe(3);
    expect(result.votes_against).toBe(1);
    expect(result.votes_abstain).toBe(1);
    expect(result.approved_by).toBe('u-1');

    // Audit-Insert mit action='finalized' verifizieren
    const finalizedAudit = capturedWrites.find(
      (w) => w.table === 'decision_changes' && (w.payload as any)?.action === 'finalized'
    );
    expect(finalizedAudit).toBeDefined();
    expect((finalizedAudit!.payload as any).details.outcome).toBe('approved');
    expect((finalizedAudit!.payload as any).details.tally).toEqual({
      votes_for: 3,
      votes_against: 1,
      votes_abstain: 1,
    });
  });
});

describe('DecisionService.respondToInvitation', () => {
  it('updated Einladungs-Status + Audit-Log invitation_response', async () => {
    const updatedInvite = {
      id: 'inv-1',
      decision_id: 'd-1',
      member_id: 'm-1',
      status: 'accepted',
      response_note: 'Ich komme',
      responded_at: '2026-06-24T10:00:00.000Z',
      sent_at: '2026-06-20T08:00:00.000Z',
      reminded_at: null,
    };
    expectFromQueue(
      { table: 'meeting_invitations', data: updatedInvite, error: null },
      { table: 'users', data: { full_name: 'Max Muster' }, error: null },
      { table: 'decision_changes', error: null }
    );

    const result = await decisionService.respondToInvitation('d-1', 'm-1', {
      status: 'accepted',
      response_note: 'Ich komme',
    });

    expect(result.status).toBe('accepted');
    expect(result.response_note).toBe('Ich komme');

    const auditInsert = capturedWrites.find(
      (w) => w.table === 'decision_changes' && (w.payload as any)?.action === 'invitation_response'
    );
    expect(auditInsert).toBeDefined();
    expect((auditInsert!.payload as any).details.status).toBe('accepted');
  });
});

describe('DecisionService.recordChange — Failure-Tolerance', () => {
  it('Audit-Fehler dürfen Haupt-Operation nicht blockieren (try/catch in castVote)', async () => {
    // decision_changes.insert REJECTED — recordChange's try/catch fängt
    mockFrom.mockImplementation((_table: string) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(() => Promise.resolve({ data: { full_name: 'Voter' }, error: null })),
        insert: vi.fn(() => Promise.reject(new Error('Audit-Tabelle weg'))),
        upsert: vi.fn((payload: unknown, opts: unknown) => {
          capturedUpserts.push({ table: '_', payload, opts });
          return chain;
        }),
      };
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve);
      return chain;
    });

    await expect(
      decisionService.castVote('d-1', 'u-1', { choice: 'for' })
    ).resolves.toBeUndefined();
    // Trotz Fehler: decision_votes.upsert wurde aufgerufen
    expect(capturedUpserts.length).toBeGreaterThan(0);
  });
});
