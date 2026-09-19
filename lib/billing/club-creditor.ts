import type { SupabaseClient } from '@supabase/supabase-js';
import type { SepaPain008Config } from '@/lib/sepa/pain008-generator';

/**
 * SEPA-Gläubiger = der Verein, dem die Forderung gehört. Daten aus `clubs.legal_info`
 * (Admin → Einstellungen → Rechtliches → Bankverbindung). Vorher kamen IBAN und
 * Gläubiger-ID aus Umgebungsvariablen der Plattform: eine Lastschrift für Verein A wäre
 * auf dem Konto der Plattform gelandet.
 */
export async function loadClubCreditor(
  db: SupabaseClient,
  clubId: string
): Promise<Partial<SepaPain008Config> | null> {
  const { data: club } = await db
    .from('clubs')
    .select('name, address, city, legal_info')
    .eq('id', clubId)
    .maybeSingle();
  if (!club) return null;

  const legal = (club.legal_info ?? {}) as Record<string, string | undefined>;
  const iban = legal.iban?.replace(/\s/g, '');
  const creditorId = legal.glaeubiger_id?.replace(/\s/g, '');
  if (!iban || !creditorId) return null;

  return {
    creditorName: club.name,
    creditorAccountIban: iban,
    ...(legal.bic ? { creditorAccountBic: legal.bic } : {}),
    creditorId,
    creditorAddress: {
      ...(club.address ? { street: club.address } : {}),
      ...(club.city ? { city: club.city } : {}),
      country: 'DE',
    },
  };
}
