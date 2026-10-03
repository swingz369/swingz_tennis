/**
 * Stripe Connect — verbundenes Stripe-Konto je Verein (ADR-005, ADR-008).
 * Lesen per Nutzer-Client (RLS: `club_stripe_accounts_member_read`), schreiben nur
 * über systemDb — die Tabelle hat keine Schreib-Policy.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:stripe-connect.repository');

export type ClubStripeAccount = Tables<'club_stripe_accounts'>;

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class StripeConnectRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findByClub(clubId: string): Promise<ClubStripeAccount | null> {
    const { data, error } = await this.db
      .from('club_stripe_accounts')
      .select()
      .eq('club_id', clubId)
      .maybeSingle();
    assertNoError(error, 'Lesen des Stripe-Kontos fehlgeschlagen');
    return data;
  }

  async findByAccountId(stripeAccountId: string): Promise<ClubStripeAccount | null> {
    const { data, error } = await this.db
      .from('club_stripe_accounts')
      .select()
      .eq('stripe_account_id', stripeAccountId)
      .maybeSingle();
    assertNoError(error, 'Lesen des Stripe-Kontos fehlgeschlagen');
    return data;
  }

  async insert(input: TablesInsert<'club_stripe_accounts'>): Promise<ClubStripeAccount> {
    const { data, error } = await this.db
      .from('club_stripe_accounts')
      .insert(input)
      .select()
      .single();
    assertNoError(error, 'Anlegen des Stripe-Kontos fehlgeschlagen');
    return data!;
  }

  async updateStatus(
    stripeAccountId: string,
    status: { charges_enabled: boolean; details_submitted: boolean }
  ): Promise<void> {
    const { error } = await this.db
      .from('club_stripe_accounts')
      .update({
        ...status,
        updated_at: new Date().toISOString(),
        ...(status.charges_enabled && { connected_at: new Date().toISOString() }),
      })
      .eq('stripe_account_id', stripeAccountId);
    assertNoError(error, 'Aktualisieren des Stripe-Kontos fehlgeschlagen');
  }

  async deleteByAccountId(stripeAccountId: string): Promise<void> {
    const { error } = await this.db
      .from('club_stripe_accounts')
      .delete()
      .eq('stripe_account_id', stripeAccountId);
    assertNoError(error, 'Trennen des Stripe-Kontos fehlgeschlagen');
  }
}
