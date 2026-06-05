import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Shield, Users, Brain, Sparkles } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">SWINGZ</span>
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
              <Link href="/register">
                <Button variant="accent">Kostenlos starten</Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-muted py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-semibold mb-4">
            Über SWINGZ
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Die Zukunft des{' '}
            <span className="text-gradient-primary bg-clip-text text-transparent">
              Tennis-Club-Managements
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            SWINGZ wurde entwickelt, um Tennisclubs dabei zu helfen, ihre Trainingsplanung zu
            revolutionieren. Mit modernster KI-Technologie optimieren wir Abläufe, steigern die
            Auslastung und schaffen ein Premium-Erlebnis für Mitglieder und Trainer.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                Unsere Mission
              </h2>
              <p className="mt-6 text-muted-foreground leading-relaxed text-lg">
                Wir glauben, dass exzellentes Vereinsmanagement der Schlüssel zu erfolgreichen
                Tennisclubs ist. Deshalb haben wir eine Plattform geschaffen, die administrative
                Aufgaben automatisiert und dir mehr Zeit für das Wesentliche gibt: großartiges
                Training und zufriedene Mitglieder.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed text-lg">
                Mit KI-gestützter Saisonplanung, intelligentem Scheduling und umfassenden Analytics
                setzen wir neue Maßstäbe für Tennisclubs jeder Größe.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '1.200+', label: 'Vereine', icon: Shield },
                { value: '50K+', label: 'Trainings geplant', icon: Brain },
                { value: '85K+', label: 'Mitglieder', icon: Users },
                { value: '10K+', label: 'KI-Optimierungen', icon: Sparkles },
              ].map((stat, idx) => (
                <div key={idx} className="bg-muted rounded-2xl p-6 text-center">
                  <stat.icon className="h-8 w-8 mx-auto text-brand-primary mb-2" />
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team / Values */}
      <section className="bg-muted py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Unsere Werte
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Was uns antreibt und auszeichnet.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Innovation',
                description:
                  'Wir setzen auf modernste KI-Technologie, um Prozesse zu automatisieren und zu optimieren.',
                icon: Brain,
              },
              {
                title: 'Community',
                description:
                  'Unser Fokus liegt auf dem Erfolg von Tennisclubs und der Zufriedenheit ihrer Mitglieder.',
                icon: Users,
              },
              {
                title: 'Exzellenz',
                description:
                  'Von der Benutzeroberfläche bis zur Infrastruktur – wir streben nach höchster Qualität.',
                icon: Shield,
              },
            ].map((value, idx) => (
              <div
                key={idx}
                className="bg-background rounded-2xl p-8 shadow-sm border border-border"
              >
                <value.icon className="h-10 w-10 text-brand-primary mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-3">{value.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-gray-900 to-gray-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Bereit für SWINGZ?
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Starte jetzt und erlebe die Zukunft des Vereinsmanagements.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button variant="accent" size="lg">
                Kostenlos starten <ArrowRight className="ml-2 h-4 w-4" />
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
      <footer className="bg-gray-900 py-8 border-t border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <p>© 2025 SWINGZ – Premium Tennis Club Management</p>
        </div>
      </footer>
    </div>
  );
}
