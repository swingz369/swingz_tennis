/**
 * Mitglieder-Teildomäne "Gruppen" für ADR-005. Ein Repository, kein
 * Adapter, kein separates Interface (einzige Implementierung) — Muster in
 * docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md § 6. RLS
 * (admins_manage_groups, club_members_see_groups) war hier bereits korrekt
 * auf is_club_admin/is_club_member gescoped, keine Policy-Korrektur nötig.
 *
 * Behält die bestehende Domain-Entity (GroupEntity mit Value Objects) bei —
 * das ist echtes, benutztes Verhalten (Validierung in setName,
 * addMember/removeMember-Mutationslogik), keine Zeremonie ohne Nutzen.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Group } from '@/domain/entities/group.entity';
import { GroupEntity } from '@/domain/entities/group.entity';
import { GroupId, ClubId, MemberId } from '@/domain/value-objects';
import type { Tables } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:group.repository');

type GroupRow = Tables<'groups'>;

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

function mapToDomain(row: GroupRow): Group {
  const memberIds: MemberId[] = ((row.member_ids as string[] | null) ?? []).map((id) =>
    MemberId.fromString(id)
  );
  return GroupEntity.reconstitute(
    GroupId.fromString(row.id),
    ClubId.fromString(row.club_id),
    row.name,
    row.level as Group['level'],
    row.age_group as Group['ageGroup'],
    row.description ?? undefined,
    row.is_active ?? true,
    memberIds,
    new Date(row.created_at ?? Date.now()),
    new Date(row.updated_at ?? Date.now())
  );
}

export class GroupRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findById(id: GroupId): Promise<Group | null> {
    const { data, error } = await this.db
      .from('groups')
      .select()
      .eq('id', id.getValue())
      .maybeSingle();
    assertNoError(error, 'Lesen der Gruppe fehlgeschlagen');
    return data ? mapToDomain(data) : null;
  }

  async findByClubId(clubId: ClubId): Promise<Group[]> {
    const { data, error } = await this.db.from('groups').select().eq('club_id', clubId.getValue());
    assertNoError(error, 'Lesen der Gruppen fehlgeschlagen');
    return (data ?? []).map(mapToDomain);
  }

  async save(group: Group): Promise<void> {
    const values = {
      id: group.getId().getValue(),
      club_id: group.getClubId().getValue(),
      name: group.getName(),
      description: group.getDescription() ?? null,
      level: group.getLevel(),
      age_group: group.getAgeGroup(),
      is_active: group.getIsActive(),
      member_ids: group.getMemberIds().map((id) => id.getValue()),
    };

    const existing = await this.findById(group.getId());
    if (existing) {
      const { error } = await this.db.from('groups').update(values).eq('id', values.id);
      assertNoError(error, 'Aktualisieren der Gruppe fehlgeschlagen');
    } else {
      const { error } = await this.db.from('groups').insert(values);
      assertNoError(error, 'Anlegen der Gruppe fehlgeschlagen');
    }
  }

  async addMemberToGroup(groupId: GroupId, memberId: MemberId): Promise<void> {
    const group = await this.findById(groupId);
    if (!group) throw new Error('Group not found');
    group.addMember(memberId);
    await this.save(group);
  }

  async removeMemberFromGroup(groupId: GroupId, memberId: MemberId): Promise<void> {
    const group = await this.findById(groupId);
    if (!group) throw new Error('Group not found');
    group.removeMember(memberId);
    await this.save(group);
  }
}
