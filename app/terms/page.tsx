import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { Trophy, FileText, Scale, AlertCircle, CreditCard, LogOut } from 'lucide-react';

export const metadata = {
  title: 'Nutzungsbedingungen – SWINGZ',
  description: 'Allgemeine Geschäftsbedingungen (AGB) der SWINGZ-Plattform.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  const lastUpdated = '10. Juni 2026';
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="relative overflow-hidden bg-brand-secondary">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-auth-hero" />
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
            <Scale className="h-4 w-4" /> Rechtliches
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Nutzungsbedingungen
          </h1>
          <p className="mt-4 text-muted-foreground">
            Allgemeine Geschäftsbedingungen (AGB) · Zuletzt aktualisiert: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 prose prose-slate dark:prose-invert">
          <Section icon={<FileText className="h-5 w-5" />} title="1. Geltungsbereich">
            <p>
              Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge, die zwischen der
              SWINGZ GmbH (nachfolgend „Anbieter") und dem Nutzer (nachfolgend „Kunde") über die
              Nutzung der SaaS-Plattform SWINGZ (nachfolgend „Plattform") geschlossen werden. Die
              Plattform dient der Verwaltung von Tennis- und Sportvereinen, einschließlich
              Mitgliederverwaltung, Trainingsplanung, Buchungssystem, Zahlungsabwicklung und
              automatischer Saisonplanung.
            </p>
            <p>
              Abweichende, entgegenstehende oder ergänzende Allgemeine Geschäftsbedingungen des
              Kunden werden, selbst bei Kenntnis, nicht Vertragsbestandteil, es sei denn, ihrer
              Geltung wird ausdrücklich schriftlich zugestimmt.
            </p>
          </Section>

          <Section
            icon={<FileText className="h-5 w-5" />}
            title="2. Vertragsschluss und Registrierung"
          >
            <p>
              Die Nutzung der Plattform setzt eine Registrierung voraus. Mit der Registrierung kommt
              ein Nutzungsvertrag zwischen dem Kunden und dem Anbieter zustande. Die Registrierung
              ist kostenlos; kostenpflichtig wird die Nutzung erst durch Buchung eines
              kostenpflichtigen Tarifs.
            </p>
            <p>Voraussetzungen für die Registrierung:</p>
            <ul>
              <li>Vollendung des 18. Lebensjahres</li>
              <li>Angabe wahrheitsgemäßer und vollständiger Daten</li>
              <li>Zustimmung zu diesen AGB und der Datenschutzerklärung</li>
            </ul>
            <p>
              Der Anbieter behält sich das Recht vor, Registrierungen ohne Angabe von Gründen
              abzulehnen oder bestehende Konten mit sofortiger Wirkung zu sperren, sofern
              berechtigte Interessen dies rechtfertigen.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5" />} title="3. Leistungsbeschreibung">
            <p>
              SWINGZ stellt dem Kunden eine cloudbasierte Verwaltungsplattform für Sportvereine zur
              Verfügung. Der Funktionsumfang richtet sich nach dem jeweils gebuchten Tarif:
            </p>
            <ul>
              <li>
                <strong>Free:</strong> Bis zu 50 Mitglieder, Basisverwaltung, Court-Buchung
              </li>
              <li>
                <strong>Pro:</strong> Bis zu 500 Mitglieder, Saisonplanung, Trainer-Verwaltung,
                Rechnungen
              </li>
              <li>
                <strong>Enterprise:</strong> Unbegrenzte Mitglieder, automatische Saisonplanung,
                Multi-Club-Verwaltung, API-Zugang
              </li>
            </ul>
            <p>
              Die Verfügbarkeit der Plattform beträgt 99,5% im Jahresmittel, ausgenommen
              Wartungsfenster, höhere Gewalt und vom Kunden zu vertretende Ausfälle.
            </p>
          </Section>

          <Section
            icon={<CreditCard className="h-5 w-5" />}
            title="4. Preise und Zahlungsbedingungen"
          >
            <p>
              Die aktuellen Preise sind auf der Website einsehbar. Alle Preise verstehen sich netto,
              zzgl. der gesetzlichen Mehrwertsteuer. Die Abrechnung erfolgt monatlich oder jährlich
              im Voraus, je nach Wahl des Kunden.
            </p>
            <p>
              Die Zahlung erfolgt per SEPA-Lastschrift, Kreditkarte oder Überweisung. Bei
              Zahlungsverzug ist der Anbieter berechtigt, den Zugang zur Plattform vorübergehend zu
              sperren. Mahnkosten gehen zu Lasten des Kunden.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5" />} title="5. Widerrufsbelehrung">
            <p>
              Verbrauchern steht ein Widerrufsrecht nach folgender Maßgabe zu, wobei Verbraucher
              jede natürliche Person ist, die ein Rechtsgeschäft zu Zwecken abschließt, die
              überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit
              zugerechnet werden können:
            </p>
            <p>
              <strong>Widerrufsrecht</strong>
              <br />
              Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu
              widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.
              Um dein Widerrufsrecht auszuüben, musst du uns (SWINGZ GmbH, Musterstraße 1, 12345
              Musterstadt, E-Mail: widerruf@swingz.cloud) mittels einer eindeutigen Erklärung (z.B.
              ein mit der Post versandter Brief oder E-Mail) über deinen Entschluss, diesen Vertrag
              zu widerrufen, informieren.
            </p>
            <p>
              Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung
              des Widerrufsrechts vor Ablauf der Widerrufsfrist absendest.
            </p>
          </Section>

          <Section icon={<AlertCircle className="h-5 w-5" />} title="6. Haftung">
            <p>
              Der Anbieter haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des
              Körpers oder der Gesundheit, die auf einer vorsätzlichen oder fahrlässigen
              Pflichtverletzung des Anbieters beruhen. Für sonstige Schäden haftet der Anbieter nur
              bei Vorsatz und grober Fahrlässigkeit.
            </p>
            <p>
              Eine Haftung für die inhaltliche Richtigkeit der vom Kunden eingegebenen Daten ist
              ausgeschlossen. Der Kunde ist für die regelmäßige Sicherung seiner Daten
              verantwortlich.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5" />} title="7. Verfügbarkeit und Wartung">
            <p>
              Der Anbieter bemüht sich um eine hohe Verfügbarkeit der Plattform. Geplante
              Wartungsarbeiten werden nach Möglichkeit außerhalb der Hauptbetriebszeiten
              durchgeführt und rechtzeitig angekündigt. Bei ungeplanten Ausfällen wird der Anbieter
              im Rahmen seiner betrieblichen Möglichkeiten eine schnelle Wiederherstellung
              anstreben.
            </p>
          </Section>

          <Section icon={<LogOut className="h-5 w-5" />} title="8. Kündigung">
            <p>
              Der Vertrag kann von beiden Seiten mit einer Frist von 30 Tagen zum Ende der
              jeweiligen Vertragslaufzeit gekündigt werden. Das Recht zur außerordentlichen
              Kündigung aus wichtigem Grund bleibt unberührt.
            </p>
            <p>
              Die Kündigung bedarf der Textform (E-Mail ausreichend). Nach Wirksamwerden der
              Kündigung werden die Daten des Kunden gemäß unserer Datenschutzerklärung gelöscht,
              sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5" />} title="9. Änderungen der AGB">
            <p>
              Der Anbieter behält sich vor, diese AGB zu ändern, soweit dies aus wichtigen
              rechtlichen oder technischen Gründen erforderlich ist. Änderungen werden dem Kunden
              mindestens 30 Tage vor Inkrafttreten per E-Mail mitgeteilt. Widerspricht der Kunde
              nicht innerhalb der Frist, gelten die Änderungen als genehmigt. Auf dieses
              Widerspruchsrecht wird in der Mitteilung gesondert hingewiesen.
            </p>
          </Section>

          <Section icon={<Scale className="h-5 w-5" />} title="10. Schlussbestimmungen">
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts
              (CISG). Ist der Kunde Verbraucher, gilt diese Rechtswahl nur insoweit, als nicht der
              gewährte Schutz durch zwingende Bestimmungen des Rechts des Staates, in dem der
              Verbraucher seinen gewöhnlichen Aufenthalt hat, entzogen wird.
            </p>
            <p>
              Gerichtsstand für alle Streitigkeiten aus diesem Vertrag ist Musterstadt, sofern der
              Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches
              Sondervermögen ist.
            </p>
            <p>
              Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, so wird hierdurch
              die Wirksamkeit der übrigen Bestimmungen nicht berührt.
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
