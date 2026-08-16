import { redirect } from 'next/navigation';

/**
 * Legaler Alt-Einstieg: die Zuweisungs-Sicht lebt jetzt als Tab unter
 * /admin/work-duties. Deep-Links (und ältere Tests) leiten auf den Tab um.
 */
export default function WorkDutiesAssignmentsRedirect() {
  redirect('/admin/work-duties?tab=assignments');
}
