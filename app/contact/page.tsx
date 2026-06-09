import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
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
            Kontakt
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Wir sind für dich da
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Hast du Fragen zu SWINGZ? Möchtest du einen Testzugang oder ein individuelles Angebot?
            Wir freuen uns auf deine Nachricht.
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
                <h3 className="text-xl font-bold text-foreground mb-6">Kontaktmöglichkeiten</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="h-5 w-5 text-brand-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">E-Mail</p>
                      <a
                        href="mailto:info@swingz.app"
                        className="text-brand-primary hover:underline"
                      >
                        info@swingz.app
                      </a>
                      <p className="text-sm text-muted-foreground mt-1">
                        Wir antworten innerhalb von 24h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-brand-accent/10 flex items-center justify-center shrink-0">
                      <Phone className="h-5 w-5 text-brand-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Telefon</p>
                      <a href="tel:+491234567890" className="text-brand-primary hover:underline">
                        +49 123 4567890
                      </a>
                      <p className="text-sm text-muted-foreground mt-1">Mo–Fr, 9:00–17:00 Uhr</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Adresse</p>
                      <p className="text-muted-foreground">SWINGZ GmbH</p>
                      <p className="text-muted-foreground">
                        {process.env.NEXT_PUBLIC_CLUB_ADDRESS || 'Adresse auf Anfrage'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-brand-primary to-brand-light rounded-3xl p-8 text-white">
                <Sparkles className="h-8 w-8 mb-4" />
                <h3 className="text-xl font-bold mb-2">Testzugang anfragen</h3>
                <p className="text-white/80 mb-6">
                  Teste SWINGZ 30 Tage kostenlos und unverbindlich.
                </p>
                <Link href="/register">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full bg-background text-brand-primary hover:bg-background/90"
                  >
                    Jetzt Testzugang sichern
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
          <p>© 2025 SWINGZ – Premium Tennis Club Management</p>
        </div>
      </footer>
    </div>
  );
}
