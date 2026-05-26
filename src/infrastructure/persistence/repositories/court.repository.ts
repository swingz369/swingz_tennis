import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { courts } from '../schema';
import type { Court } from '@/domain/entities/club';
import type { ClubId } from '@/domain/value-objects';
import type { CourtRepository } from '@/domain/repositories/court-repository.interface';
import { parsePostgresError } from '@/lib/errors/database-errors';

export class DrizzleCourtRepository implements CourtRepository {
  async findById(id: string): Promise<Court | null> {
    const result = await db.select().from(courts).where(eq(courts.id, id)).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByClub(clubId: ClubId): Promise<Court[]> {
    const result = await db.select().from(courts).where(eq(courts.club_id, clubId.getValue()));
    return result.map((row: typeof courts.$inferSelect) => this.mapToDomain(row));
  }

  async save(court: Court): Promise<void> {
    // Note: insert requires a club_id which the Court domain entity doesn't carry.
    // In practice, courts are always created via the API layer which provides club context.
    // For the update path, club_id is already stored and not needed.
    try {
      const exists = await this.exists(court.id);
      if (exists) {
        await db
          .update(courts)
          .set({
            name: court.name,
            surface: court.surface ?? 'hard',
            has_indoor: court.hasIndoor ?? false,
            is_active: court.isActive ?? true,
          })
          .where(eq(courts.id, court.id));
      } else {
        // Insert path: club_id is required but not available from Court domain object.
        // This path is not used in practice — courts are created via direct DB operations
        // or through higher-level service methods that pass the club context.
        throw new Error(
          'Cannot insert court without club_id. Use createCourt(clubId, courtData) instead.'
        );
      }
    } catch (error) {
      throw parsePostgresError(error);
    }
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
