import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvoiceBranding } from './invoice-pdf-utils';

export interface InvoiceIssuer {
  clubName: string;
  clubAddress: string;
  clubEmail: string;
  clubPhone: string;
  branding: InvoiceBranding;
}

const MAX_LOGO_BYTES = 1_000_000;

/** Logo laden; ein fehlendes oder kaputtes Logo darf keine Rechnung verhindern. */
async function fetchLogo(url: string | null): Promise<InvoiceBranding['logo']> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    const kind = type.includes('png') ? 'png' : /jpe?g/.test(type) ? 'jpg' : null;
    if (!kind) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MAX_LOGO_BYTES ? { bytes, type: kind } : null;
  } catch {
    return null;
  }
}

/**
 * Rechnungssteller = der Verein der Rechnung (nie ein Plattformname).
 * Freitexte stehen in `clubs.legal_info` (Admin → Einstellungen → Rechtliches).
 */
export async function loadInvoiceIssuer(
  db: SupabaseClient,
  clubId: string
): Promise<InvoiceIssuer | null> {
  const { data: club } = await db
    .from('clubs')
    .select('name, address, city, email, phone, legal_info, primary_color, logo_light_url')
    .eq('id', clubId)
    .maybeSingle();
  if (!club) return null;

  const legal = (club.legal_info ?? {}) as Record<string, string | undefined>;
  const registerzeile = [legal.amtsgericht, legal.registernummer].filter(Boolean).join(', ');

  return {
    clubName: club.name,
    clubAddress: [club.address, club.city].filter(Boolean).join(', '),
    clubEmail: club.email ?? '',
    clubPhone: club.phone ?? '',
    branding: {
      accentColor: club.primary_color,
      logo: await fetchLogo(club.logo_light_url),
      steuernummer: legal.steuernummer,
      registerzeile,
      bank: legal.bank,
      iban: legal.iban,
      bic: legal.bic,
      introText: legal.rechnungstext,
      footerText: legal.rechnungsfusszeile,
    },
  };
}
