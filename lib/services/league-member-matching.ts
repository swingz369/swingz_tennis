/**
 * lib/services/league-member-matching.ts — Kaderzeilen einem Vereinsmitglied zuordnen.
 *
 * Übrig aus dem entfernten nuLiga-Sync (Scraping ist laut AGB von tennis.de untersagt).
 * Der Abgleich bleibt: Mitglieder bestätigen ihre Kaderzeile selbst (`/api/member/leagues/claim`),
 * der Admin ordnet zu (`/api/leagues/[id]/roster`).
 */

import { createLogger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const log = createLogger('league-member-matching');

type Sb = SupabaseClient<Database>;

/** Vergleichsform für Mannschaftsnamen: Kleinschreibung, Mehrfach-Leerzeichen weg. */
export function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface MemberCandidate {
  id: string;
  full_name: string | null;
  dtb_id: string | null;
  date_of_birth: string | null;
}

/** Jahrgang aus dem Geburtsdatum, null wenn unbekannt. */
function birthYearOf(dob: string | null): number | null {
  const y = dob ? parseInt(dob.slice(0, 4), 10) : NaN;
  return Number.isNaN(y) ? null : y;
}

/**
 * Sicherer Treffer: DTB-ID stimmt überein und ist unter den Mitgliedern
 * eindeutig. Nur das wird automatisch zugeordnet.
 */
export function matchByDtbId(
  player: { dtbId: string | null },
  members: MemberCandidate[]
): string | null {
  const id = player.dtbId?.trim();
  if (!id) return null;
  const hits = members.filter((m) => m.dtb_id?.trim() === id);
  return hits.length === 1 ? hits[0].id : null;
}

/**
 * Vorschlag über den Namen — bewusst KEINE automatische Zuordnung: Namen sind
 * nicht eindeutig, und eine falsche Zuordnung würde einem Mitglied fremde
 * Mannschaften anzeigen. Das Mitglied bestätigt selbst (oder der Admin).
 *
 * Nur ein Treffer zählt; widerspricht der Jahrgang dem Geburtsdatum, ist es
 * eine andere Person.
 */
export function suggestByName(
  player: { name: string; birthYear: number | null },
  members: MemberCandidate[]
): string | null {
  const wanted = normalizeTeamName(player.name);
  const hits = members.filter((m) => {
    if (!m.full_name || normalizeTeamName(m.full_name) !== wanted) return false;
    const y = birthYearOf(m.date_of_birth);
    return !(y && player.birthYear && y !== player.birthYear);
  });
  return hits.length === 1 ? hits[0].id : null;
}

/** Lädt die aktiven Mitglieder eines Vereins in der Form für den Abgleich. */
export async function loadMemberCandidates(sb: Sb, clubId: string): Promise<MemberCandidate[]> {
  const { data: memberships } = await sb
    .from('user_club_memberships')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('is_active', true);
  const ids = (memberships ?? []).map((m: { user_id: string }) => m.user_id);
  if (ids.length === 0) return [];
  const { data: users } = await sb
    .from('users')
    .select('id, full_name, dtb_id, date_of_birth')
    .in('id', ids);
  return (users ?? []) as MemberCandidate[];
}

/**
 * Die DTB-ID beim Mitglied festhalten, sobald eine Zuordnung bestätigt ist.
 * Der Kader wird bei jedem Sync neu geschrieben — mit der ID am Nutzer läuft die
 * Zuordnung danach (und in der nächsten Saison) ohne Namensabgleich.
 * Überschreibt nie eine vorhandene ID. `sb` muss den Nutzer beschreiben dürfen
 * (Service-Client), der Aufrufer prüft vorher die Vereinszugehörigkeit.
 */
export async function persistDtbId(sb: Sb, memberId: string, dtbId: string | null): Promise<void> {
  if (!dtbId) return;
  const { error } = await sb
    .from('users')
    .update({ dtb_id: dtbId })
    .eq('id', memberId)
    .is('dtb_id', null);
  if (error) log.warn('DTB-ID konnte nicht gespeichert werden', { memberId });
}
