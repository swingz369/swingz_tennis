import { redirect } from 'next/navigation';

/**
 * Legaler Alt-Einstieg: die Sonderveranstaltungen leben jetzt als Tab im
 * Veranstaltungen-Hub (/admin/events). Deep-Links (und ältere Tests) leiten
 * auf den Tab um.
 */
export default function SpecialEventsRedirect() {
  redirect('/admin/events?tab=special-events');
}
