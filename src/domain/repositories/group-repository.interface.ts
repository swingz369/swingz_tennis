import type { Group } from '../entities/group.entity';
import type { GroupId, ClubId, MemberId } from '../value-objects';

export interface GroupRepository {
  findById(id: GroupId): Promise<Group | null>;
  findByClubId(clubId: ClubId): Promise<Group[]>;
  findByIds(ids: GroupId[]): Promise<Group[]>;
  save(group: Group): Promise<void>;
  delete(id: GroupId): Promise<void>;
  exists(id: GroupId): Promise<boolean>;

  // Member relations
  addMemberToGroup(groupId: GroupId, memberId: MemberId): Promise<void>;
  removeMemberFromGroup(groupId: GroupId, memberId: MemberId): Promise<void>;
  getMembersInGroup(groupId: GroupId): Promise<MemberId[]>;

  // Queries
  findActiveGroupsByClub(clubId: ClubId): Promise<Group[]>;
  findGroupsByMember(memberId: MemberId): Promise<Group[]>;
}
