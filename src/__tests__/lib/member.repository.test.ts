import { describe, it, expect } from 'vitest';
import { MemberRepository } from '@/infrastructure/persistence/repositories/member.repository';
import { ClubId } from '@/domain/value-objects';

type Row = Record<string, unknown>;

function makeDbStub(tables: Record<string, Row[]>) {
  function builder(table: string, filters: Array<[string, unknown]> = []) {
    const rows = tables[table] ?? [];
    const applyFilters = (data: Row[]) =>
      filters.reduce((acc, [col, val]) => {
        if (Array.isArray(val)) return acc.filter((r) => val.includes(r[col]));
        return acc.filter((r) => r[col] === val);
      }, data);

    const chain: any = {
      select: () => chain,
      eq: (col: string, val: unknown) => builder(table, [...filters, [col, val]]),
      in: (col: string, val: unknown[]) => builder(table, [...filters, [col, val]]),
      then: (resolve: (v: { data: Row[]; error: null }) => void) =>
        resolve({ data: applyFilters(rows), error: null }),
    };
    return chain;
  }

  return { from: (table: string) => builder(table) } as any;
}

describe('MemberRepository.findByClub', () => {
  it('schließt Mitglieder eines anderen Vereins aus', async () => {
    const db = makeDbStub({
      user_club_memberships: [
        { user_id: 'user-1', club_id: 'club-1', is_active: true },
        { user_id: 'user-2', club_id: 'club-2', is_active: true },
      ],
      users: [
        { id: 'user-1', email: 'a@example.com', full_name: 'Anna', created_at: '2026-01-01' },
        { id: 'user-2', email: 'b@example.com', full_name: 'Ben', created_at: '2026-01-02' },
      ],
    });
    const repo = new MemberRepository(db);

    const members = await repo.findByClub(ClubId.fromString('club-1'));

    expect(members).toHaveLength(1);
    expect(members[0].email).toBe('a@example.com');
  });

  it('schließt inaktive Mitgliedschaften aus', async () => {
    const db = makeDbStub({
      user_club_memberships: [{ user_id: 'user-1', club_id: 'club-1', is_active: false }],
      users: [
        { id: 'user-1', email: 'a@example.com', full_name: 'Anna', created_at: '2026-01-01' },
      ],
    });
    const repo = new MemberRepository(db);

    const members = await repo.findByClub(ClubId.fromString('club-1'));

    expect(members).toEqual([]);
  });

  it('gibt ein leeres Array zurück, wenn der Verein keine aktiven Mitglieder hat', async () => {
    const db = makeDbStub({ user_club_memberships: [], users: [] });
    const repo = new MemberRepository(db);

    const members = await repo.findByClub(ClubId.fromString('club-ohne-mitglieder'));

    expect(members).toEqual([]);
  });
});
