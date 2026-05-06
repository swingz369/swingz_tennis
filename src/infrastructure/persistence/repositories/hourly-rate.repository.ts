import { eq, and, lte, gte, desc } from 'drizzle-orm';
import { db } from '../db';
import { hourlyRateTiers, trainerHourlyRates, rateHistory } from '../schema';
import type {
  HourlyRateTier,
  TrainerHourlyRate,
  RateHistoryEntry,
  CreateHourlyRateTierInput,
  UpdateHourlyRateTierInput,
  CreateTrainerHourlyRateInput,
  UpdateTrainerHourlyRateInput,
} from '../../../domain/entities/hourly-rate.entity';
import type {
  IHourlyRateTierRepository,
  ITrainerHourlyRateRepository,
  IRateHistoryRepository,
} from '../../../domain/repositories/hourly-rate-repository.interface';

/**
 * Hourly Rate Tier Repository
 */
export class HourlyRateTierRepository implements IHourlyRateTierRepository {
  async create(input: CreateHourlyRateTierInput): Promise<HourlyRateTier> {
    try {
      const now = new Date().toISOString();
      const [tier] = await db
        .insert(hourlyRateTiers)
        .values({
          name: input.name,
          description: input.description,
          baseRate: input.baseRate.toString(),
          trainingTypes: input.trainingTypes,
          experienceLevel: input.experienceLevel,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!tier) throw new Error('Failed to create hourly rate tier');
      return this.mapToEntity(tier);
    } catch (error) {
      console.error('Error creating hourly rate tier:', error);
      throw new Error(
        `Failed to create hourly rate tier: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findById(id: string): Promise<HourlyRateTier | null> {
    try {
      const [tier] = await db
        .select()
        .from(hourlyRateTiers)
        .where(eq(hourlyRateTiers.id, id))
        .limit(1);
      return tier ? this.mapToEntity(tier) : null;
    } catch (error) {
      console.error('Error finding hourly rate tier:', error);
      throw new Error(
        `Failed to find hourly rate tier: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findAll(): Promise<HourlyRateTier[]> {
    try {
      const tiers = await db
        .select()
        .from(hourlyRateTiers)
        .orderBy(desc(hourlyRateTiers.createdAt));
      return tiers.map((t) => this.mapToEntity(t));
    } catch (error) {
      console.error('Error finding all hourly rate tiers:', error);
      throw new Error(
        `Failed to find hourly rate tiers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findActive(): Promise<HourlyRateTier[]> {
    try {
      const tiers = await db
        .select()
        .from(hourlyRateTiers)
        .where(eq(hourlyRateTiers.isActive, true))
        .orderBy(desc(hourlyRateTiers.createdAt));
      return tiers.map((t) => this.mapToEntity(t));
    } catch (error) {
      console.error('Error finding active hourly rate tiers:', error);
      throw new Error(
        `Failed to find active tiers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findByClubId(clubId: string): Promise<HourlyRateTier[]> {
    try {
      const tiers = await db
        .select()
        .from(hourlyRateTiers)
        .where(eq(hourlyRateTiers.club_id, clubId))
        .orderBy(desc(hourlyRateTiers.createdAt));
      return tiers.map((t) => this.mapToEntity(t));
    } catch (error) {
      console.error('Error finding hourly rate tiers by club:', error);
      throw new Error(
        `Failed to find tiers by club: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async update(id: string, input: UpdateHourlyRateTierInput): Promise<HourlyRateTier | null> {
    try {
      const updateData: any = { updatedAt: new Date().toISOString() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.baseRate !== undefined) updateData.baseRate = input.baseRate.toString();
      if (input.trainingTypes !== undefined) updateData.trainingTypes = input.trainingTypes;
      if (input.experienceLevel !== undefined) updateData.experienceLevel = input.experienceLevel;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const [updated] = await db
        .update(hourlyRateTiers)
        .set(updateData)
        .where(eq(hourlyRateTiers.id, id))
        .returning();
      return updated ? this.mapToEntity(updated) : null;
    } catch (error) {
      console.error('Error updating hourly rate tier:', error);
      throw new Error(
        `Failed to update tier: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await db.delete(hourlyRateTiers).where(eq(hourlyRateTiers.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting hourly rate tier:', error);
      throw new Error(
        `Failed to delete tier: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private mapToEntity(row: typeof hourlyRateTiers.$inferSelect): HourlyRateTier {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      baseRate: parseFloat(row.baseRate),
      trainingTypes: (row.trainingTypes as string[]) || [],
      experienceLevel: row.experienceLevel as HourlyRateTier['experienceLevel'],
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

/**
 * Trainer Hourly Rate Repository
 */
export class TrainerHourlyRateRepository implements ITrainerHourlyRateRepository {
  private historyRepo = new RateHistoryRepository();

  async create(input: CreateTrainerHourlyRateInput): Promise<TrainerHourlyRate> {
    try {
      const now = new Date().toISOString();
      const effectiveRate = input.overrideRate || input.baseRate;

      const [rate] = await db
        .insert(trainerHourlyRates)
        .values({
          trainerId: input.trainerId,
          trainerName: input.trainerName,
          baseRate: input.baseRate.toString(),
          overrideRate: input.overrideRate?.toString(),
          effectiveRate: effectiveRate.toString(),
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          reason: input.reason,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!rate) throw new Error('Failed to create trainer hourly rate');
      return this.mapToEntity(rate);
    } catch (error) {
      console.error('Error creating trainer hourly rate:', error);
      throw new Error(
        `Failed to create trainer rate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findById(id: string): Promise<TrainerHourlyRate | null> {
    try {
      const [rate] = await db
        .select()
        .from(trainerHourlyRates)
        .where(eq(trainerHourlyRates.id, id))
        .limit(1);
      return rate ? this.mapToEntity(rate) : null;
    } catch (error) {
      console.error('Error finding trainer hourly rate:', error);
      throw new Error(
        `Failed to find trainer rate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findByTrainerId(trainerId: string): Promise<TrainerHourlyRate | null> {
    try {
      const now = new Date().toISOString();
      const [rate] = await db
        .select()
        .from(trainerHourlyRates)
        .where(
          and(
            eq(trainerHourlyRates.trainerId, trainerId),
            lte(trainerHourlyRates.validFrom, now)
            // Valid until is null OR >= now
            // We'll handle this in application logic for simplicity
          )
        )
        .orderBy(desc(trainerHourlyRates.validFrom))
        .limit(1);

      if (!rate) return null;

      // Check validUntil in application logic
      if (rate.validUntil && rate.validUntil < now) {
        return null;
      }

      return this.mapToEntity(rate);
    } catch (error) {
      console.error('Error finding trainer rate by trainer ID:', error);
      throw new Error(
        `Failed to find trainer rate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findAll(): Promise<TrainerHourlyRate[]> {
    try {
      const rates = await db
        .select()
        .from(trainerHourlyRates)
        .orderBy(desc(trainerHourlyRates.createdAt));
      return rates.map((r) => this.mapToEntity(r));
    } catch (error) {
      console.error('Error finding all trainer hourly rates:', error);
      throw new Error(
        `Failed to find trainer rates: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findByClubId(clubId: string): Promise<TrainerHourlyRate[]> {
    try {
      const rates = await db
        .select()
        .from(trainerHourlyRates)
        .where(eq(trainerHourlyRates.club_id, clubId))
        .orderBy(desc(trainerHourlyRates.createdAt));
      return rates.map((r) => this.mapToEntity(r));
    } catch (error) {
      console.error('Error finding trainer rates by club:', error);
      throw new Error(
        `Failed to find trainer rates: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async update(id: string, input: UpdateTrainerHourlyRateInput): Promise<TrainerHourlyRate | null> {
    try {
      // Get existing rate to check for changes
      const existing = await this.findById(id);
      if (!existing) return null;

      const oldRate = existing.effectiveRate;
      const newEffectiveRate = input.overrideRate ?? existing.baseRate;

      const [updated] = await db
        .update(trainerHourlyRates)
        .set({
          overrideRate: input.overrideRate?.toString(),
          effectiveRate: newEffectiveRate.toString(),
          validUntil: input.validUntil,
          reason: input.reason,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(trainerHourlyRates.id, id))
        .returning();

      if (!updated) return null;

      // Add to history if rate changed
      if (newEffectiveRate !== oldRate) {
        await this.historyRepo.addEntry({
          trainerId: existing.trainerId,
          trainerName: existing.trainerName,
          oldRate,
          newRate: newEffectiveRate,
          changedBy: 'Admin',
          reason: input.reason,
        });
      }

      return this.mapToEntity(updated);
    } catch (error) {
      console.error('Error updating trainer hourly rate:', error);
      throw new Error(
        `Failed to update trainer rate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(trainerHourlyRates)
        .where(eq(trainerHourlyRates.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting trainer hourly rate:', error);
      throw new Error(
        `Failed to delete trainer rate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async calculateEffectiveRate(trainerId: string): Promise<number | null> {
    const rate = await this.findByTrainerId(trainerId);
    return rate ? rate.effectiveRate : null;
  }

  private mapToEntity(row: typeof trainerHourlyRates.$inferSelect): TrainerHourlyRate {
    return {
      id: row.id,
      trainerId: row.trainerId,
      trainerName: row.trainerName,
      baseRate: parseFloat(row.baseRate),
      overrideRate: row.overrideRate ? parseFloat(row.overrideRate) : undefined,
      effectiveRate: parseFloat(row.effectiveRate),
      validFrom: row.validFrom.toISOString(),
      validUntil: row.validUntil?.toISOString() ?? undefined,
      reason: row.reason ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

/**
 * Rate History Repository
 */
export class RateHistoryRepository implements IRateHistoryRepository {
  async addEntry(entry: Omit<RateHistoryEntry, 'id' | 'changedAt'>): Promise<RateHistoryEntry> {
    try {
      const now = new Date().toISOString();
      const [historyEntry] = await db
        .insert(rateHistory)
        .values({
          trainerId: entry.trainerId,
          trainerName: entry.trainerName,
          oldRate: entry.oldRate.toString(),
          newRate: entry.newRate.toString(),
          changedAt: now,
          changedBy: entry.changedBy,
          reason: entry.reason,
        })
        .returning();

      if (!historyEntry) throw new Error('Failed to add rate history entry');
      return this.mapToEntity(historyEntry);
    } catch (error) {
      console.error('Error adding rate history entry:', error);
      throw new Error(
        `Failed to add history entry: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findByTrainerId(trainerId: string): Promise<RateHistoryEntry[]> {
    try {
      const entries = await db
        .select()
        .from(rateHistory)
        .where(eq(rateHistory.trainerId, trainerId))
        .orderBy(desc(rateHistory.changedAt));
      return entries.map((e) => this.mapToEntity(e));
    } catch (error) {
      console.error('Error finding rate history by trainer:', error);
      throw new Error(
        `Failed to find rate history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findAll(): Promise<RateHistoryEntry[]> {
    try {
      const entries = await db.select().from(rateHistory).orderBy(desc(rateHistory.changedAt));
      return entries.map((e) => this.mapToEntity(e));
    } catch (error) {
      console.error('Error finding all rate history:', error);
      throw new Error(
        `Failed to find rate history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findByClubId(clubId: string): Promise<RateHistoryEntry[]> {
    try {
      const entries = await db
        .select()
        .from(rateHistory)
        .where(eq(rateHistory.club_id, clubId))
        .orderBy(desc(rateHistory.changedAt));
      return entries.map((e) => this.mapToEntity(e));
    } catch (error) {
      console.error('Error finding rate history by club:', error);
      throw new Error(
        `Failed to find rate history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private mapToEntity(row: typeof rateHistory.$inferSelect): RateHistoryEntry {
    return {
      id: row.id,
      trainerId: row.trainerId,
      trainerName: row.trainerName,
      oldRate: parseFloat(row.oldRate),
      newRate: parseFloat(row.newRate),
      changedAt: row.changedAt.toISOString(),
      changedBy: row.changedBy,
      reason: row.reason ?? undefined,
    };
  }
}
