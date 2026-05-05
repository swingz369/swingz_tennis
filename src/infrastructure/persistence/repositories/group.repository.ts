import { eq, inArray, sql, and, gte, lte } from 'drizzle-orm';
import { getDb } from '../client';
import { groups } from '../schema';
import type { Group } from '@/domain/entities/group.entity';
import { GroupEntity } from '@/domain/entities/group.entity';
import { GroupId, ClubId, MemberId } from '@/domain/value-objects';
import type { GroupRepository } from '@/domain/repositories/group-repository.interface';
import type { MemberId as DomainMemberId } from '@/domain/value-objects/ids';

export class DrizzleGroupRepository implements GroupRepository {
  async findById(id: GroupId): Promise<Group | null> {
    const db = getDb();
    const result = await db.select().from(groups).where(eq(groups.id, id.getValue())).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByClubId(clubId: ClubId): Promise<Group[]> {
    const db = getDb();
    const result = await db.select().from(groups).where(eq(groups.club_id, clubId.getValue()));
    return result.map((row: typeof groups.$inferSelect) => this.mapToDomain(row));
  }

  async findByIds(ids: GroupId[]): Promise<Group[]> {
    if (ids.length === 0) return [];
    const db = getDb();
    const idValues = ids.map((id) => id.getValue());
    const result = await db.select().from(groups).where(inArray(groups.id, idValues));
    return result.map((row: typeof groups.$inferSelect) => this.mapToDomain(row));
  }

  async save(group: Group): Promise<void> {
    const db = getDb();
    const now = new Date();
    const values = {
      id: group.getId().getValue(),
      club_id: group.getClubId().getValue(),
      name: group.getName(),
      description: group.getDescription() || null,
      level: group.getLevel(),
      age_group: group.getAgeGroup(),
      is_active: group.getIsActive(),
      member_ids: group.getMemberIds().map((id) => id.getValue()),
      updated_at: now,
    };

    const existing = await this.findById(group.getId());
    if (existing) {
      await db.update(groups).set(values).where(eq(groups.id, group.getId().getValue()));
    } else {
      await db.insert(groups).values({
        ...values,
        created_at: now,
      });
    }
  }

  async delete(id: GroupId): Promise<void> {
    const db = getDb();
    await db.delete(groups).where(eq(groups.id, id.getValue()));
  }

  async exists(id: GroupId): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(groups)
      .where(eq(groups.id, id.getValue()));
    return result[0]?.count > 0;
  }

  async addMemberToGroup(groupId: GroupId, memberId: MemberId): Promise<void> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    group.addMember(memberId);
    await this.save(group);
  }

  async removeMemberFromGroup(groupId: GroupId, memberId: MemberId): Promise<void> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    group.removeMember(memberId);
    await this.save(group);
  }

  async getMembersInGroup(groupId: GroupId): Promise<MemberId[]> {
    const group = await this.findById(groupId);
    if (!group) {
      return [];
    }
    return group.getMemberIds();
  }

  async findActiveGroupsByClub(clubId: ClubId): Promise<Group[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(groups)
      .where(and(eq(groups.club_id, clubId.getValue()), eq(groups.is_active, true)));
    return result.map((row: typeof groups.$inferSelect) => this.mapToDomain(row));
  }

  async findGroupsByMember(memberId: MemberId): Promise<Group[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(groups)
      .where(sql`${groups.member_ids} @> ${[memberId.getValue()]}`);
    return result.map((row: typeof groups.$inferSelect) => this.mapToDomain(row));
  }

  private mapToDomain(row: typeof groups.$inferSelect): Group {
    const memberIds: MemberId[] =
      (row.member_ids as string[] | null)?.map((id) => MemberId.fromString(id)) || [];
    return GroupEntity.reconstitute(
      GroupId.fromString(row.id),
      ClubId.fromString(row.club_id),
      row.name,
      row.level as Group['level'],
      row.age_group as Group['ageGroup'],
      row.description || undefined,
      row.is_active,
      memberIds,
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}
