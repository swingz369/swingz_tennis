/**
 * GroupService (ADR-005): NOT_FOUND-Übersetzung und Mutationslogik.
 * Mockt das GroupRepository per Prototyp-Spy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeAuth } from '../helpers/auth';
import { ApiException } from '@/lib/api-error';
import { GroupService } from '@/application/services/group.service';
import { GroupRepository } from '@/infrastructure/persistence/repositories/group.repository';
import { GroupEntity } from '@/domain/entities/group.entity';
import { ClubId } from '@/domain/value-objects';

const CLUB = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const makeGroup = () => GroupEntity.create(ClubId.fromString(CLUB), 'Montag', 'beginner', 'junior');

describe('GroupService', () => {
  beforeEach(() => {
    vi.spyOn(GroupRepository.prototype, 'save').mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('wirft NOT_FOUND, wenn die Gruppe fehlt', async () => {
    vi.spyOn(GroupRepository.prototype, 'findById').mockResolvedValue(null);
    const svc = new GroupService(fakeAuth());
    await expect(svc.getById('x')).rejects.toBeInstanceOf(ApiException);
    await expect(svc.addMember('x', MEMBER)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('fügt ein Mitglied hinzu und speichert', async () => {
    const group = makeGroup();
    vi.spyOn(GroupRepository.prototype, 'findById').mockResolvedValue(group);
    await new GroupService(fakeAuth()).addMember(group.getId().getValue(), MEMBER);
    expect(group.getMemberCount()).toBe(1);
    expect(GroupRepository.prototype.save).toHaveBeenCalledWith(group);
  });

  it('deaktiviert statt zu löschen', async () => {
    const group = makeGroup();
    vi.spyOn(GroupRepository.prototype, 'findById').mockResolvedValue(group);
    await new GroupService(fakeAuth()).deactivate(group.getId().getValue());
    expect(group.getIsActive()).toBe(false);
  });

  it('update setzt nur übergebene Felder', async () => {
    const group = makeGroup();
    vi.spyOn(GroupRepository.prototype, 'findById').mockResolvedValue(group);
    await new GroupService(fakeAuth()).update('x', { name: 'Dienstag' });
    expect(group.getName()).toBe('Dienstag');
    expect(group.getIsActive()).toBe(true);
  });
});
