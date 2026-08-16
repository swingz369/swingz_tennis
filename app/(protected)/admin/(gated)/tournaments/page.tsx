import { redirect } from 'next/navigation';

/**
 * Legaler Alt-Einstieg: die Turnierliste lebt jetzt als Tab im
 * Veranstaltungen-Hub (/admin/events). Deep-Links (und ältere Tests) leiten
 * auf den Tab um. Anlegen (/new) und Detail (/[id]) bleiben eigene Routen.
 */
export default function TournamentsRedirect() {
  redirect('/admin/events?tab=tournaments');
}
