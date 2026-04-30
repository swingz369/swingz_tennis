import { eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { courts } from '../schema';
import type { Court } from '@/domain/entities/club';
import { ClubId } from '@/domain/value-objects';
import type { CourtRepository } from '@/domain/repositories/court-repository.interface';

export class DrizzleCourtRepository implements CourtRepository {
  async findById(id: string): Promise<Court | null> {
    const result = await db.select().from(courts).where(eq(courts.id, id)).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByClub(clubId: ClubId): Promise<Court[]> {
    const result = await db.select().from(courts).where(eq(courts.club_id, clubId.getValue()));
    return result.map((row) => this.mapToDomain(row));
  }

  async save(_court: Court): Promise<void> {
    // Not implemented for MVP – courts managed via DB directly
    return;
  }

  async exists(id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(courts)
      .where(eq(courts.id, id));
    return result[0]?.count > 0;
  }

  private mapToDomain(row: typeof courts.$inferSelect): Court {
    return {
      id: row.id,
      name: row.name,
      surface: row.surface as 'hard' | 'clay' | 'grass' | 'carpet',
      hasIndoor: row.has_indoor,
      isActive: row.is_active,
    };
  }
}
