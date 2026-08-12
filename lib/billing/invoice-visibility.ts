/**
 * Wann ist eine Rechnung für das Mitglied sichtbar, und wann schuldet es Geld?
 *
 * Diese beiden Fragen wurden im Projekt an drei Stellen unterschiedlich
 * beantwortet: Das Mitglieder-Dashboard zählte ausschließlich `status = 'open'`
 * (ein Mitglied mit überfälliger Rechnung sah dort „0 offen"), die Rechnungsseite
 * zählte „alles außer bezahlt" — inklusive Entwürfen, die der Verein noch gar
 * nicht verschickt hat. Beide lasen dieselben Daten und zeigten verschiedene Zahlen.
 */

import type { InvoiceStatus } from '@/lib/types/billing';

/**
 * Ein Entwurf ist Arbeitsstand des Vereins — er kann sich noch ändern oder ganz
 * verschwinden (etwa wenn die Saison neu veröffentlicht wird). Vor dem Mitglied
 * gehört er deshalb nicht auf den Tisch.
 */
export function isMemberVisibleInvoiceStatus(status: string | null | undefined): boolean {
  return status !== 'draft';
}

/** Status, bei denen das Mitglied noch etwas zu zahlen hat. */
const OUTSTANDING: ReadonlySet<string> = new Set<InvoiceStatus>([
  'open',
  'sent',
  'partially_paid',
  'overdue',
  'dunning',
  'reminder_sent',
]);

export function isOutstandingInvoiceStatus(status: string | null | undefined): boolean {
  return status != null && OUTSTANDING.has(status);
}

/** Für Postgres-Filter (`.in('status', …)`) — dieselbe Liste, nur als Array. */
export const OUTSTANDING_INVOICE_STATUSES: readonly string[] = [...OUTSTANDING];
