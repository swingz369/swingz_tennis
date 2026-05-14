import { eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { users, clubMemberships } from '../schema';
import type { Member } from '@/domain/repositories/member-repository.interface';
import { MemberId, ClubId } from '@/domain/value-objects';
import type { MemberRepository } from '@/domain/repositories/member-repository.interface';

export class DrizzleMemberRepository implements MemberRepository {
  async findById(id: MemberId): Promise<Member | null> {
    const db = getDb();
    const result = await db.select().from(users).where(eq(users.id, id.getValue())).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByEmail(email: string): Promise<Member | null> {
    const db = getDb();
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByClub(clubId: ClubId): Promise<Member[]> {
    const db = getDb();
    const memberships = await db
      .select()
      .from(clubMemberships)
      .where(eq(clubMemberships.club_id, clubId.getValue()));
    const userIds = memberships.map((m: typeof clubMemberships.$inferSelect) => m.user_id);
    if (userIds.length === 0) return [];
    const usersData = await db.select().from(users).where(inArray(users.id, userIds));
    return usersData.map((user: typeof users.$inferSelect) => {
      const clubIds = memberships
        .filter((m: typeof clubMemberships.$inferSelect) => m.user_id === user.id)
        .map((m: typeof clubMemberships.$inferSelect) => m.club_id)
        .map(ClubId.fromString);
      return {
        id: MemberId.fromString(user.id),
        email: user.email,
        name: user.full_name || '',
        clubIds,
        joinDate: new Date(user.created_at),
        isActive: true,
      };
    });
  }

  async save(member: Member): Promise<void> {
    const db = getDb();
    const now = new Date();
    const userData = {
      id: member.id.getValue(),
      email: member.email,
      full_name: member.name,
      updated_at: now,
    };

    const existing = await this.findById(member.id);
    if (existing) {
      await db.update(users).set(userData).where(eq(users.id, member.id.getValue()));
    } else {
      await db.insert(users).values(userData);
      for (const clubId of member.clubIds) {
        await db.insert(clubMemberships).values({
          club_id: clubId.getValue(),
          user_id: member.id.getValue(),
          join_date: now,
          is_active: true,
        });
      }
    }
  }

  async exists(id: MemberId): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.id, id.getValue()));
    return result[0]?.count > 0;
  }

  async getMemberEmailAndName(id: MemberId): Promise<{ email: string; name: string } | null> {
    const db = getDb();
    const result = await db
      .select({ email: users.email, name: users.full_name })
      .from(users)
      .where(eq(users.id, id.getValue()))
      .limit(1);
    if (result.length === 0) return null;
    return {
      email: result[0].email,
      name: result[0].name || 'Mitglied',
    };
  }

  private mapToDomain(row: typeof users.$inferSelect): Member {
    return {
      id: MemberId.fromString(row.id),
      email: row.email,
      name: row.full_name || '',
      clubIds: [],
      joinDate: new Date(row.created_at),
      isActive: true,
    };
  }
}
