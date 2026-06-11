import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Trophy, Shield, ArrowRight, Mail } from 'lucide-react';

export const metadata = {
  title: 'Datenschutzrichtlinie – SWINGZ',
  description: 'Kurze Übersicht zur Datenverarbeitung bei SWINGZ.',
};

export default function PrivacyPage() {
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
                <Button variant="accent">Registrieren</Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-muted py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-semibold mb-4">
            <Shield className="h-4 w-4" /> Datenschutzrichtlinie
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Deine Daten sind bei uns sicher
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            SWINGZ verarbeitet personenbezogene Daten ausschließlich im Rahmen der DSGVO. Die
            ausführliche Datenschutzerklärung findest du hier.
          </p>
        </div>
      </section>

      {/* Summary + Link to full Datenschutzerklärung */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-foreground mb-4">Kurzfassung</h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary shrink-0" />
                <span>
                  Wir verarbeiten deine Daten nur, soweit dies zur Vertragserfüllung oder aufgrund
                  gesetzlicher Vorschriften erforderlich ist.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary shrink-0" />
                <span>
                  Deine Daten werden nicht ohne deine Einwilligung an Dritte weitergegeben.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary shrink-0" />
                <span>
                  Du hast jederzeit das Recht auf Auskunft, Berichtigung, Löschung und
                  Datenübertragbarkeit (Art. 15–20 DSGVO).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary shrink-0" />
                <span>
                  Die Datenübertragung erfolgt ausschließlich über SSL-verschlüsselte Verbindungen.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary shrink-0" />
                <span>
                  Wir hosten in der EU (Frankfurt, Deutschland) — deine Daten verlassen die EU
                  nicht.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-brand-primary to-brand-light p-6 sm:p-8 text-white">
            <h2 className="text-xl font-bold mb-2">Vollständige Datenschutzerklärung</h2>
            <p className="text-white/80 mb-6">
              Hier findest du die ausführliche Datenschutzerklärung gemäß Art. 13 und Art. 14 DSGVO
              mit allen Details zu Verantwortlichem, Erhebung, Verarbeitung, Speicherung und deinen
              Rechten.
            </p>
            <Link href="/datenschutz">
              <Button
                size="lg"
                variant="secondary"
                className="bg-background text-brand-primary hover:bg-background/90"
              >
                Datenschutzerklärung lesen
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-muted/50 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <Mail className="h-5 w-5 text-brand-primary" /> Kontakt zum Datenschutz-Team
            </h2>
            <p className="text-muted-foreground mb-3">
              Bei Fragen zur Verarbeitung deiner personenbezogenen Daten oder zur Ausübung deiner
              Betroffenenrechte:
            </p>
            <a
              href="mailto:datenschutz@swingz.app"
              className="text-brand-primary hover:underline font-medium"
            >
              datenschutz@swingz.app
            </a>
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
            <Link href="/contact" className="hover:text-white transition-colors">
              Kontakt
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Nutzungsbedingungen
            </Link>
            <Link href="/datenschutz" className="hover:text-white transition-colors">
              Datenschutz
            </Link>
          </div>
          <p>© 2026 SWINGZ – Premium Tennis Club Management</p>
        </div>
      </footer>
    </div>
  );
}
