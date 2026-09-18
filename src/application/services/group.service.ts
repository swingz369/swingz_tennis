import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb } from '@/infrastructure/db';
import { GroupRepository } from '@/infrastructure/persistence/repositories/group.repository';
import { GroupEntity } from '@/domain/entities/group.entity';
import type { Group, GroupAgeGroup, GroupLevel } from '@/domain/entities/group.entity';
import { ClubId, GroupId, MemberId } from '@/domain/value-objects';

export interface CreateGroupInput {
  clubId: string;
  name: string;
  level: GroupLevel;
  ageGroup: GroupAgeGroup;
  description?: string | null;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

/**
 * Gruppen-Service (ADR-005): Fachlogik der Trainingsgruppen, Datenzugriff
 * ausschliesslich über das GroupRepository (RLS über getUserDb).
 */
export class GroupService {
  private readonly repo: GroupRepository;

  constructor(auth: AuthContext) {
    this.repo = new GroupRepository(getUserDb(auth));
  }

  async listByClub(clubId: string): Promise<Group[]> {
    return this.repo.findByClubId(ClubId.fromString(clubId));
  }

  async getById(id: string): Promise<Group> {
    const group = await this.repo.findById(GroupId.fromString(id));
    if (!group) throw new ApiException('NOT_FOUND', 'Gruppe nicht gefunden');
    return group;
  }

  async create(input: CreateGroupInput): Promise<Group> {
    const group = GroupEntity.create(
      ClubId.fromString(input.clubId),
      input.name,
      input.level,
      input.ageGroup,
      input.description ?? undefined
    );
    await this.repo.save(group);
    return group;
  }

  async update(id: string, input: UpdateGroupInput): Promise<Group> {
    const group = await this.getById(id);
    if (input.name !== undefined) group.setName(input.name);
    if (input.description !== undefined) group.setDescription(input.description ?? undefined);
    if (input.isActive !== undefined) {
      if (input.isActive) group.activate();
      else group.deactivate();
    }
    await this.repo.save(group);
    return group;
  }

  /** Soft-Delete: die Gruppe bleibt erhalten, wird nur deaktiviert. */
  async deactivate(id: string): Promise<void> {
    const group = await this.getById(id);
    group.deactivate();
    await this.repo.save(group);
  }

  async addMember(groupId: string, memberId: string): Promise<void> {
    const group = await this.getById(groupId);
    group.addMember(MemberId.fromString(memberId));
    await this.repo.save(group);
  }

  async removeMember(groupId: string, memberId: string): Promise<void> {
    const group = await this.getById(groupId);
    group.removeMember(MemberId.fromString(memberId));
    await this.repo.save(group);
  }
}
