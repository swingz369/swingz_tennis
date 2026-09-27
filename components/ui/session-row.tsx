import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Terminzeile der Matchday-Vorlage: Beginn/Ende, Farbstreifen, Titel mit
 * Metazeile, rechts Tag oder Pfeil. Für Terminlisten auf Startseiten — wer
 * Spalten zum Vergleichen braucht, nimmt `Table`.
 */
export function SessionRow({
  start,
  end,
  title,
  meta,
  href,
  trailing,
}: {
  start: string;
  end?: string;
  title: ReactNode;
  meta?: ReactNode;
  href?: string;
  /** Rechts statt des Pfeils, z. B. ein Badge */
  trailing?: ReactNode;
}) {
  const body = (
    <>
      <div className="w-12 shrink-0 text-sm font-bold tabular-nums">
        {start}
        {end && <span className="block text-xs font-normal text-muted-foreground">{end}</span>}
      </div>
      <div className="w-1 self-stretch rounded-full bg-event" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{title}</p>
        {meta && <p className="mt-0.5 truncate text-sm text-muted-foreground">{meta}</p>}
      </div>
      {trailing ??
        (href && (
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        ))}
    </>
  );
  const cls = 'flex items-center gap-4 border-b border-border px-5 py-4 last:border-0';
  return href ? (
    <Link href={href} className={`group ${cls} transition-colors hover:bg-muted/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
