import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';

export const metadata: Metadata = {
  title: 'Über uns — SWINGZ',
  description:
    'SWINGZ ist ein Early-Access-Startup: Trainingsplanung soll einfach, intelligent und für jeden Club zugänglich sein.',
};
import {
  Trophy,
  ArrowRight,
  Brain,
  Users,
  Heart,
  Lightbulb,
  Target,
  Rocket,
  Shield,
  Zap,
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-brand-secondary">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <IconBox
                icon={Trophy}
                size="md"
                variant="gradient-primary"
                className="h-10 w-10"
                iconClassName="h-5 w-5"
              />
              <span className="text-2xl font-bold text-white font-display">SWINGZ</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="text-white/90 hover:text-white hover:bg-background/10"
                >
                  Anmelden
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="accent">Early Access anfragen</Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-muted py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-accent/10 text-brand-accent text-sm font-semibold mb-4">
            <Rocket className="h-3.5 w-3.5" /> Über uns
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Wir bauen die Zukunft des{' '}
            <span className="text-gradient-primary bg-clip-text text-transparent">
              Tennisclub-Managements
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            SWINGZ ist ein Early-Access-Startup mit einer klaren Vision: Trainingsplanung soll
            einfach, intelligent und für jeden Club zugänglich sein — vom kleinen Verein bis zum
            großen Verband.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold mb-4">
                <Target className="h-3 w-3" /> Mission
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                Warum wir SWINGZ bauen
              </h2>
              <p className="mt-6 text-muted-foreground leading-relaxed text-lg">
                Tennisclubs stecken Stunden in manuelle Saisonplanung — Tabellen, E-Mails,
                Telefonate. Trainer-Verfügbarkeiten, Platzbelegungen und Gruppenaufteilungen müssen
                mühsam koordiniert werden.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed text-lg">
                Wir glauben, dass das besser geht. Mit SWINGZ automatisieren wir den Planungsprozess
                durch KI, sodass Vereinsverantwortliche sich auf das konzentrieren können, was
                wirklich zählt: großartiges Training und zufriedene Mitglieder.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: Brain,
                  title: 'KI-Optimierung',
                  description:
                    'Automatische Saisonplanung unter Berücksichtigung aller Randbedingungen.',
                },
                {
                  icon: Zap,
                  title: 'Zeitersparnis',
                  description: 'Weniger Administrative Arbeit, mehr Zeit für den Sport.',
                },
                {
                  icon: Users,
                  title: 'Für alle Rollen',
                  description: 'Admins, Trainer und Mitglieder — jeder hat seinen Zugang.',
                },
                {
                  icon: Shield,
                  title: 'DSGVO-konform',
                  description: 'Daten werden in der EU verarbeitet und gespeichert.',
                },
              ].map((item, idx) => (
                <div key={idx} className="bg-muted rounded-2xl p-6">
                  <item.icon className="h-8 w-8 text-brand-primary mb-3" />
                  <p className="text-sm font-bold text-foreground mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="bg-muted py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent text-xs font-semibold mb-4">
              <Lightbulb className="h-3 w-3" /> Vision
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Wo wir hinwollen
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Unsere Vision geht über eine einzelne Software hinaus.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: 'Intelligente Automatisierung',
                description:
                  'Jeder Tennisclub soll Zugang zu KI-gestützter Planung haben — unabhängig von der Größe oder dem Budget.',
              },
              {
                icon: Users,
                title: 'Starke Club-Communities',
                description:
                  'Wir wollen die Kommunikation zwischen Admins, Trainern und Mitgliedern nahtlos zusammenbringen.',
              },
              {
                icon: Heart,
                title: 'Nachhaltiges Wachstum',
                description:
                  'SWINGZ soll Clubs helfen, effizienter zu arbeiten und nachhaltig zu wachsen — ohne mehr Aufwand.',
              },
            ].map((vision, idx) => (
              <div
                key={idx}
                className="bg-background rounded-2xl p-8 shadow-sm border border-border"
              >
                <vision.icon className="h-10 w-10 text-brand-accent mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-3">{vision.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{vision.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold mb-4">
              <Users className="h-3 w-3" /> Team
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Die Menschen hinter SWINGZ
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Ein kleines, fokussiertes Team mit Leidenschaft für Tennis und Technologie.
            </p>
          </div>
          <div className="max-w-2xl mx-auto">
            <div className="bg-muted rounded-3xl p-8 sm:p-10 text-center">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-brand-primary to-brand-light flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-2xl font-bold text-white">M</span>
              </div>
              <h3 className="text-xl font-bold text-foreground">Gründerteam</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Entwickler & Tennis-Enthusiasten
              </p>
              <p className="text-muted-foreground leading-relaxed max-w-lg mx-auto">
                Wir sind ein Team aus Softwareentwicklern und Tennisspielern, die das Problem aus
                eigener Erfahrung kennen. SWINGZ entsteht aus der Überzeugung, dass Technologie den
                Vereinsalltag grundlegend verbessern kann.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold">
                  <Zap className="h-3 w-3" /> Early Stage
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-accent/10 text-brand-accent text-xs font-semibold">
                  <Heart className="h-3 w-3" /> Bootstrapped
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-gray-900 to-gray-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Bereit, die Zukunft mitzugestalten?
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Werde Early Adopter und hilf uns, die beste Plattform für Tennisclub-Management zu
            bauen.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button variant="accent" size="lg">
                Early Access anfragen <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                variant="ghost"
                size="lg"
                className="text-white/90 hover:text-white hover:bg-background/10 border border-white/20"
              >
                Kontakt aufnehmen
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-secondary py-8 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <p>© 2026 SWINGZ — Alle Rechte vorbehalten.</p>
        </div>
      </footer>
    </div>
  );
}
