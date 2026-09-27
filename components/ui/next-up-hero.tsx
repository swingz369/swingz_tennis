import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * „Als Nächstes"-Karte der Matchday-Vorlage (ADR-007): die eine dunkle Insel
 * einer Startseite — nächster Termin plus genau eine Hauptaktion in Lime.
 * `.brand-dark-surface` schaltet den Akzent auf Lime, die Platzlinien sind
 * reine Dekoration.
 */
export function NextUpHero({
  eyebrow,
  title,
  meta,
  action,
  aside,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** `href` für einen Link, `onClick` nur aus Client-Komponenten */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Kleiner Text neben der Aktion, z. B. „4 Teilnehmende" */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'brand-dark-surface relative isolate flex min-h-[260px] flex-col justify-between overflow-hidden rounded-xl bg-brand-dark p-6 text-white sm:p-8',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="absolute -right-12 top-7 -z-10 h-72 w-52 rotate-[18deg] border border-white/25 opacity-60 before:absolute before:inset-x-0 before:inset-y-8 before:border-y before:border-white/25 after:absolute after:inset-y-0 after:left-1/2 after:border-l after:border-white/25"
      />
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">
          {eyebrow}
        </p>
        <h2 className="mt-3 max-w-[18ch] text-3xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
          {title}
        </h2>
        {meta && <p className="mt-3 text-white/75">{meta}</p>}
      </div>
      {(action || aside) && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {action &&
            (action.href ? (
              <Button asChild variant="highlight">
                <Link href={action.href}>
                  {action.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button variant="highlight" onClick={action.onClick}>
                {action.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ))}
          {aside && <span className="text-sm text-white/75">{aside}</span>}
        </div>
      )}
    </section>
  );
}
