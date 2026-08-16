import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { Trophy, FileText, ShieldCheck, Server, AlertCircle, Scale } from 'lucide-react';

export const metadata = {
  title: 'Auftragsverarbeitungsvertrag (AVV) – SWINGZ',
  description:
    'Vertrag zur Auftragsverarbeitung gemäß Art. 28 DSGVO zwischen Verein (Verantwortlicher) und SWINGZ GmbH (Auftragsverarbeiter).',
  alternates: {
    canonical: '/avv',
  },
};

export default function AVVPage() {
  const lastUpdated = '2. Juli 2026';
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="relative overflow-hidden bg-brand-secondary">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-auth-hero" />
          <div className="absolute inset-0 opacity-25 overflow-hidden">
            <div className="absolute -top-10 left-10 w-48 h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
            <div className="absolute -bottom-16 right-20 w-56 h-56 bg-brand-accent/8 rounded-full blur-3xl animate-aurora [animation-delay:5s]" />
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
            <ShieldCheck className="h-4 w-4" /> Rechtliches · DSGVO
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Auftragsverarbeitungsvertrag (AVV)
          </h1>
          <p className="mt-4 text-muted-foreground">
            Vertrag zur Auftragsverarbeitung gemäß Art. 28 DSGVO · Zuletzt aktualisiert:{' '}
            {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 prose prose-slate dark:prose-invert">
          <div className="mb-10 rounded-xl border border-border bg-muted/50 p-6 text-sm text-muted-foreground">
            <strong className="text-foreground">Hinweis:</strong> Dieser AVV ist eine
            Vertragsvorlage auf Basis gängiger Muster (u.a. Bitkom) und ersetzt keine
            Einzelfallprüfung durch eine Rechtsberatung. Vereine, die SWINGZ zur Verarbeitung von
            Mitgliederdaten nutzen, sind als Verantwortliche verpflichtet, mit SWINGZ als
            Auftragsverarbeiter einen AVV zu schließen (Art. 28 DSGVO). Zur Unterzeichnung bitte
            Kontakt über{' '}
            <a href="mailto:datenschutz@swingz.cloud" className="text-brand-primary">
              datenschutz@swingz.cloud
            </a>{' '}
            aufnehmen.
          </div>

          <Section icon={<FileText className="h-5 w-5" />} title="1. Gegenstand und Dauer">
            <p>
              Dieser Vertrag konkretisiert die datenschutzrechtlichen Pflichten der Parteien, die
              sich aus der Nutzung der SWINGZ-Plattform (nachfolgend „Auftragsverarbeitung")
              ergeben. Der Verein (nachfolgend „Verantwortlicher") beauftragt die SWINGZ GmbH
              (nachfolgend „Auftragsverarbeiter") mit der Verarbeitung personenbezogener Daten im
              Rahmen der Mitgliederverwaltung, Trainingsplanung, Buchungsverwaltung und
              Zahlungsabwicklung.
            </p>
            <p>
              Die Dauer dieses Vertrags entspricht der Laufzeit des Hauptvertrags (Nutzungsvertrag
              über die SWINGZ-Plattform, siehe{' '}
              <Link href="/terms" className="text-brand-primary">
                Nutzungsbedingungen
              </Link>
              ).
            </p>
          </Section>

          <Section
            icon={<FileText className="h-5 w-5" />}
            title="2. Art, Zweck und Kategorien der Verarbeitung"
          >
            <p>
              <strong>Zweck:</strong> Bereitstellung einer SaaS-Plattform zur Verwaltung von
              Mitgliedern, Trainingsangeboten, Platzbuchungen, Beitragsabrechnung und automatischer
              Saisonplanung.
            </p>
            <p>
              <strong>Kategorien betroffener Personen:</strong> Vereinsmitglieder, Trainer,
              Vereinsfunktionäre, ggf. Erziehungsberechtigte bei minderjährigen Mitgliedern.
            </p>
            <p>
              <strong>Kategorien personenbezogener Daten:</strong> Stammdaten (Name, Adresse,
              Geburtsdatum), Kontaktdaten (E-Mail, Telefon), Mitgliedschaftsdaten,
              Buchungs-/Anwesenheitsdaten, Zahlungsdaten (SEPA-Mandat, Rechnungsdaten — keine
              vollständigen Kartendaten, diese verarbeitet ausschließlich Stripe als
              Zahlungsdienstleister direkt).
            </p>
          </Section>

          <Section
            icon={<ShieldCheck className="h-5 w-5" />}
            title="3. Pflichten des Auftragsverarbeiters"
          >
            <ul>
              <li>
                Verarbeitung ausschließlich auf dokumentierte Weisung des Verantwortlichen, es sei
                denn, eine Verpflichtung nach dem Recht der Union oder der Mitgliedstaaten verlangt
                etwas anderes.
              </li>
              <li>
                Sicherstellung, dass zur Verarbeitung befugte Personen zur Vertraulichkeit
                verpflichtet wurden.
              </li>
              <li>
                Ergreifen aller nach Art. 32 DSGVO erforderlichen technischen und organisatorischen
                Maßnahmen (siehe Ziffer 4).
              </li>
              <li>
                Unterstützung des Verantwortlichen bei der Erfüllung von Betroffenenrechten
                (Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit).
              </li>
              <li>
                Unterstützung bei der Einhaltung der Pflichten nach Art. 32–36 DSGVO (Meldepflichten
                bei Datenschutzverletzungen, Datenschutz-Folgenabschätzung).
              </li>
              <li>
                Löschung oder Rückgabe aller personenbezogenen Daten nach Beendigung der
                Vertragsbeziehung, sofern keine gesetzliche Aufbewahrungspflicht entgegensteht
                (siehe Ziffer 7).
              </li>
              <li>
                Bereitstellung aller erforderlichen Informationen zum Nachweis der Einhaltung dieser
                Pflichten sowie Ermöglichung von Überprüfungen durch den Verantwortlichen (siehe
                Ziffer 6).
              </li>
            </ul>
          </Section>

          <Section
            icon={<ShieldCheck className="h-5 w-5" />}
            title="4. Technische und organisatorische Maßnahmen (Art. 32 DSGVO)"
          >
            <p>Der Auftragsverarbeiter setzt insbesondere folgende Maßnahmen um:</p>
            <ul>
              <li>
                Verschlüsselte Übertragung (TLS) für alle Client-Server-Verbindungen und
                verschlüsselte Speicherung sensibler Felder in der Datenbank.
              </li>
              <li>
                Mandantentrennung auf Datenbankebene je Verein mittels Row-Level-Security (RLS) —
                über 120 aktive RLS-Policies.
              </li>
              <li>
                Rollenbasierte Zugriffskontrolle (owner/superadmin/admin/trainer/member) mit
                serverseitiger Autorisierungsprüfung auf jeder API-Route.
              </li>
              <li>
                CSRF-Schutz, Rate-Limiting auf sensiblen Endpunkten (Login, Registrierung,
                Kontaktformular) sowie signaturbasierte Validierung eingehender Webhooks (Stripe).
              </li>
              <li>
                Strukturiertes Error-Monitoring (Sentry) ohne Ausgabe von Klartext-Stacktraces an
                Endnutzer.
              </li>
              <li>Regelmäßige Backups über den Infrastrukturanbieter (siehe Ziffer 5).</li>
            </ul>
          </Section>

          <Section icon={<Server className="h-5 w-5" />} title="5. Unterauftragsverarbeiter">
            <p>
              Der Verantwortliche erteilt hiermit die allgemeine Genehmigung zum Einsatz folgender
              Unterauftragsverarbeiter. Der Auftragsverarbeiter informiert über Änderungen dieser
              Liste; der Verantwortliche kann der Einbeziehung neuer Unterauftragsverarbeiter aus
              wichtigem Grund widersprechen.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Dienst</th>
                  <th>Zweck</th>
                  <th>Ort / Absicherung</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Supabase</td>
                  <td>Datenbank, Authentifizierung, Datei-Storage</td>
                  <td>EU-Region; ggf. Drittlandtransfer über SCC abgesichert</td>
                </tr>
                <tr>
                  <td>Vercel</td>
                  <td>Hosting, Deployment</td>
                  <td>EU-Region wählbar; SCC/EU-US Data Privacy Framework</td>
                </tr>
                <tr>
                  <td>Stripe</td>
                  <td>Zahlungsabwicklung</td>
                  <td>EU/US; SCC-abgesichert, eigener AVV mit Stripe</td>
                </tr>
                <tr>
                  <td>Resend</td>
                  <td>Transaktionale E-Mails</td>
                  <td>EU/US; SCC-abgesichert</td>
                </tr>
                <tr>
                  <td>Google (Gemini API)</td>
                  <td>KI-Matchmaking (Partner-Finder)</td>
                  <td>SCC-abgesichert; keine Übermittlung von Zahlungsdaten</td>
                </tr>
                <tr>
                  <td>Sentry</td>
                  <td>Fehler-Monitoring</td>
                  <td>EU-Region konfigurierbar; SCC-abgesichert</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section icon={<ShieldCheck className="h-5 w-5" />} title="6. Kontrollrechte">
            <p>
              Der Verantwortliche hat das Recht, sich von der Einhaltung der in diesem Vertrag
              vereinbarten Pflichten des Auftragsverarbeiters zu überzeugen. Der Auftragsverarbeiter
              stellt hierfür auf Anfrage geeignete Nachweise (z.B. Selbstauskunft, Dokumentation der
              TOM) zur Verfügung.
            </p>
          </Section>

          <Section
            icon={<AlertCircle className="h-5 w-5" />}
            title="7. Löschung und Rückgabe nach Vertragsende"
          >
            <p>
              Nach Beendigung des Nutzungsvertrags werden personenbezogene Daten des
              Verantwortlichen gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten (z.B.
              handels-/steuerrechtliche Fristen für Rechnungsdaten) entgegenstehen. Auf Wunsch
              erhält der Verantwortliche vor Löschung einen Datenexport.
            </p>
          </Section>

          <Section icon={<Scale className="h-5 w-5" />} title="8. Haftung und Schlussbestimmungen">
            <p>
              Es gelten die Haftungsregelungen der Nutzungsbedingungen. Sollten einzelne
              Bestimmungen dieses Vertrags unwirksam sein, bleibt die Wirksamkeit der übrigen
              Bestimmungen unberührt. Es gilt das Recht der Bundesrepublik Deutschland.
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
