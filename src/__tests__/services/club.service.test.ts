/**
 * ClubService (ADR-005): NOT_FOUND-Übersetzung und Feld-Mapping beim Update.
 * Mockt das ClubRepository per Prototyp-Spy.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeAuth } from '../helpers/auth';
import { ApiException } from '@/lib/api-error';
import { ClubService } from '@/application/services/club.service';
import {
  ClubRepository,
  type ClubRow,
} from '@/infrastructure/persistence/repositories/club.repository';

const club = { id: 'c1', name: 'TC Test' } as ClubRow;

describe('ClubService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('wirft NOT_FOUND für unbekannte (oder per RLS unsichtbare) Vereine', async () => {
    vi.spyOn(ClubRepository.prototype, 'findById').mockResolvedValue(null);
    const svc = new ClubService(fakeAuth());
    await expect(svc.getById('x')).rejects.toBeInstanceOf(ApiException);
    await expect(svc.update('x', {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(svc.softDelete('x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('mappt Eingabefelder auf Spalten und schreibt nur Gesetztes', async () => {
    vi.spyOn(ClubRepository.prototype, 'findById').mockResolvedValue(club);
    const update = vi.spyOn(ClubRepository.prototype, 'update').mockResolvedValue(undefined);
    await new ClubService(fakeAuth()).update('c1', { name: ' Neu ', maxMembers: 50, city: null });
    expect(update).toHaveBeenCalledWith('c1', { name: 'Neu', max_members: 50, city: null });
  });

  it('Soft-Delete liefert Namen und Zahl deaktivierter Mitgliedschaften', async () => {
    vi.spyOn(ClubRepository.prototype, 'findById').mockResolvedValue(club);
    const del = vi.spyOn(ClubRepository.prototype, 'softDelete').mockResolvedValue(3);
    const r = await new ClubService(fakeAuth()).softDelete('c1', 'Grund');
    expect(r).toEqual({ name: 'TC Test', deactivated: 3 });
    expect(del).toHaveBeenCalledWith('c1', 'Grund');
  });
});
