import { Card, CardContent } from '@/components/ui/card';

/**
 * Schnellstart-Tipps für das Audit-Log — Server-Component.
 * Kennzahlen-Kacheln (Events 24h, Top-Aktoren, Alerts) kommen erst, wenn es
 * Aggregations-Routes dafür gibt; bis dahin keine Platzhalter.
 */
export function AuditStatStrip() {
  return (
    <div className="space-y-4">
      {/* Tipps-Karte */}
      <Card className="border-info-200/60 bg-info-50/40">
        <CardContent className="py-4 px-5">
          <p className="text-xs font-semibold text-info-700 mb-1.5">Schnellstart</p>
          <ul className="space-y-1 text-sm text-foreground dark:text-info-100">
            <li className="flex gap-2">
              <span className="text-info-500 dark:text-info-400 shrink-0">①</span>
              <span>
                <strong>Verein-Filter:</strong> links einen Verein auswählen, um nur dessen Logs zu
                sehen. Wirkt auch auf den CSV-Export.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-info-500 dark:text-info-400 shrink-0">②</span>
              <span>
                <strong>Akteur suchen:</strong> E-Mail-Teilstring ins Filterfeld (z. B.
                <code className="mx-1 px-1 py-0.5 rounded bg-background text-xs">@verein.de</code>)
                — findet alle User mit passender Mail.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-info-500 dark:text-info-400 shrink-0">③</span>
              <span>
                <strong>Zeitfenster:</strong> „Von/Bis" wirkt sofort, Tabelle lädt neu. Maximal 100
                Einträge pro Seite; für Reports den <strong>CSV-Export</strong> unten links nutzen
                (max. 10.000 Zeilen).
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
