import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Mail, MapPin, Sparkles, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Kontakt — SWINGZ',
  description:
    'Early Access anfragen und SWINGZ als Early Adopter testen. 6 Monate kostenlos, kein Risiko.',
  alternates: {
    canonical: '/contact',
  },
};
import { IconBox } from '@/components/ui/icon-box';
import { ContactFormClient } from './contact-form-client';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-brand-secondary">
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
                <Button variant="accent">Kostenlos registrieren</Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-muted py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-semibold mb-4">
            <Zap className="h-3.5 w-3.5" />
            Kostenlos testen
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Demo anfragen
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Erlebe SWINGZ in einer persönlichen Demo. Wir zeigen dir, wie die KI-gestützte
            Trainingsplanung deinen Verein unterstützt.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Form — Client Component */}
            <ContactFormClient />

            {/* Contact Info — Static */}
            <div className="space-y-8">
              <div className="bg-muted rounded-3xl p-8">
                <h3 className="text-xl font-bold text-foreground mb-6">So erreichst du uns</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <IconBox icon={Mail} size="sm" variant="light" />
                    <div>
                      <p className="font-medium text-foreground">E-Mail</p>
                      <a
                        href="mailto:info@swingz.cloud"
                        className="text-brand-primary hover:underline"
                      >
                        info@swingz.cloud
                      </a>
                      <p className="text-sm text-muted-foreground mt-1">
                        Wir antworten persönlich innerhalb von 24h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <IconBox icon={MapPin} size="sm" variant="gray" />
                    <div>
                      <p className="font-medium text-foreground">Entwicklung</p>
                      <p className="text-muted-foreground">Made in Deutschland 🇩🇪</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Daten werden ausschließlich in der EU gehostet
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-brand-primary to-brand-light rounded-3xl p-8 text-white">
                <Sparkles className="h-8 w-8 mb-4" />
                <h3 className="text-xl font-bold mb-2">Warum SWINGZ?</h3>
                <ul className="space-y-2 text-white/80 text-sm mb-6">
                  <li className="flex items-start gap-2">
                    <span className="text-white mt-0.5">✓</span>
                    <span>14 Tage kostenlos testen</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white mt-0.5">✓</span>
                    <span>Persönliches Onboarding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white mt-0.5">✓</span>
                    <span>Keine Kreditkarte erforderlich</span>
                  </li>
                </ul>
                <Link href="#contact-form">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full bg-background text-brand-primary hover:bg-background/90"
                  >
                    Demo anfragen
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-secondary py-8 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
            <Link href="/about" className="hover:text-white transition-colors">
              Über uns
            </Link>
            <Link href="/" className="hover:text-white transition-colors">
              Startseite
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Anmelden
            </Link>
          </div>
          <p>© 2026 SWINGZ</p>
        </div>
      </footer>
    </div>
  );
}
