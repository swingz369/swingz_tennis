/**
 * Zweite migrierte Domäne für Option B (ADR-005), nach Stundensätzen. Ein
 * Repository, kein Adapter, keine Interfaces — Muster in docs/ARCHIV/
 * 2026-09-13-architektur-analyse-datenzugriff.md § 6.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:sepa-mandate.repository');

export type SepaMandate = Tables<'sepa_mandates'>;

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class SepaMandateRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(input: TablesInsert<'sepa_mandates'>): Promise<SepaMandate> {
    const { data, error } = await this.db
      .from('sepa_mandates')
      .insert({
        ...input,
        iban: input.iban.replace(/\s/g, '').toUpperCase(),
        bic: input.bic.replace(/\s/g, '').toUpperCase(),
      })
      .select()
      .single();
    assertNoError(error, 'Anlegen des SEPA-Mandats fehlgeschlagen');
    return data!;
  }

  /** Gläubiger-ID, die der Verein in den Rechtlichen Angaben hinterlegt hat. */
  async findClubCreditorId(clubId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('clubs')
      .select('legal_info')
      .eq('id', clubId)
      .maybeSingle();
    assertNoError(error, 'Laden der Gläubiger-ID fehlgeschlagen');
    const id = (data?.legal_info as { glaeubiger_id?: string } | null)?.glaeubiger_id;
    return id?.replace(/\s/g, '') || null;
  }

  async findById(id: string): Promise<SepaMandate | null> {
    const { data, error } = await this.db.from('sepa_mandates').select().eq('id', id).maybeSingle();
    assertNoError(error, 'Lesen des SEPA-Mandats fehlgeschlagen');
    return data;
  }

  /** Ein Mandat gilt clubübergreifend für das Mitglied (club_id ist optional, s. Schema). */
  async findActiveByMemberId(memberId: string): Promise<SepaMandate | null> {
    const { data, error } = await this.db
      .from('sepa_mandates')
      .select()
      .eq('member_id', memberId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    assertNoError(error, 'Lesen des aktiven SEPA-Mandats fehlgeschlagen');
    return data;
  }

  async findByMemberId(memberId: string): Promise<SepaMandate[]> {
    const { data, error } = await this.db
      .from('sepa_mandates')
      .select()
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });
    assertNoError(error, 'Lesen der SEPA-Mandate fehlgeschlagen');
    return data ?? [];
  }

  async update(id: string, input: TablesUpdate<'sepa_mandates'>): Promise<SepaMandate | null> {
    const cleaned: TablesUpdate<'sepa_mandates'> = { ...input };
    if (cleaned.iban) cleaned.iban = cleaned.iban.replace(/\s/g, '').toUpperCase();
    if (cleaned.bic) cleaned.bic = cleaned.bic.replace(/\s/g, '').toUpperCase();

    const { data, error } = await this.db
      .from('sepa_mandates')
      .update(cleaned)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren des SEPA-Mandats fehlgeschlagen');
    return data;
  }

  async revoke(id: string, reason: string): Promise<SepaMandate | null> {
    const { data, error } = await this.db
      .from('sepa_mandates')
      .update({ is_active: false, revoked_at: new Date().toISOString(), revoke_reason: reason })
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Widerrufen des SEPA-Mandats fehlgeschlagen');
    return data;
  }
}
