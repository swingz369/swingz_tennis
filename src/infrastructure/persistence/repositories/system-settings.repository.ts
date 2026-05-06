import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { systemSettings } from '../schema';
import type { ISystemSettingsRepository } from '@/domain/repositories/system-settings-repository.interface';
import type {
  SystemSettings,
  CreateSystemSettingsInput,
  UpdateSystemSettingsInput,
} from '@/domain/entities/system-settings.entity';
import { parsePostgresError } from '@/lib/errors/database-errors';

/**
 * Drizzle ORM implementation of the System Settings Repository
 * Manages global and club-specific configuration settings
 */
export class DrizzleSystemSettingsRepository implements ISystemSettingsRepository {
  async create(input: CreateSystemSettingsInput, clubId: string | null): Promise<SystemSettings> {
    const db = getDb();
    const now = new Date();

    try {
      const result = await db
        .insert(systemSettings)
        .values({
          club_id: clubId,
          category: input.category,
          key: input.key,
          value: input.value,
          type: input.type,
          description: input.description,
          is_public: input.isPublic ?? false,
          is_required: input.isRequired ?? false,
          validation: input.validation ?? {},
          updated_at: now,
        })
        .returning();

      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async findById(id: string): Promise<SystemSettings | null> {
    const db = getDb();
    const result = await db.select().from(systemSettings).where(eq(systemSettings.id, id)).limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByKey(key: string, clubId: string | null): Promise<SystemSettings | null> {
    const db = getDb();

    const condition = clubId
      ? and(eq(systemSettings.key, key), eq(systemSettings.club_id, clubId))
      : and(eq(systemSettings.key, key), isNull(systemSettings.club_id));

    const result = await db.select().from(systemSettings).where(condition).limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async getValue(key: string, clubId: string | null): Promise<string | null> {
    const db = getDb();

    // Use the PostgreSQL helper function
    const result = await db.execute<{ get_setting_value: string | null }>(sql`
      SELECT get_setting_value(
        ${key}::varchar,
        ${clubId}::uuid
      ) as get_setting_value
    `);

    if (!result || result.length === 0) {
      return null;
    }

    return result[0].get_setting_value;
  }

  async findAll(clubId: string | null): Promise<SystemSettings[]> {
    const db = getDb();

    const condition = clubId ? eq(systemSettings.club_id, clubId) : isNull(systemSettings.club_id);

    const result = await db
      .select()
      .from(systemSettings)
      .where(condition)
      .orderBy(systemSettings.category, systemSettings.key);

    return result.map((row) => this.mapToDomain(row));
  }

  async findByCategory(
    category: SystemSettings['category'],
    clubId: string | null
  ): Promise<SystemSettings[]> {
    const db = getDb();

    const condition = clubId
      ? and(eq(systemSettings.category, category), eq(systemSettings.club_id, clubId))
      : and(eq(systemSettings.category, category), isNull(systemSettings.club_id));

    const result = await db
      .select()
      .from(systemSettings)
      .where(condition)
      .orderBy(systemSettings.key);

    return result.map((row) => this.mapToDomain(row));
  }

  async findPublic(clubId: string | null): Promise<SystemSettings[]> {
    const db = getDb();

    const condition = clubId
      ? and(eq(systemSettings.is_public, true), eq(systemSettings.club_id, clubId))
      : and(eq(systemSettings.is_public, true), isNull(systemSettings.club_id));

    const result = await db
      .select()
      .from(systemSettings)
      .where(condition)
      .orderBy(systemSettings.category, systemSettings.key);

    return result.map((row) => this.mapToDomain(row));
  }

  async getAsObject(
    category: SystemSettings['category'] | null,
    clubId: string | null,
    publicOnly: boolean = false
  ): Promise<Record<string, any>> {
    const db = getDb();

    // Use the PostgreSQL helper function
    const result = await db.execute<{ get_settings_as_object: Record<string, any> }>(sql`
      SELECT get_settings_as_object(
        ${category}::varchar,
        ${clubId}::uuid,
        ${publicOnly}::boolean
      ) as get_settings_as_object
    `);

    if (!result || result.length === 0) {
      return {};
    }

    return result[0].get_settings_as_object || {};
  }

  async update(
    id: string,
    input: UpdateSystemSettingsInput,
    updatedBy: string
  ): Promise<SystemSettings | null> {
    const db = getDb();
    const now = new Date();

    try {
      const updateData: any = {
        updated_at: now,
        updated_by: updatedBy,
      };

      if (input.value !== undefined) updateData.value = input.value;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.isPublic !== undefined) updateData.is_public = input.isPublic;
      if (input.isRequired !== undefined) updateData.is_required = input.isRequired;
      if (input.validation !== undefined) updateData.validation = input.validation;

      const result = await db
        .update(systemSettings)
        .set(updateData)
        .where(eq(systemSettings.id, id))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async delete(id: string): Promise<boolean> {
    const db = getDb();

    try {
      const result = await db.delete(systemSettings).where(eq(systemSettings.id, id)).returning();

      return result.length > 0;
    } catch (error) {
      // The trigger will prevent deletion of required settings
      throw parsePostgresError(error);
    }
  }

  /**
   * Map database row to domain entity
   */
  private mapToDomain(row: typeof systemSettings.$inferSelect): SystemSettings {
    return {
      id: row.id,
      category: row.category as
        | 'general'
        | 'email'
        | 'notifications'
        | 'security'
        | 'integrations'
        | 'other',
      key: row.key,
      value: row.value,
      type: row.type as 'string' | 'number' | 'boolean' | 'json' | 'array',
      description: row.description ?? undefined,
      isPublic: row.is_public,
      isRequired: row.is_required,
      validation: row.validation as
        | {
            min?: number;
            max?: number;
            pattern?: string;
            enum?: string[];
          }
        | undefined,
      updatedAt: row.updated_at.toISOString(),
      updatedBy: row.updated_by ?? undefined,
    };
  }
}
