import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Saison-Karte — der Stand der Saisonplanung als eine Kachel.
 *
 * Die dunkle Fläche ist Absicht: das ist die einzige Karte des Dashboards, auf
 * der etwas *läuft* und eine Frist abläuft. Alles andere sind Bestandszahlen.
 * Ein Vorstand soll beim Überfliegen genau hier hängenbleiben.
 *
 * Farben stammen aus `--brand-dark` / `--brand-accent` — anders als Heatmap und
 * KPI-Band ist das hier bewusst mandantenfähig: die Karte ist die Stelle, an
 * der die Vereinsmarke auftauchen darf.
 */

export type SeasonProgress = {
  name: string;
  planningStatus: string;
  /** Mitglieder, die ihre Präferenzen abgegeben haben. */
  submitted: number;
  /** Mitglieder insgesamt — der Nenner. */
  total: number;
  /** Tage bis zum Präferenz-Stichtag. `null`, wenn keiner gesetzt ist. */
  daysLeft: number | null;
  /** Saisonbeginn/-ende (ISO). Trägt den Verlauf der laufenden Saison. */
  startDate?: string | null;
  endDate?: string | null;
  href: string;
};

/** Überschrift + erklärender Satz je Planungsstatus. */
const STATUS_COPY: Record<string, { title: string; hint: string }> = {
  draft: { title: 'Saison angelegt', hint: 'Noch nicht für Präferenzen geöffnet.' },
  collecting_preferences: {
    title: 'Präferenzen laufen',
    hint: 'Mitglieder tragen ihre Wunschzeiten ein.',
  },
  manual_review: { title: 'Wartet auf Freigabe', hint: 'Der Plan liegt zur Prüfung bereit.' },
  published: { title: 'Saison läuft', hint: 'Der Plan ist veröffentlicht.' },
};

function deadlineLabel(daysLeft: number | null): string | null {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return 'Frist abgelaufen';
  if (daysLeft === 0) return 'endet heute';
  if (daysLeft === 1) return 'endet morgen';
  return `endet in ${daysLeft} Tagen`;
}

const DAY_MS = 86_400_000;

/**
 * Verlauf der laufenden Saison in Wochen. Sobald der Plan veröffentlicht ist,
 * sagt „x von y Präferenzen" nichts mehr — die Frage ist dann, wie weit die
 * Saison ist. Gibt `null`, wenn Datumsangaben fehlen oder die Saison noch nicht
 * begonnen hat.
 */
export function seasonWeekProgress(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): { current: number; total: number; pct: number; label: string } | null {
  if (!startDate || !endDate) return null;
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const now = Date.now();
  const total = Math.max(1, Math.round((end - start) / (7 * DAY_MS)));
  const elapsed = Math.round((now - start) / (7 * DAY_MS));
  const current = Math.min(total, Math.max(1, elapsed + 1));
  const pct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));

  const daysToEnd = Math.ceil((end - now) / DAY_MS);
  const label =
    daysToEnd <= 0
      ? 'Saison beendet'
      : daysToEnd === 1
        ? 'endet morgen'
        : daysToEnd <= 21
          ? `endet in ${daysToEnd} Tagen`
          : `noch ${Math.max(0, total - current)} Wochen`;

  return { current, total, pct, label };
}

export function SeasonProgressCard({ season }: { season: SeasonProgress }) {
  const copy = STATUS_COPY[season.planningStatus] ?? {
    title: season.name,
    hint: `Status: ${season.planningStatus}`,
  };

  // Der Fortschrittsbalken ergibt nur beim Sammeln von Präferenzen Sinn —
  // in den anderen Status ist „x von y" keine Aussage über den Fortschritt.
  const isCollecting = season.planningStatus === 'collecting_preferences';
  const showProgress = isCollecting && season.total > 0;
  const pct = showProgress ? Math.round((season.submitted / season.total) * 100) : 0;
  // Der Stichtag zählt nur, solange gesammelt wird. Bei einer laufenden Saison
  // stand sonst „Frist abgelaufen" — formal richtig, als Meldung aber Unsinn:
  // die Frist ist abgelaufen, weil die Planung längst fertig ist.
  const deadline = isCollecting ? deadlineLabel(season.daysLeft) : null;

  // Verlaufsanzeige für die veröffentlichte Saison: dieselbe Balken-Optik wie
  // beim Präferenz-Sammeln, aber der Nenner sind Trainingswochen. Ohne sie war
  // die Karte ab dem Veröffentlichen nur noch ein Satz Text.
  const weeks =
    !showProgress && season.planningStatus === 'published'
      ? seasonWeekProgress(season.startDate, season.endDate)
      : null;

  return (
    <div className="brand-dark-surface relative overflow-hidden rounded-xl bg-brand-dark p-5 text-white">
      {/* Court-Kreis als Dekor, bewusst angeschnitten. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -right-12 h-44 w-44 rounded-full border-2 border-white/10"
      />

      <p className="relative tabular-nums text-2xs font-semibold uppercase tracking-[0.13em] text-brand-accent">
        {season.name}
      </p>
      <h3 className="relative mt-2 text-lg font-semibold tracking-[-0.025em]">{copy.title}</h3>

      {showProgress ? (
        <>
          <p className="relative mt-3 text-3xl font-bold tabular-nums tracking-[-0.04em]">
            {season.submitted}
            <span className="text-base font-semibold text-white/55">
              /{season.total} Mitgliedern
            </span>
          </p>
          <div
            className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Abgegebene Präferenzen"
          >
            <span
              className="block h-full rounded-full bg-brand-accent"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="relative mt-2 tabular-nums text-2xs text-white/60">
            {pct} %{deadline && ` · ${deadline}`}
          </p>
        </>
      ) : weeks ? (
        <>
          <p className="relative mt-3 text-3xl font-bold tabular-nums tracking-[-0.04em]">
            Woche {weeks.current}
            <span className="text-base font-semibold text-white/55">/{weeks.total} der Saison</span>
          </p>
          <div
            className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-valuenow={weeks.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Saisonverlauf"
          >
            <span
              className="block h-full rounded-full bg-brand-accent"
              style={{ width: `${weeks.pct}%` }}
            />
          </div>
          <p className="relative mt-2 tabular-nums text-2xs text-white/60">
            {weeks.pct} % · {weeks.label}
          </p>
        </>
      ) : (
        <p className="relative mt-2 text-sm text-white/65">
          {copy.hint}
          {deadline && ` · ${deadline}`}
        </p>
      )}

      <Link
        href={season.href}
        className="relative mt-4 flex items-center justify-between rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        Zur Saisonplanung
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
