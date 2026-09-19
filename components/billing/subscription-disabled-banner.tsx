import { AlertTriangle } from 'lucide-react';
import { isSubscriptionEnforced } from '@/lib/subscription-gate';

/**
 * Hinweisleiste, solange `SUBSCRIPTION_ENFORCEMENT=off` gesetzt ist.
 *
 * Ein Schalter, der Umsatz kostet, darf nicht nur in einer Doku stehen. Diese
 * Leiste steht auf jeder Admin- und Superadmin-Seite, bis die Variable
 * entfernt ist — damit ist die Abschaltung beim Launch nicht zu übersehen.
 *
 * Rendert nichts, wenn die Schranke scharf ist (Normalfall, auch in
 * Produktion nach dem Launch).
 */
export function SubscriptionDisabledBanner() {
  if (isSubscriptionEnforced()) return null;

  return (
    <div role="status" className="border-b border-warning-300 bg-warning-50">
      <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
        <span className="font-semibold text-warning-900">Bezahlschranke abgeschaltet</span>
        <span className="text-warning-800/80/80">
          Alle Vereine haben Vollzugriff ohne Abo — Vorlaufbetrieb bis zum Launch.
          <span className="hidden md:inline">
            {' '}
            Zum Aktivieren <code className="font-mono">SUBSCRIPTION_ENFORCEMENT</code> entfernen.
          </span>
        </span>
      </div>
    </div>
  );
}
