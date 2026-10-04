/**
 * Gebührenkategorien (ADR-005). Supabase-Client mit Nutzer-Token — RLS
 * (`is_club_admin`/`is_club_trainer`/aktive Kategorien für Mitglieder) trennt
 * die Vereine. Ersetzt das Drizzle-Repository samt Adapter, dessen
 * `clubId = ''`-Default PATCH/DELETE in `/api/fee-configurations/[id]` auf
 * `WHERE club_id = ''` laufen ließ (500 für jeden Verein).
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesUpdate } from '@/types/supabase';
import type {
  FeeConfiguration,
  CreateFeeConfigurationInput,
  UpdateFeeConfigurationInput,
} from '@/domain/entities/fee-configuration.entity';
import { parsePostgresError } from '@/lib/errors/database-errors';

type Row = Tables<'fee_configurations'>;

/** Die API liefert camelCase (Vertrag mit `fee-categories-client.tsx`). */
function toDomain(row: Row): FeeConfiguration {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    type: row.type as FeeConfiguration['type'],
    amount: Number(row.amount),
    currency: row.currency,
    billingCycle: row.billing_cycle as FeeConfiguration['billingCycle'],
    isActive: row.is_active,
    validFrom: row.valid_from?.slice(0, 10),
    validUntil: row.valid_until?.slice(0, 10),
    conditions: (row.conditions ?? undefined) as FeeConfiguration['conditions'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class FeeConfigurationRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(input: CreateFeeConfigurationInput, clubId: string): Promise<FeeConfiguration> {
    const { data, error } = await this.db
      .from('fee_configurations')
      .insert({
        club_id: clubId,
        name: input.name,
        description: input.description,
        type: input.type,
        amount: input.amount,
        currency: input.currency ?? 'EUR',
        billing_cycle: input.billingCycle,
        is_active: true,
        valid_from: input.validFrom || null,
        valid_until: input.validUntil || null,
        conditions: input.conditions ?? {},
      })
      .select()
      .single();
    if (error) throw parsePostgresError(error);
    return toDomain(data);
  }

  async findById(id: string): Promise<FeeConfiguration | null> {
    const { data, error } = await this.db
      .from('fee_configurations')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (error) throw parsePostgresError(error);
    return data ? toDomain(data) : null;
  }

  async list(
    clubId: string,
    filter: { type?: string; billingCycle?: string } = {}
  ): Promise<FeeConfiguration[]> {
    let query = this.db.from('fee_configurations').select().eq('club_id', clubId);
    if (filter.type) query = query.eq('type', filter.type);
    if (filter.billingCycle) query = query.eq('billing_cycle', filter.billingCycle);
    const { data, error } = await query.order('created_at', { ascending: false }).order('id');
    if (error) throw parsePostgresError(error);
    return (data ?? []).map(toDomain);
  }

  async listActive(clubId: string): Promise<FeeConfiguration[]> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.db
      .from('fee_configurations')
      .select()
      .eq('club_id', clubId)
      .eq('is_active', true)
      .or(`valid_from.is.null,valid_from.lte.${today}`)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order('created_at', { ascending: false })
      .order('id');
    if (error) throw parsePostgresError(error);
    return (data ?? []).map(toDomain);
  }

  async update(id: string, input: UpdateFeeConfigurationInput): Promise<FeeConfiguration | null> {
    const patch: TablesUpdate<'fee_configurations'> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.type !== undefined) patch.type = input.type;
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.billingCycle !== undefined) patch.billing_cycle = input.billingCycle;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.validFrom !== undefined) patch.valid_from = input.validFrom || null;
    if (input.validUntil !== undefined) patch.valid_until = input.validUntil || null;
    if (input.conditions !== undefined) patch.conditions = input.conditions;

    const { data, error } = await this.db
      .from('fee_configurations')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw parsePostgresError(error);
    return data ? toDomain(data) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('fee_configurations')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw parsePostgresError(error);
    return (data ?? []).length > 0;
  }
}
