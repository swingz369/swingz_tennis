import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Trophy, Shield, Mail, Database, Lock, Eye, Trash2, FileText } from 'lucide-react';

export const metadata = {
  title: 'Datenschutzerklärung – SWINGZ',
  description: 'Datenschutzerklärung der SWINGZ-Plattform gemäß DSGVO.',
};

export default function DatenschutzPage() {
  const lastUpdated = '10. Juni 2026';
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
            <Shield className="h-4 w-4" /> Datenschutz
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Datenschutzerklärung
          </h1>
          <p className="mt-4 text-muted-foreground">Zuletzt aktualisiert: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 prose prose-slate dark:prose-invert">
          <Section icon={<FileText className="h-5 w-5" />} title="1. Verantwortlicher">
            <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
            <p>
              SWINGZ GmbH
              <br />
              Musterstraße 1
              <br />
              12345 Musterstadt
              <br />
              Deutschland
            </p>
            <p>
              E-Mail:{' '}
              <a
                href="mailto:datenschutz@swingz.cloud"
                className="text-brand-primary hover:underline"
              >
                datenschutz@swingz.cloud
              </a>
            </p>
          </Section>

          <Section icon={<Shield className="h-5 w-5" />} title="2. Datenschutzbeauftragter">
            <p>Du erreichst unseren Datenschutzbeauftragten unter:</p>
            <p>
              E-Mail:{' '}
              <a
                href="mailto:datenschutz@swingz.cloud"
                className="text-brand-primary hover:underline"
              >
                datenschutz@swingz.cloud
              </a>
            </p>
          </Section>

          <Section
            icon={<Database className="h-5 w-5" />}
            title="3. Erhebung und Verarbeitung personenbezogener Daten"
          >
            <p>
              Wir erheben und verarbeiten personenbezogene Daten nur im Rahmen der einschlägigen
              Datenschutzvorschriften (DSGVO, BDSG, TTDSG). Personenbezogene Daten sind alle Daten,
              die auf dich persönlich beziehbar sind, z.B. Name, Adresse, E-Mail-Adresse,
              IP-Adresse, Nutzerverhalten.
            </p>
            <h4>3.1 Bei der Nutzung unserer Website</h4>
            <p>Beim Besuch unserer Website werden automatisch folgende Daten verarbeitet:</p>
            <ul>
              <li>IP-Adresse</li>
              <li>Datum und Uhrzeit der Anfrage</li>
              <li>Browsertyp und -version</li>
              <li>Betriebssystem</li>
              <li>Referrer-URL</li>
            </ul>
            <p>
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO zur
              Bereitstellung der Website und zur Sicherheit unserer informationstechnischen Systeme.
            </p>
            <h4>3.2 Bei Registrierung und Nutzung der Plattform</h4>
            <p>
              Bei der Registrierung erheben wir: Name, E-Mail-Adresse, Vereinszugehörigkeit, Rolle
              (Trainer, Mitglied, Admin), Profilinformationen, Kalender- und Verfügbarkeitsdaten.
              Die Verarbeitung erfolgt zur Vertragserfüllung gemäß Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <h4>3.3 Zahlungsdaten</h4>
            <p>
              Zahlungsdaten werden ausschließlich über unseren zertifizierten Zahlungsdienstleister
              verarbeitet. Wir speichern keine vollständigen Bank- oder Kreditkartendaten.
            </p>
          </Section>

          <Section icon={<Lock className="h-5 w-5" />} title="4. Cookies und Local Storage">
            <p>
              Wir verwenden Cookies und Local Storage nur im technisch notwendigen Umfang (z.B.
              Authentifizierung, Spracheinstellung). Analyse-Cookies werden nur mit deiner
              ausdrücklichen Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO gesetzt. Du kannst
              Cookies jederzeit in deinen Browsereinstellungen deaktivieren.
            </p>
          </Section>

          <Section icon={<Mail className="h-5 w-5" />} title="5. Datenübermittlung an Dritte">
            <p>
              Eine Übermittlung deiner personenbezogenen Daten an Dritte findet nicht statt, außer:
            </p>
            <ul>
              <li>du hast deine ausdrückliche Einwilligung erteilt (Art. 6 Abs. 1 lit. a DSGVO)</li>
              <li>
                die Übermittlung ist zur Vertragserfüllung erforderlich (Art. 6 Abs. 1 lit. b DSGVO)
              </li>
              <li>eine rechtliche Verpflichtung besteht (Art. 6 Abs. 1 lit. c DSGVO)</li>
              <li>
                die Übermittlung ist zur Wahrung berechtigter Interessen erforderlich (Art. 6 Abs. 1
                lit. f DSGVO)
              </li>
            </ul>
            <p>
              Wir setzen ausschließlich Auftragsverarbeiter ein, mit denen ein Vertrag gemäß Art. 28
              DSGVO abgeschlossen wurde.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5" />} title="6. Speicherdauer">
            <p>
              Wir speichern deine personenbezogenen Daten nur so lange, wie dies zur Erfüllung der
              jeweiligen Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen.
              Nach Wegfall des Zwecks werden die Daten gelöscht oder in der Verarbeitung
              eingeschränkt.
            </p>
          </Section>

          <Section icon={<Eye className="h-5 w-5" />} title="7. Deine Rechte als Betroffener">
            <p>Du hast gegenüber uns folgende Rechte bezüglich deiner personenbezogenen Daten:</p>
            <ul>
              <li>
                <strong>Auskunftsrecht</strong> (Art. 15 DSGVO)
              </li>
              <li>
                <strong>Recht auf Berichtigung</strong> (Art. 16 DSGVO)
              </li>
              <li>
                <strong>Recht auf Löschung</strong> (Art. 17 DSGVO)
              </li>
              <li>
                <strong>Recht auf Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)
              </li>
              <li>
                <strong>Recht auf Widerspruch</strong> (Art. 21 DSGVO)
              </li>
              <li>
                <strong>Recht auf Datenübertragbarkeit</strong> (Art. 20 DSGVO)
              </li>
              <li>
                <strong>Recht auf Widerruf der Einwilligung</strong> (Art. 7 Abs. 3 DSGVO)
              </li>
            </ul>
            <p>
              Zur Ausübung dieser Rechte kannst du dich jederzeit an{' '}
              <a
                href="mailto:datenschutz@swingz.cloud"
                className="text-brand-primary hover:underline"
              >
                datenschutz@swingz.cloud
              </a>{' '}
              wenden.
            </p>
          </Section>

          <Section icon={<Shield className="h-5 w-5" />} title="8. Beschwerderecht">
            <p>
              Du hast das Recht, dich bei der zuständigen Aufsichtsbehörde zu beschweren, wenn du
              der Ansicht bist, dass die Verarbeitung deiner personenbezogenen Daten gegen die DSGVO
              verstößt. Die für unser Unternehmen zuständige Aufsichtsbehörde ist:
            </p>
            <p>
              Landesbeauftragte/r für den Datenschutz und die Informationsfreiheit des jeweiligen
              Bundeslandes, in dem unser Unternehmen seinen Sitz hat.
            </p>
          </Section>

          <Section icon={<Lock className="h-5 w-5" />} title="9. SSL-Verschlüsselung">
            <p>
              Diese Website nutzt aus Sicherheitsgründen und zum Schutz der Übertragung
              vertraulicher Inhalte eine SSL-Verschlüsselung. Eine verschlüsselte Verbindung
              erkennst du daran, dass die Adresszeile des Browsers von „http://" auf „https://"
              wechselt und an dem Schloss-Symbol in deiner Browserzeile.
            </p>
          </Section>

          <Section icon={<Trash2 className="h-5 w-5" />} title="10. Recht auf Löschung">
            <p>
              Du kannst von uns verlangen, dass wir deine personenbezogenen Daten löschen, sofern
              keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Die Löschung erfolgt
              unverzüglich, in der Regel innerhalb von 30 Tagen nach Anfrage.
            </p>
            <p>
              Konto-Löschung:{' '}
              <a
                href="mailto:datenschutz@swingz.cloud"
                className="text-brand-primary hover:underline"
              >
                datenschutz@swingz.cloud
              </a>
            </p>
          </Section>

          <Section
            icon={<FileText className="h-5 w-5" />}
            title="11. Änderungen der Datenschutzerklärung"
          >
            <p>
              Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den
              aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen
              umzusetzen. Für deinen erneuten Besuch gilt dann die neue Datenschutzerklärung.
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
