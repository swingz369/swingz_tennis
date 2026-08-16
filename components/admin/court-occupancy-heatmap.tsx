import type { OccupancyGrid } from '@/lib/court-occupancy';
import { cn } from '@/lib/utils';

/**
 * Platzbelegung der laufenden Woche als Heatmap.
 *
 * Rein darstellend — das Raster kommt fertig aus `buildOccupancyGrid()`.
 * Fünf Stufen statt eines stufenlosen Verlaufs, weil ein Verlauf zwar
 * hübscher, aber nicht ablesbar ist: „ist das jetzt 60 % oder 75 %?" kann
 * niemand aus einem Farbton schätzen. Fünf Stufen kann man mit der Legende
 * abgleichen.
 */

// `primary` (Theme), NICHT `brand-primary` (Mandant): die `--brand-*`-Tokens
// werden pro Verein zur Laufzeit über ein SSR-`<style>`-Tag überschrieben
// (siehe lib/tenant-context.tsx). Die Heatmap ist Bedienoberfläche, keine
// Vereinsmarke — sie muss in jedem Club gleich aussehen und mit dem Rest des
// Themes harmonieren. Mit `brand-primary` erschien sie im Clay-Theme blau,
// weil der geseedete Club noch die alte Markenfarbe trägt.
// Die unterste belegte Stufe liegt bewusst deutlich über „frei": bei vier
// Plätzen ergibt eine einzelne Buchung 25 % und landet immer hier. Mit einem
// zarten 15-%-Ton war ein belegter Slot dann kaum von einem freien zu
// unterscheiden — die Karte sah leer aus, obwohl Termine drin standen.
const LEVELS = [
  'bg-muted', // 0 — frei
  'bg-primary/30',
  'bg-primary/50',
  'bg-primary/70',
  'bg-primary', // 100 % — ausgebucht
];

/** 0 → 0, alles >0 landet in Stufe 1–4. Nur wirklich leer ist wirklich leer. */
function level(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.8) return 3;
  return 4;
}

export function CourtOccupancyHeatmap({ grid }: { grid: OccupancyGrid }) {
  if (grid.courtCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Plätze angelegt — ohne Plätze gibt es nichts zu belegen.
      </p>
    );
  }

  if (grid.isEmpty) {
    return <p className="text-sm text-muted-foreground">Diese Woche ist noch kein Platz belegt.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `28px repeat(${grid.hours.length}, minmax(0, 1fr))` }}
        >
          {/* Stundenachse */}
          <span aria-hidden="true" />
          {grid.hours.map((h) => (
            <span
              key={`h-${h}`}
              aria-hidden="true"
              className="grid place-items-center font-mono text-3xs text-muted-foreground"
            >
              {h}
            </span>
          ))}

          {/* Eine Zeile pro Wochentag */}
          {grid.days.map((day) => (
            <Row key={day.label} label={day.label} cells={day.cells} hours={grid.hours} />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
          <span>frei</span>
          {LEVELS.map((cls, i) => (
            <span key={i} aria-hidden="true" className={cn('block h-2.5 w-4 rounded-[3px]', cls)} />
          ))}
          <span>ausgebucht</span>
          <span className="ml-2">· {grid.courtCount} Plätze</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, cells, hours }: { label: string; cells: number[]; hours: number[] }) {
  return (
    <>
      <span className="grid place-items-center font-mono text-3xs text-muted-foreground">
        {label}
      </span>
      {cells.map((ratio, i) => (
        <span
          key={`${label}-${hours[i]}`}
          className={cn('block h-5 rounded-[3px]', LEVELS[level(ratio)])}
          // Ohne Titel ist die Heatmap für Screenreader und Maus gleich stumm.
          title={`${label} ${hours[i]}:00 — ${Math.round(ratio * 100)} % belegt`}
        />
      ))}
    </>
  );
}
