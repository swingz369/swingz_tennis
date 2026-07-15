/**
 * Bento Section — Editorial Sports (Phase 3)
 *
 * Magazine-style laid-flat feature grid: a hero tile (KI-Scheduling,
 * spans 2 columns), a typography-only quote tile sandwiched to its
 * right (Editorial Note, no header chrome), and 5 supporting tiles
 * each with their own mono page-number footer ("p.04".."p.10").
 *
 * Server Component. No `'use client'` — pure JSX.
 */

import { SectionReveal } from './section-reveal';

/** Discriminated union — quote has no header chrome. */
type BentoFeature =
  | {
      span: 'lg' | 'sm';
      eyebrow: string;
      title: string;
      body: string;
      category: string;
    }
  | {
      span: 'quote';
      body: string;
      category: string;
    };

const BENTO_FEATURES: BentoFeature[] = [
  {
    eyebrow: 'I.',
    title: 'KI-Scheduling',
    body: 'Wochenplanung unter Berücksichtigung von Trainer-Kapazitäten, Gruppenbedürfnissen und Hallenverfügbarkeit — vollautomatisch, mit Audit-Trail für jeden Vorschlag.',
    span: 'lg',
    category: '→ Saisonplanung',
  },
  {
    body: 'Weniger Klicks, mehr Court. Die Plattform verschwindet im Hintergrund — damit das Vereinsleben im Vordergrund bleibt.',
    span: 'quote',
    category: 'Editorial Note',
  },
  {
    eyebrow: 'II.',
    title: 'Buchungen',
    body: 'Monatskalender. Drag & Drop. Konflikt-Erkennung in Echtzeit.',
    span: 'sm',
    category: '→ Court-Booking',
  },
  {
    eyebrow: 'III.',
    title: 'Analytics',
    body: 'KPIs, Auslastung, Vorhersagen — auf einem Bildschirm.',
    span: 'sm',
    category: '→ Reporting',
  },
  {
    eyebrow: 'IV.',
    title: 'Mitglieder',
    body: 'Zentrale Verwaltung, Gruppenbildung, personalisierte Zugänge.',
    span: 'sm',
    category: '→ CRM',
  },
  {
    eyebrow: 'V.',
    title: 'Sicherheit',
    body: 'RBAC, DSGVO, EU-Hosting — von Anfang an für Wachstum gebaut.',
    span: 'sm',
    category: '→ Compliance',
  },
  {
    eyebrow: 'VI.',
    title: 'API & Integrationen',
    body: 'REST-API für die Anbindung an euren Tech-Stack.',
    span: 'sm',
    category: '→ Integration',
  },
];

export function BentoSection() {
  return (
    <SectionReveal
      as="section"
      id="section-features"
      aria-labelledby="features-heading"
      className="py-20 sm:py-32 hairline-t"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 mb-14 sm:mb-20">
          <div className="lg:col-span-5">
            <p className="editorial-eyebrow text-brand-accent mb-5 flex items-center gap-3">
              <span className="rule-clay" aria-hidden="true" />
              Funktionen
            </p>
            <h2
              id="features-heading"
              className="font-editorial text-3xl sm:text-4xl md:text-5xl text-foreground tracking-tight"
            >
              Sechs Werkzeuge. <em className="italic text-brand-primary">Ein Vereinsleben.</em>
            </h2>
          </div>
          <p className="lg:col-span-6 lg:col-start-7 text-base sm:text-lg text-muted-foreground leading-relaxed self-end">
            KI-gestützt, mit Bedacht entworfen. Jedes Werkzeug tut das, was es tun muss — ohne
            Brimborium, ohne Bildschirmfüllende Animationen.
          </p>
        </div>

        {/* Bento Grid — Magazine lay-flat: Hero tile + Quote tile + 5 Supporting tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-foreground/10 border border-foreground/10 rounded-md overflow-hidden">
          {BENTO_FEATURES.map((feat, idx) => {
            const isHero = feat.span === 'lg';
            const isQuote = feat.span === 'quote';

            if (isQuote) {
              return (
                <article
                  key={`quote-${idx}`}
                  className="group relative bg-background p-8 sm:p-12 lg:p-14 flex flex-col justify-center transition-colors duration-300 hover:bg-foreground/[0.015]"
                >
                  <p className="font-editorial italic text-2xl sm:text-3xl lg:text-4xl text-foreground leading-snug">
                    {feat.body}
                  </p>
                  <p className="mt-8 font-mono text-[10px] uppercase tracking-widest text-brand-accent">
                    {feat.category}
                  </p>
                </article>
              );
            }

            return (
              <article
                key={feat.eyebrow}
                className={`group relative bg-background flex flex-col transition-colors duration-300 hover:bg-foreground/[0.015] ${
                  isHero ? 'md:col-span-2 lg:col-span-2 p-10 sm:p-14 lg:p-16' : 'p-8 sm:p-10'
                }`}
              >
                {/* Top chrome: page-number + numeral */}
                <div className="flex items-baseline justify-between mb-8 sm:mb-10">
                  <span
                    className={`font-editorial italic text-brand-accent leading-none ${
                      isHero ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl'
                    }`}
                  >
                    {feat.eyebrow}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    p. {String(idx + 4).padStart(2, '0')}
                  </span>
                </div>

                {/* Title */}
                <h3
                  className={`font-editorial text-foreground tracking-tight mb-4 sm:mb-5 ${
                    isHero ? 'text-3xl sm:text-4xl md:text-5xl' : 'text-2xl sm:text-[1.7rem]'
                  }`}
                >
                  {feat.title}
                </h3>

                {/* Body */}
                <p
                  className={`text-foreground/70 leading-relaxed flex-1 ${
                    isHero ? 'text-base sm:text-lg max-w-2xl' : 'text-sm'
                  }`}
                >
                  {feat.body}
                </p>

                {/* Dateline footer */}
                <p className="mt-8 pt-4 hairline-t font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {feat.category}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </SectionReveal>
  );
}
