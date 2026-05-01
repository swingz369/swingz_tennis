import { eq, inArray, sql, and, gte, lt } from 'drizzle-orm';
import { getDb } from '../client';
import { clubs, userClubMemberships } from '../schema';
import { Club } from '@/domain/entities/club';
import { ClubId, MemberId } from '@/domain/value-objects';
import type { ClubRepository } from '@/domain/repositories/club-repository.interface';

export class DrizzleClubRepository implements ClubRepository {
  async findById(id: ClubId): Promise<Club | null> {
    const db = getDb();
    const result = await db.select().from(clubs).where(eq(clubs.id, id.getValue())).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByName(name: string): Promise<Club | null> {
    const db = getDb();
    const result = await db.select().from(clubs).where(eq(clubs.name, name)).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async save(club: Club): Promise<void> {
    const db = getDb();
    const now = new Date();
    const clubData = {
      id: club.getId().getValue(),
      name: club.getName(),
      max_members: club.getMaxMembers(),
      opening_hours: club.getOpeningHours(),
      status: club.getStatus(),
      updated_at: now,
    };

    const existing = await this.findById(club.getId());
    if (existing) {
      await db.update(clubs).set(clubData).where(eq(clubs.id, club.getId().getValue()));
    } else {
      await db.insert(clubs).values(clubData);
    }
  }

  async delete(id: ClubId): Promise<void> {
    const db = getDb();
    await db.delete(clubs).where(eq(clubs.id, id.getValue()));
  }

  async findAll(): Promise<Club[]> {
    const db = getDb();
    const result = await db.select().from(clubs).orderBy(clubs.created_at);
    return result.map((row: typeof clubs.$inferSelect) => this.mapToDomain(row));
  }

  async findByMemberId(memberId: MemberId): Promise<Club[]> {
    const db = getDb();
    const memberships = await db
      .select()
      .from(userClubMemberships)
      .where(eq(userClubMemberships.user_id, memberId.getValue()));
    const clubIds = memberships.map((r: typeof userClubMemberships.$inferSelect) => r.club_id);
    if (clubIds.length === 0) return [];
    const clubsData = await db.select().from(clubs).where(inArray(clubs.id, clubIds));
    return clubsData.map((row: typeof clubs.$inferSelect) => this.mapToDomain(row));
  }

  async exists(id: ClubId): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(clubs)
      .where(eq(clubs.id, id.getValue()));
    return result[0]?.count > 0;
  }

  async getMemberStats(
    clubId: ClubId,
    startDate: Date,
    endDate: Date
  ): Promise<{ total: number; new: number; active: number }> {
    const db = getDb();
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userClubMemberships)
      .where(eq(userClubMemberships.club_id, clubId.getValue()));
    const newResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userClubMemberships)
      .where(
        and(
          eq(userClubMemberships.club_id, clubId.getValue()),
          gte(userClubMemberships.joined_at, startDate),
          lt(userClubMemberships.joined_at, endDate)
        )
      );
    const activeResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userClubMemberships)
      .where(
        and(
          eq(userClubMemberships.club_id, clubId.getValue()),
          eq(userClubMemberships.is_active, true)
        )
      );

    return {
      total: Number(totalResult[0]?.count) || 0,
      new: Number(newResult[0]?.count) || 0,
      active: Number(activeResult[0]?.count) || 0,
    };
  }

  async getMemberGrowthHistory(
    clubId: ClubId,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ month: string; count: number }>> {
    const db = getDb();
    const result = await db
      .select({
        month: sql<Date>`date_trunc('month', ${userClubMemberships.joined_at})`,
        count: sql<number>`count(*)`,
      })
      .from(userClubMemberships)
      .where(
        and(
          eq(userClubMemberships.club_id, clubId.getValue()),
          gte(userClubMemberships.joined_at, startDate),
          lt(userClubMemberships.joined_at, endDate),
          eq(userClubMemberships.is_active, true)
        )
      )
      .groupBy(sql`date_trunc('month', ${userClubMemberships.joined_at})`)
      .orderBy(sql`date_trunc('month', ${userClubMemberships.joined_at})`);

    return result.map((row: { month: Date; count: number }) => ({
      month: this.formatMonth(row.month),
      count: Number(row.count) || 0,
    }));
  }

  private formatMonth(date: Date): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private mapToDomain(row: typeof clubs.$inferSelect): Club {
    return Club.reconstitute(
      ClubId.fromString(row.id),
      row.name,
      [],
      [],
      [],
      row.max_members,
      row.opening_hours,
      row.status as Club['status'],
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}
