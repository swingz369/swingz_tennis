/**
 * Tests für lib/services/league-member-matching.ts — Kaderzeile ↔ Vereinsmitglied.
 */
import { describe, expect, it } from 'vitest';
import { normalizeTeamName } from '@/lib/services/league-member-matching';

describe('normalizeTeamName', () => {
  it('ignoriert Groß-/Kleinschreibung und Mehrfach-Leerzeichen', () => {
    expect(normalizeTeamName('  TC   Rheinland  II ')).toBe('tc rheinland ii');
  });
});

describe('Spieler-Zuordnung', () => {
  const members = [
    { id: 'u1', full_name: 'Lisa Muster', dtb_id: '111', date_of_birth: '2014-03-01' },
    { id: 'u2', full_name: 'Max Meier', dtb_id: null, date_of_birth: '1980-01-01' },
    { id: 'u3', full_name: 'Max Meier', dtb_id: null, date_of_birth: '2012-05-05' },
    { id: 'u4', full_name: 'Tom Klein', dtb_id: null, date_of_birth: null },
  ];

  it('ordnet über die DTB-ID zu', async () => {
    const { matchByDtbId } = await import('@/lib/services/league-member-matching');
    expect(matchByDtbId({ dtbId: '111' }, members)).toBe('u1');
    expect(matchByDtbId({ dtbId: '999' }, members)).toBeNull();
    expect(matchByDtbId({ dtbId: null }, members)).toBeNull();
  });

  it('ordnet bei doppelter DTB-ID nicht zu', async () => {
    const { matchByDtbId } = await import('@/lib/services/league-member-matching');
    const dup = [...members, { ...members[0], id: 'u9' }];
    expect(matchByDtbId({ dtbId: '111' }, dup)).toBeNull();
  });

  it('schlägt über den Namen vor, wenn er eindeutig ist', async () => {
    const { suggestByName } = await import('@/lib/services/league-member-matching');
    expect(suggestByName({ name: 'tom  klein', birthYear: null }, members)).toBe('u4');
  });

  it('schlägt bei gleichem Namen nichts vor, der Jahrgang trennt aber', async () => {
    const { suggestByName } = await import('@/lib/services/league-member-matching');
    expect(suggestByName({ name: 'Max Meier', birthYear: null }, members)).toBeNull();
    expect(suggestByName({ name: 'Max Meier', birthYear: 2012 }, members)).toBe('u3');
  });

  it('lehnt einen Namenstreffer mit abweichendem Jahrgang ab', async () => {
    const { suggestByName } = await import('@/lib/services/league-member-matching');
    expect(suggestByName({ name: 'Lisa Muster', birthYear: 1990 }, members)).toBeNull();
  });
});
