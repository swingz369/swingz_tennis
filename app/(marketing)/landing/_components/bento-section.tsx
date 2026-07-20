/**
 * Feature-Sektion — App-Design
 *
 * FeatureCard-Grid (shadcn-Stil wie im Dashboard) statt des früheren
 * Editorial-Bento-Layouts. Server Component — pure JSX.
 */

import { Sparkles, CalendarDays, BarChart3, Users, ShieldCheck, Plug } from 'lucide-react';
import { FeatureCard } from '@/components/ui/feature-card';
import { SectionReveal } from './section-reveal';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'KI-Scheduling',
    body: 'Wochenplanung unter Berücksichtigung von Trainer-Kapazitäten, Gruppenbedürfnissen und Hallenverfügbarkeit — vollautomatisch, mit Audit-Trail für jeden Vorschlag.',
    highlight: true,
  },
  {
    icon: CalendarDays,
    title: 'Buchungen',
    body: 'Monatskalender, Drag & Drop, Konflikt-Erkennung in Echtzeit.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    body: 'KPIs, Auslastung, Vorhersagen — auf einem Bildschirm.',
  },
  {
    icon: Users,
    title: 'Mitglieder',
    body: 'Zentrale Verwaltung, Gruppenbildung, personalisierte Zugänge.',
  },
  {
    icon: ShieldCheck,
    title: 'Sicherheit',
    body: 'RBAC, DSGVO, EU-Hosting — von Anfang an für Wachstum gebaut.',
  },
  {
    icon: Plug,
    title: 'API & Integrationen',
    body: 'REST-API für die Anbindung an euren Tech-Stack.',
  },
];

export function BentoSection() {
  return (
    <SectionReveal
      as="section"
      id="section-features"
      aria-labelledby="features-heading"
      className="py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent mb-3">
            Funktionen
          </p>
          <h2
            id="features-heading"
            className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
          >
            Sechs Werkzeuge. Ein Vereinsleben.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            KI-gestützt, mit Bedacht entworfen. Jedes Werkzeug tut das, was es tun muss — ohne
            Umwege.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <FeatureCard
                key={feat.title}
                icon={<Icon className="h-7 w-7" aria-hidden="true" />}
                title={feat.title}
                description={feat.body}
                highlight={feat.highlight}
              />
            );
          })}
        </div>
      </div>
    </SectionReveal>
  );
}
