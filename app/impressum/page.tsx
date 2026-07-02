import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { Trophy, FileText, Mail, MapPin, Globe } from 'lucide-react';

export const metadata = {
  title: 'Impressum – SWINGZ',
  description: 'Impressum der SWINGZ-Plattform gemäß § 5 TMG.',
  alternates: {
    canonical: '/impressum',
  },
};

export default function ImpressumPage() {
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
                <div className="absolute inset-0 bg-gradient-to-br from-brand-light to-brand-primary rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
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
            <FileText className="h-4 w-4" /> Rechtliches
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Impressum
          </h1>
          <p className="mt-4 text-muted-foreground">Angaben gemäß § 5 TMG</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 prose prose-slate dark:prose-invert">
          <Section icon={<FileText className="h-5 w-5" />} title="Angaben gemäß § 5 TMG">
            <p>
              SWINGZ GmbH
              <br />
              Musterstraße 1
              <br />
              12345 Musterstadt
              <br />
              Deutschland
            </p>
          </Section>

          <Section icon={<Mail className="h-5 w-5" />} title="Kontakt">
            <p>
              E-Mail:{' '}
              <a href="mailto:info@swingz.cloud" className="text-brand-primary hover:underline">
                info@swingz.cloud
              </a>
            </p>
            <p>
              Telefon:{' '}
              <a href="tel:+49123456789" className="text-brand-primary hover:underline">
                +49 123 456 789
              </a>
            </p>
          </Section>

          <Section
            icon={<MapPin className="h-5 w-5" />}
            title="Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV"
          >
            <p>
              SWINGZ GmbH
              <br />
              Musterstraße 1
              <br />
              12345 Musterstadt
            </p>
          </Section>

          <Section icon={<Globe className="h-5 w-5" />} title="Streitschlichtung">
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
              bereit:{' '}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-primary hover:underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>
              .
            </p>
            <p>
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5" />} title="Haftung für Inhalte">
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten
              nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
              Diensteanbieter jedoch nicht unter der Verpflichtung, übermittelte oder gespeicherte
              fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine
              rechtswidrige Tätigkeit hinweisen.
            </p>
            <p>
              Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
              allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch
              erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei
              Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend
              entfernen.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5" />} title="Haftung für Links">
            <p>
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
              Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr
              übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
              oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt
              der Verlinkung auf mögliche Rechtsverletzungen überprüft. Rechtswidrige Inhalte waren
              zum Zeitpunkt der Verlinkung nicht erkennbar.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5" />} title="Urheberrecht">
            <p>
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
              unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung
              und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
              schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien
              dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
            </p>
          </Section>
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
            <Link href="/avv" className="hover:text-white transition-colors">
              AVV
            </Link>
          </div>
          <p>© 2026 SWINGZ – Premium Tennis Club Management</p>
        </div>
      </footer>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-foreground m-0">{title}</h2>
      </div>
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}
