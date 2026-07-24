import { Sparkles, Construction } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Audit-Stat-Strip + Tipps — Server-Component.
 *
 * Bewusst OHNE Live-Data: alle Karten sind als „Bald verfügbar" markiert,
 * bis die Aggregations-Routes (events-24h, top-actors, alerts) gebaut sind.
 * Diese Karten sind also kein UI-Stub, sondern ein ehrliches „Coming Soon".
 *
 * Warum nicht leer weglassen?
 *   Der Audit-Filter ist mächtig, aber für Erstbesucher ohne klare
 *   Anwendungsfälle. Die Tipps-Karte gibt einen 3-Sekunden-Quick-Start und
 *   verhindert, dass der User die Seite als „leeres Tab-Grid" wahrnimmt.
 */
export function AuditStatStrip() {
  const statCards = [
    {
      title: 'Events letzte 24h',
      icon: Sparkles,
      comingSoon: true,
      body: 'Aggregierte Anzahl aller Log-Einträge mit rollierender Stunde.',
    },
    {
      title: 'Top-Aktoren',
      icon: Sparkles,
      comingSoon: true,
      body: 'Welche User haben in den letzten 7 Tagen die meisten Aktionen ausgelöst.',
    },
    {
      title: 'Sicherheits-Alerts',
      icon: Sparkles,
      comingSoon: true,
      body: 'Hervorhebung kritischer Aktionen (login_failures, role_changes, deletes).',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stat-Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statCards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                {card.comingSoon && (
                  <Badge
                    variant="outline"
                    className="border-violet-300/70 text-violet-700 dark:border-violet-700/60 dark:text-violet-300 text-2xs py-0 px-1.5"
                  >
                    Bald
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.body}</p>
              <p className="mt-2 text-xs font-mono text-violet-600/70 dark:text-violet-400/70">—</p>
            </CardContent>
            {/* dezenter Bau-Licht-Vermerk */}
            <div
              className="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.04] dark:opacity-[0.06]"
              aria-hidden="true"
            >
              <Construction className="h-24 w-24" />
            </div>
          </Card>
        ))}
      </div>

      {/* Tipps-Karte */}
      <Card className="border-violet-200/60 dark:border-violet-700/40 bg-violet-50/40 dark:bg-violet-900/10">
        <CardContent className="py-4 px-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300 mb-1.5">
            Schnellstart
          </p>
          <ul className="space-y-1 text-sm text-foreground dark:text-violet-100">
            <li className="flex gap-2">
              <span className="text-violet-500 dark:text-violet-400 shrink-0">①</span>
              <span>
                <strong>Verein-Filter:</strong> links einen Verein auswählen, um nur dessen Logs zu
                sehen. Wirkt auch auf den CSV-Export.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-violet-500 dark:text-violet-400 shrink-0">②</span>
              <span>
                <strong>Akteur suchen:</strong> E-Mail-Teilstring ins Filterfeld (z. B.
                <code className="mx-1 px-1 py-0.5 rounded bg-background text-xs">
                  @tsv-dortmund.de
                </code>
                ) — findet alle User mit passender Mail.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-violet-500 dark:text-violet-400 shrink-0">③</span>
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
