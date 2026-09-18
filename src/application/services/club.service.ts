import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb, systemDb } from '@/infrastructure/db';
import {
  ClubRepository,
  type ClubRow,
} from '@/infrastructure/persistence/repositories/club.repository';
import type { TablesUpdate } from '@/types/supabase';
import type { UpdateClubInput } from '@/application/validation/schemas';

export interface AdminSnapshot {
  email: string;
  full_name: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

/**
 * Vereins-Service (ADR-005): Stammdaten lesen/ändern, Soft- und Hard-Delete.
 * Datenzugriff über das ClubRepository mit RLS; nur Hard-Delete und der
 * Plattform-Snapshot brauchen `systemDb` (Owner-Funktionen der Whitelist).
 */
export class ClubService {
  private readonly repo: ClubRepository;

  constructor(auth: AuthContext) {
    this.repo = new ClubRepository(getUserDb(auth));
  }

  async getById(id: string): Promise<ClubRow> {
    const club = await this.repo.findById(id);
    if (!club) throw new ApiException('NOT_FOUND', 'Verein nicht gefunden');
    return club;
  }

  async getWithMemberCount(id: string): Promise<{ club: ClubRow; memberCount: number }> {
    const club = await this.getById(id);
    return { club, memberCount: await this.repo.countActiveMembers(id) };
  }

  async update(id: string, input: UpdateClubInput): Promise<void> {
    await this.getById(id);
    const patch: TablesUpdate<'clubs'> = {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.maxMembers !== undefined && { max_members: input.maxMembers }),
      ...(input.openingHours !== undefined && { opening_hours: input.openingHours }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.bundesland !== undefined && { bundesland: input.bundesland }),
      ...(input.billing_unit_minutes !== undefined && {
        billing_unit_minutes: input.billing_unit_minutes,
      }),
      ...(input.tax_rate !== undefined && { tax_rate: input.tax_rate }),
      ...(input.default_payment_method !== undefined && {
        default_payment_method: input.default_payment_method,
      }),
      ...(input.invoice_number_prefix !== undefined && {
        invoice_number_prefix: input.invoice_number_prefix,
      }),
      // city/description/logo_url dürfen explizit null sein (Owner leert das Feld)
      ...(input.city !== undefined && { city: input.city }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.logo_url !== undefined && { logo_url: input.logo_url }),
    };
    await this.repo.update(id, patch);
  }

  /** Soft-Delete, atomar in der DB. Liefert Vereinsname und Zahl deaktivierter Mitgliedschaften. */
  async softDelete(id: string, reason?: string): Promise<{ name: string; deactivated: number }> {
    const club = await this.getById(id);
    const deactivated = await this.repo.softDelete(id, reason ?? null);
    return { name: club.name, deactivated };
  }

  /** Endgültig löschen (Owner/Superadmin + Token, in der Route geprüft). clubs_delete kennt den Owner nicht → systemDb. */
  async hardDelete(id: string): Promise<{ name: string; deactivated: number }> {
    const club = await this.getById(id);
    const repo = new ClubRepository(
      systemDb('Verein endgültig löschen (Owner/Superadmin mit Hard-Delete-Token)')
    );
    const deactivated = await repo.countMemberships(id);
    await repo.hardDelete(id);
    return { name: club.name, deactivated };
  }

  /** Admin-Konto und Abo eines Vereins — nur Owner/Superadmin (Rollenprüfung in der Route). */
  async getPlatformSnapshot(id: string): Promise<AdminSnapshot | null> {
    const sb = systemDb('Plattform-Snapshot: Admin und Abo eines Vereins für Owner/Superadmin');
    const { data: membership } = await sb
      .from('user_club_memberships')
      .select('user_id')
      .eq('club_id', id)
      .eq('role', 'admin')
      .eq('is_active', true)
      .maybeSingle();
    if (!membership?.user_id) return null;
    const { data: u } = await sb
      .from('users')
      .select(
        'email, full_name, subscription_tier, subscription_status, current_period_end, stripe_customer_id'
      )
      .eq('id', membership.user_id)
      .maybeSingle();
    return u ?? null;
  }
}
