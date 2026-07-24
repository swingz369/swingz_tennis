import { redirect } from 'next/navigation';

// Konsolidiert: E-Mail-Versand an Mitglieder lebt unter /admin/email-campaigns
// (Superset: freie Empfängerauswahl statt nur Vorlagen).
export default function NewslettersRedirect() {
  redirect('/admin/email-campaigns');
}
