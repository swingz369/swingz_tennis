/**
 * Mitglieder-Teildomäne "Abrechnungslauf" für ADR-005 (Domäne Abrechnung,
 * Teil 2, Saison-Schnitt). Ein Repository für alle Lesezugriffe, die
 * `SeasonBillingService.calculatePreview`/`generateInvoices` für die
 * Saison-Rechnungsberechnung braucht, plus den atomaren RPC-Aufruf für die
 * eigentlichen Schreiboperationen — kein Adapter, keine Interfaces, Muster
 * in docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md § 6.
 *
 * Ersetzt den Service-Client-Zugriff in `lib/billing/season-billing.service.ts`
 * (Singleton auf `createServiceClient()`, kein RLS) durch `getUserDb(auth)`.
 * Live-RLS auf allen hier gelesenen Tabellen (seasons, season_billing_configs,
 * season_group_weeks, season_plan_entries, sessions, trainers,
 * trainer_profiles, groups, users, fee_configurations) per pg_policies
 * geprüft (14.09.2026) — Admin/Superadmin des Clubs kommt überall über
 * is_club_admin(club_id) oder eine äquivalente Mitgliedschaftsprüfung durch.
 *
 * Die eigentliche Rechnungserzeugung läuft über die SECURITY DEFINER-Funktion
 * `generate_season_invoices_atomic` — die prüfte bislang selbst nicht, ob der
 * Aufrufer Admin des übergebenen Clubs ist (Migration
 * 20260914120000_generate_season_invoices_atomic_auth_check.sql trägt den
 * Check nach). getUserDb(auth) reicht hier trotzdem: der App-Layer
 * (SeasonBillingService.generateInvoices) prüft vorher ohnehin per
 * authorizeSeasonAccess/verifyRole, und is_club_admin() im RPC-Körper braucht
 * kein Service-Client-Privileg, nur `auth.uid()` aus dem Session-JWT.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:season-billing.repository');

export type SeasonBillingConfigRow = Tables<'season_billing_configs'>;
export type SeasonRow = Pick<
  Tables<'seasons'>,
  'id' | 'name' | 'club_id' | 'start_date' | 'end_date'
>;
export type PlanEntryRow = Pick<
  Tables<'season_plan_entries'>,
  | 'id'
  | 'group_id'
  | 'trainer_id'
  | 'duration_minutes'
  | 'expected_participants'
  | 'starts_from_week'
  | 'ends_at_week'
  | 'day_of_week'
  | 'start_time'
  | 'end_time'
  | 'sessions_per_week'
>;

export type RpcInvoicePayload = {
  member_id: string;
  due_date: string;
  notes: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    item_type: string;
  }>;
};

export type RpcResult = {
  created: Array<{
    member_id: string;
    invoice_id: string;
    invoice_number: string;
    total_amount: number;
  }>;
  skipped: Array<{ member_id: string }>;
  failed: Array<{ member_id: string; error: string }>;
};

export class SeasonBillingRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async getSeason(seasonId: string): Promise<SeasonRow | null> {
    const { data, error } = await this.db
      .from('seasons')
      .select('id, name, club_id, start_date, end_date')
      .eq('id', seasonId)
      .single();
    if (error) return null;
    return data;
  }

  async getConfig(seasonId: string): Promise<SeasonBillingConfigRow | null> {
    const { data } = await this.db
      .from('season_billing_configs')
      .select('*')
      .eq('season_id', seasonId)
      .maybeSingle();
    return data;
  }

  async upsertConfig(
    seasonId: string,
    clubId: string,
    config: Record<string, unknown>
  ): Promise<SeasonBillingConfigRow> {
    const { data, error } = await this.db
      .from('season_billing_configs')
      .upsert({ season_id: seasonId, club_id: clubId, ...config } as never, {
        onConflict: 'season_id',
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to upsert billing config: ${error.message}`);
    return data;
  }

  /** Degradiert bei fehlender Tabelle/Feature (leere Map = alles aktiv). */
  async loadInactiveWeeks(seasonId: string): Promise<Map<string, Set<string>>> {
    const map = new Map<string, Set<string>>();
    try {
      const { data, error } = await this.db
        .from('season_group_weeks')
        .select('group_id, week_monday, is_active')
        .eq('season_id', seasonId)
        .eq('is_active', false);

      if (error) {
        if (error.message.toLowerCase().includes('does not exist')) return map;
        log.warn('Inaktive Wochen nicht lesbar', { message: error.message });
        return map;
      }
      for (const row of data ?? []) {
        if (!row.group_id) continue;
        if (!map.has(row.group_id)) map.set(row.group_id, new Set());
        map.get(row.group_id)!.add(row.week_monday);
      }
    } catch (err) {
      log.warn('Inaktive Wochen: Ausnahme, nehme alles aktiv an', { err: String(err) });
    }
    return map;
  }

  async getPlanEntries(seasonId: string): Promise<PlanEntryRow[]> {
    const { data } = await this.db
      .from('season_plan_entries')
      .select(
        'id, group_id, trainer_id, duration_minutes, expected_participants, starts_from_week, ends_at_week, day_of_week, start_time, end_time, sessions_per_week'
      )
      .eq('season_id', seasonId);
    return data ?? [];
  }

  /** Anzahl tatsächlich veröffentlichter Einheiten je Planeintrag. */
  async getPublishedSessionCounts(planEntryIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (planEntryIds.length === 0) return counts;
    const { data, error } = await this.db
      .from('sessions')
      .select('plan_entry_id')
      .in('plan_entry_id', planEntryIds);
    if (error) {
      log.warn('Veröffentlichte Einheiten nicht lesbar, rechne mit der Wochenschätzung', {
        message: error.message,
      });
      return counts;
    }
    for (const row of data ?? []) {
      if (!row.plan_entry_id) continue;
      counts.set(row.plan_entry_id, (counts.get(row.plan_entry_id) ?? 0) + 1);
    }
    return counts;
  }

  async getTrainers(
    trainerIds: string[]
  ): Promise<Array<{ id: string; name: string; user_id: string | null }>> {
    if (trainerIds.length === 0) return [];
    const { data } = await this.db
      .from('trainers')
      .select('id, name, user_id')
      .in('id', trainerIds);
    return data ?? [];
  }

  async getTrainerProfileRates(userIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (userIds.length === 0) return map;
    const { data } = await this.db
      .from('trainer_profiles')
      .select('user_id, hourly_rate')
      .in('user_id', userIds);
    for (const p of data ?? []) {
      if (p.hourly_rate) map.set(p.user_id, Number(p.hourly_rate));
    }
    return map;
  }

  async getGroupNames(groupIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (groupIds.length === 0) return map;
    const { data } = await this.db.from('groups').select('id, name').in('id', groupIds);
    for (const g of data ?? []) map.set(g.id, g.name);
    return map;
  }

  async getUsers(
    userIds: string[]
  ): Promise<Array<{ id: string; full_name: string | null; date_of_birth: string | null }>> {
    if (userIds.length === 0) return [];
    const { data } = await this.db
      .from('users')
      .select('id, full_name, date_of_birth')
      .in('id', userIds);
    return data ?? [];
  }

  /** Degradiert ohne Familien-Feature (leere Arrays = keine Zusammenfassung). */
  async getFamilyLinksByUser(
    userIds: string[]
  ): Promise<Array<{ user_id: string; family_group_id: string }>> {
    if (userIds.length === 0) return [];
    const { data } = await this.db
      .from('family_accounts')
      .select('user_id, family_group_id')
      .in('user_id', userIds);
    return data ?? [];
  }

  async getFamilyMembersByGroup(
    groupIds: string[]
  ): Promise<Array<{ user_id: string; family_group_id: string; relationship: string | null }>> {
    if (groupIds.length === 0) return [];
    const { data } = await this.db
      .from('family_accounts')
      .select('user_id, family_group_id, relationship')
      .in('family_group_id', groupIds);
    return data ?? [];
  }

  async getActiveMembershipFee(clubId: string): Promise<number | null> {
    const { data } = await this.db
      .from('fee_configurations')
      .select('amount')
      .eq('club_id', clubId)
      .eq('type', 'membership')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? Number(data.amount) : null;
  }

  async getExistingSeasonInvoiceMemberIds(clubId: string, seasonId: string): Promise<Set<string>> {
    const { data, error } = await this.db
      .from('invoices')
      .select('member_id')
      .eq('club_id', clubId)
      .eq('invoice_type', 'season')
      .eq('season_id', seasonId);
    if (error) throw new Error(`Failed to check existing invoices: ${error.message}`);
    return new Set(
      (data ?? []).map((inv) => inv.member_id).filter((id): id is string => Boolean(id))
    );
  }

  /** Verwirft offene (draft) Saison-Rechnungen — für ein erneutes Publish. */
  async discardDraftSeasonInvoices(clubId: string, seasonId: string): Promise<number> {
    const { data, error } = await this.db
      .from('invoices')
      .delete()
      .eq('club_id', clubId)
      .eq('season_id', seasonId)
      .eq('invoice_type', 'season')
      .eq('status', 'draft')
      .select('id');
    if (error) {
      log.error('Entwurfs-Rechnungen nicht verworfen', new Error(error.message));
      return 0;
    }
    return data?.length ?? 0;
  }

  /**
   * Ruft die atomare RPC auf. Gibt `null` zurück, wenn die Funktion (noch)
   * nicht deployt ist (42883/PGRST202) oder ein anderer RPC-Fehler auftrat —
   * der Aufrufer fällt dann auf die Legacy-Schleife zurück.
   */
  async generateInvoicesAtomic(
    seasonId: string,
    clubId: string,
    payload: RpcInvoicePayload[]
  ): Promise<RpcResult | null> {
    try {
      const { data, error } = await this.db.rpc('generate_season_invoices_atomic', {
        p_season_id: seasonId,
        p_club_id: clubId,
        p_invoices: payload as never,
      });

      if (error) {
        const code = (error as { code?: string }).code;
        if (code === '42883' || code === 'PGRST202') {
          log.warn('Atomic RPC nicht verfügbar, falle auf Legacy-Schleife zurück', {
            message: error.message,
          });
          return null;
        }
        log.error('Atomic-RPC-Fehler, falle auf Legacy-Schleife zurück', new Error(error.message));
        return null;
      }

      return data as unknown as RpcResult;
    } catch (err) {
      log.error(
        'Atomic-RPC-Ausnahme, falle auf Legacy-Schleife zurück',
        err instanceof Error ? err : new Error(String(err))
      );
      return null;
    }
  }

  async createInvoice(input: TablesInsert<'invoices'>): Promise<Tables<'invoices'>> {
    const { data, error } = await this.db.from('invoices').insert(input).select().single();
    if (error) throw new Error(`Failed to create invoice: ${error.message}`);
    return data;
  }

  async createInvoiceItems(items: TablesInsert<'invoice_items'>[]): Promise<void> {
    if (items.length === 0) return;
    const { error } = await this.db.from('invoice_items').insert(items);
    if (error) throw new Error(`Failed to create invoice items: ${error.message}`);
  }
}
