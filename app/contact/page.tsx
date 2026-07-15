import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Mail, MapPin, Sparkles, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Kontakt — SWINGZ',
  description:
    'Fragen zu SWINGZ? Kontaktiere unser Team — wir antworten persönlich innerhalb von 24 Stunden.',
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
      <header className="relative overflow-hidden bg-brand-secondary">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 100% 100% at 30% 0%, hsl(var(--brand-primary-light) / 0.15) 0%, transparent 50%),
                radial-gradient(ellipse 70% 100% at 100% 100%, hsl(var(--brand-accent) / 0.12) 0%, transparent 50%),
                linear-gradient(135deg, hsl(150 55% 10%) 0%, hsl(var(--brand-secondary)) 60%, hsl(150 30% 8%) 100%)
              `,
            }}
          />
          <div className="absolute inset-0 opacity-25 overflow-hidden">
            <div className="absolute -top-10 left-10 w-48 h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
            <div
              className="absolute -bottom-16 right-20 w-56 h-56 bg-brand-accent/8 rounded-full blur-3xl animate-aurora"
              style={{ animationDelay: '5s' }}
            />
          </div>
          <div className="absolute inset-0 noise opacity-[0.04]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-light to-brand-primary rounded-xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                <IconBox icon={Trophy} variant="gradient-primary" iconClassName="h-6 w-6" />
              </div>
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
            Kontakt aufnehmen
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Fragen zu SWINGZ oder deinem Verein? Schreib uns — wir melden uns persönlich. Oder
            starte direkt mit 14 Tagen kostenlos testen.
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
              <div className="bg-muted rounded-xl p-8">
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

              <div className="bg-gradient-to-br from-brand-primary to-brand-light rounded-xl p-8 text-white">
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
                <Link href="/register">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full bg-background text-brand-primary hover:bg-background/90"
                  >
                    Kostenlos registrieren
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
