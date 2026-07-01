import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Trophy,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
  Clock,
  FileText,
  ArrowRight,
  BookOpen,
  Bug,
  Sparkles,
} from 'lucide-react';

export const metadata = {
  title: 'Support – SWINGZ',
  description: 'Hilfe und Support für die SWINGZ-Plattform.',
  alternates: {
    canonical: '/support',
  },
};

const FAQ = [
  {
    q: 'Wie kann ich mein Passwort zurücksetzen?',
    a: 'Gehe auf die Login-Seite und klicke auf „Passwort vergessen?". Du erhältst innerhalb weniger Minuten einen Reset-Link per E-Mail.',
    href: '/forgot-password',
    cta: 'Passwort zurücksetzen',
  },
  {
    q: 'Wo finde ich die Datenschutzerklärung?',
    a: 'Unsere vollständige Datenschutzerklärung gemäß DSGVO findest du in unserem Footer verlinkt auf jeder Seite.',
    href: '/datenschutz',
    cta: 'Datenschutz ansehen',
  },
  {
    q: 'Wie kann ich meinen Account löschen?',
    a: 'Sende eine E-Mail an datenschutz@swingz.cloud mit dem Betreff „Account-Löschung". Wir löschen deine Daten innerhalb von 30 Tagen gemäß DSGVO.',
    href: 'mailto:datenschutz@swingz.cloud',
    cta: 'E-Mail senden',
  },
  {
    q: 'Wie kontaktiere ich den Support?',
    a: 'Du erreichst unser Support-Team per E-Mail unter support@swingz.cloud oder über das Kontaktformular. Wir antworten innerhalb von 24 Stunden an Werktagen.',
    href: '/contact',
    cta: 'Kontakt aufnehmen',
  },
];

const CHANNELS = [
  {
    icon: <Mail className="h-6 w-6" />,
    title: 'E-Mail',
    description: 'support@swingz.cloud',
    note: 'Antwort innerhalb von 24h (Werktage)',
    href: 'mailto:support@swingz.cloud',
    color: 'text-brand-primary',
    bg: 'bg-brand-primary/10',
  },
  {
    icon: <MessageCircle className="h-6 w-6" />,
    title: 'Live-Chat',
    description: 'Im Dashboard verfügbar',
    note: 'Mo–Fr 9:00–17:00 Uhr',
    href: '/login',
    color: 'text-brand-accent',
    bg: 'bg-brand-accent/10',
  },
  {
    icon: <Phone className="h-6 w-6" />,
    title: 'Telefon',
    description: '+49 123 4567890',
    note: 'Für Enterprise-Kunden',
    href: 'tel:+491234567890',
    color: 'text-info-600',
    bg: 'bg-info-50',
  },
];

export default function SupportPage() {
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
            <LifeBuoy className="h-4 w-4" /> Support-Center
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Wie können wir helfen?
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Unser Support-Team ist für dich da. Wähle den Kanal, der dir am bequemsten ist.
          </p>
        </div>
      </section>

      {/* Contact Channels */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">Kontaktkanäle</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CHANNELS.map((channel) => (
              <Link key={channel.title} href={channel.href} className="block group">
                <Card variant="bordered" className="p-6 h-full hover:shadow-md transition-shadow">
                  <div
                    className={`h-12 w-12 rounded-xl ${channel.bg} flex items-center justify-center mb-4 ${channel.color}`}
                  >
                    {channel.icon}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{channel.title}</h3>
                  <p className={`font-medium ${channel.color} mb-2`}>{channel.description}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {channel.note}
                  </p>
                  <div className="mt-4 flex items-center text-sm text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    {channel.title === 'E-Mail' || channel.title === 'Telefon'
                      ? 'Öffnen'
                      : 'Zum Login'}
                    <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Resources */}
      <section className="py-16 sm:py-20 bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">Schnellzugriff</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResourceCard
              icon={<FileText className="h-5 w-5" />}
              title="Über uns"
              description="Vollständige Anleitungen, API-Referenz und Best Practices."
              href="/about"
              color="bg-info-50 text-info-600"
            />
            <ResourceCard
              icon={<BookOpen className="h-5 w-5" />}
              title="Über SWINGZ"
              description="Erfahre mehr über unsere Mission und unser Team."
              href="/about"
              color="bg-success-50 text-success-600"
            />
            <ResourceCard
              icon={<Bug className="h-5 w-5" />}
              title="Bug melden"
              description="Hast du einen Fehler gefunden? Sag uns Bescheid."
              href="mailto:bugs@swingz.cloud"
              color="bg-error-50 text-error-600"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
            Häufig gestellte Fragen
          </h2>
          <p className="text-muted-foreground text-center mb-8">
            Die Antwort auf die meisten Fragen findest du hier.
          </p>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <Card
                key={item.q}
                variant="bordered"
                className="p-5 hover:shadow-sm transition-shadow"
              >
                <h3 className="font-semibold text-foreground mb-2">{item.q}</h3>
                <p className="text-sm text-muted-foreground mb-3">{item.a}</p>
                <Link
                  href={item.href}
                  className="inline-flex items-center text-sm text-brand-primary hover:text-brand-light font-medium transition-colors"
                >
                  {item.cta}
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Status Banner */}
      <section className="pb-16 sm:pb-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-br from-brand-primary to-brand-light p-8 text-white">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-background/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Premium-Support für Enterprise</h3>
                <p className="text-white/80 mb-4">
                  Enterprise-Kunden erhalten priorisierten Support, dedizierte Ansprechpartner und
                  SLA-Garantien.
                </p>
                <Link href="/contact">
                  <Button
                    variant="secondary"
                    className="bg-background text-brand-primary hover:bg-background/90"
                  >
                    Enterprise-Kontakt
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

function ResourceCard({
  icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href} className="block group">
      <Card variant="bordered" className="p-5 h-full hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div
            className={`h-10 w-10 rounded-xl ${color.split(' ')[0]} flex items-center justify-center ${color.split(' ')[1]} shrink-0`}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 group-hover:text-brand-primary transition-colors">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
