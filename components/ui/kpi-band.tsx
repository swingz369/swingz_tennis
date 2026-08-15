import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * KPI-Band — die vier Kennzahlen als redaktionelles Zahlenband statt als
 * vier Karten.
 *
 * Warum keine `StatCard`s mehr: vier gerahmte Boxen nebeneinander erzeugen
 * zwölf Kanten, die alle gleich laut sind, und die Zahl — das Einzige, was
 * ein Vorstand hier liest — muss sich gegen den Rahmen behaupten. Ohne Box
 * trägt die Zahl selbst. Die 2px-Linie oben fasst die vier als eine Einheit,
 * die dünnen Trennlinien halten sie auseinander.
 *
 * `StatCard` bleibt bestehen und wird von anderen Seiten weiter genutzt.
 */

export type KpiTone = 'up' | 'down' | 'flat';

export type KpiBandItem = {
  label: string;
  value: string | number;
  /** Kleiner Zusatz unter der Zahl, z. B. „+6 % zum Vormonat". */
  sub?: string;
  /** Färbt den Zusatz. `flat` = neutral, kein Signal. */
  tone?: KpiTone;
  href?: string;
  /** Nachgestellter, kleiner Teil der Zahl, z. B. „/24" bei „17/24". */
  suffix?: string;
};

// `primary` statt `brand-primary` — gleiche Begründung wie in der Heatmap:
// `--brand-*` ist mandantenabhängig, das Auf/Ab-Signal einer Kennzahl darf
// nicht davon abhängen, welche Farbe ein Verein in seinem Branding hinterlegt
// hat (im Extremfall wäre „gestiegen" dann rot).
const toneClass: Record<KpiTone, string> = {
  up: 'text-primary',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
};

function Cell({ item }: { item: KpiBandItem }) {
  return (
    <>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {item.label}
      </dt>
      <dd className="mt-3 text-3xl sm:text-[34px] font-bold leading-none tracking-[-0.045em] tabular-nums">
        {item.value}
        {item.suffix && (
          <span className="text-base font-semibold tracking-[-0.02em] text-muted-foreground">
            {item.suffix}
          </span>
        )}
      </dd>
      {item.sub && (
        <p
          className={cn(
            'mt-2 font-mono text-[11.5px] font-semibold',
            toneClass[item.tone ?? 'flat']
          )}
        >
          {item.sub}
        </p>
      )}
    </>
  );
}

export function KpiBand({ items }: { items: KpiBandItem[] }) {
  return (
    // Die 2-px-Oberkante ist im Light-Theme die Tinte selbst — ein schwarzer
    // Strich über den Zahlen, der das Band als Kopfzeile der Seite setzt. Im
    // Dark wäre dieselbe Regel eine fast weisse Linie, die heller leuchtet als
    // die Zahlen darunter; dort trägt sie deshalb die Akzentfarbe.
    <dl className="grid grid-cols-2 lg:grid-cols-4 border-t-2 border-foreground dark:border-t-primary border-b border-border">
      {items.map((item, idx) => {
        const cellClass = cn(
          'px-4 py-5 sm:px-6',
          // Trennlinien nur zwischen den Zellen, nicht aussen. Auf Mobile
          // steht das Band 2x2, deshalb die zweite Regel für die Zeilenkante.
          'border-border',
          idx % 2 === 0 && 'border-r lg:border-r',
          idx % 2 === 1 && 'lg:border-r',
          idx === items.length - 1 && 'lg:border-r-0',
          idx < 2 && 'border-b lg:border-b-0'
        );

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              cellClass,
              'block transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
            )}
          >
            <Cell item={item} />
          </Link>
        ) : (
          <div key={item.label} className={cellClass}>
            <Cell item={item} />
          </div>
        );
      })}
    </dl>
  );
}
