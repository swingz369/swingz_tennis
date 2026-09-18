/**
 * Feature-Sektion: asymmetrisches Raster mit 6 Zellen (2+1+1 / 1+1+2).
 * Server Component.
 */

import { CalendarClock, CalendarDays, BarChart3, Users, ShieldCheck, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionReveal } from './section-reveal';

const CELL = 'rounded-xl p-8 flex flex-col';

export function BentoSection() {
  return (
    <SectionReveal
      as="section"
      id="section-features"
      aria-labelledby="features-heading"
      className="py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2
          id="features-heading"
          className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-10 sm:mb-14"
        >
          Sechs Werkzeuge, ein Vereinsleben
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <article className={cn(CELL, 'bg-brand-primary/10 md:col-span-2 lg:row-span-1')}>
            <CalendarClock className="h-7 w-7 text-brand-primary" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-bold text-foreground">Saisonplanung</h3>
            <p className="mt-2 text-muted-foreground leading-relaxed max-w-md">
              Die Wochenplanung berücksichtigt Trainer-Kapazitäten, Gruppenwünsche und die
              Hallenbelegung. Jeder Vorschlag ist nachvollziehbar.
            </p>
          </article>

          <article className={cn(CELL, 'bg-muted/60')}>
            <CalendarDays className="h-7 w-7 text-brand-primary" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-bold text-foreground">Buchungen</h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Monatskalender, Drag &amp; Drop und Konflikterkennung in Echtzeit.
            </p>
          </article>

          <article className={cn(CELL, 'bg-muted/60')}>
            <BarChart3 className="h-7 w-7 text-brand-primary" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-bold text-foreground">Auswertungen</h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Auslastung und Kennzahlen deines Vereins auf einem Bildschirm.
            </p>
          </article>

          <article className={cn(CELL, 'bg-muted/60')}>
            <Users className="h-7 w-7 text-brand-primary" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-bold text-foreground">Mitglieder</h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Zentrale Verwaltung, Gruppenbildung und eigene Zugänge je Rolle.
            </p>
          </article>

          <article className={cn(CELL, 'bg-brand-secondary text-white')}>
            <ShieldCheck className="h-7 w-7 text-brand-light" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-bold">Datenschutz</h3>
            <p className="mt-2 text-white/75 leading-relaxed">
              DSGVO-konform, Hosting in der EU, Daten strikt je Verein getrennt.
            </p>
          </article>

          <article className={cn(CELL, 'bg-muted/60 md:col-span-2')}>
            <Plug className="h-7 w-7 text-brand-primary" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-bold text-foreground">Schnittstelle</h3>
            <p className="mt-2 text-muted-foreground leading-relaxed max-w-md">
              Eine REST-API für die Anbindung an eure bestehenden Systeme.
            </p>
          </article>
        </div>
      </div>
    </SectionReveal>
  );
}
