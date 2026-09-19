import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/** Absenderadresse der Plattform (SPF/DKIM hängen an der Domain), ohne Anzeigenamen. */
function platformAddress(): string {
  const from = env.EMAIL_FROM || 'noreply@swingz.cloud';
  return /<([^>]+)>/.exec(from)?.[1] ?? from;
}

/**
 * Absender einer Vereins-Mail: Anzeigename und Antwortadresse gehören dem Verein, die
 * technische Absenderadresse der Plattform (nur die darf Resend signieren).
 * Der Empfänger sieht „TC Musterstadt", eine Antwort geht an den Verein — nicht an SwingZ.
 */
export function clubSender(clubName: string, clubEmail?: string | null) {
  const display = clubName.replace(/["<>\r\n]/g, ' ').trim() || 'Verein';
  return {
    from: `"${display}" <${platformAddress()}>`,
    ...(clubEmail ? { replyTo: clubEmail } : {}),
  };
}

/** Für HTML-Mails: Vereinsname und Nutzertexte nie ungeprüft einsetzen. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Absender + Vereinsname eines Vereins (Service-Client oder RLS-Client mit Lesezugriff auf `clubs`). */
export async function loadClubSender(db: SupabaseClient, clubId: string) {
  const { data } = await db.from('clubs').select('name, email').eq('id', clubId).maybeSingle();
  const name = data?.name ?? 'Verein';
  return { name, ...clubSender(name, data?.email) };
}
