import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ComponentType } from 'react';
import {
  ArrowUpRight,
  ExternalLink,
  KeyRound,
  MonitorPlay,
  Rocket,
  Terminal,
  Wrench,
} from 'lucide-react';
import { CopyCommand } from '@/components/dev/copy-command';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dev-Schnellzugriff — SWINGZ',
  description: 'Lokale Übersicht aller Dienste, Links und Zugänge (nur im Dev-Modus).',
  robots: { index: false, follow: false },
};

type LinkItem = {
  label: string;
  href: string;
  description: string;
  internal?: boolean;
};

type Section = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  blurb?: string;
  links?: LinkItem[];
  commands?: { value: string; description: string }[];
  credentials?: { label: string; location: string }[];
};

const LOCAL: Section = {
  title: 'Lokal (Entwicklung)',
  icon: MonitorPlay,
  blurb: 'Nur erreichbar, solange `supabase start` und der Dev-Server laufen.',
  links: [
    {
      label: 'App',
      href: '/login',
      description: 'Die App selbst — Einstieg über /login.',
      internal: true,
    },
    {
      label: 'Supabase Studio',
      href: 'http://127.0.0.1:54323',
      description: 'Tabellen, SQL-Editor, Auth-Benutzerliste.',
    },
    {
      label: 'Mailpit',
      href: 'http://127.0.0.1:54324',
      description: 'Fängt jede lokal verschickte Mail ab.',
    },
    {
      label: 'Health-Check',
      href: 'http://localhost:3000/api/health',
      description: 'Health-Check der App (JSON).',
    },
  ],
  commands: [
    { value: 'supabase status', description: 'Alle lokalen URLs und Keys auf einmal' },
    { value: 'npm run dev', description: 'Dev-Server starten (App auf :3000)' },
    { value: 'npm run db:studio', description: 'Drizzle Studio — alternative Sicht auf die DB' },
    {
      value: 'postgresql://postgres:postgres@127.0.0.1:54322',
      description: 'Postgres direkt (psql / Drizzle Studio)',
    },
  ],
};

const PRODUCTION: Section = {
  title: 'Produktion',
  icon: Rocket,
  blurb: 'Live-Umgebung — nur ansehen, hier nicht schreiben.',
  links: [
    {
      label: 'App',
      href: 'https://swingz.vercel.app',
      description: 'Produktive App (deployt automatisch aus main).',
    },
    {
      label: 'Statusseite',
      href: 'https://swingz.vercel.app/status',
      description: 'App, Datenbank, Alter der letzten Datensicherung.',
    },
    {
      label: 'Health (JSON)',
      href: 'https://swingz.vercel.app/api/health',
      description: 'Dieselben Prüfungen als JSON.',
    },
    {
      label: 'Supabase-API',
      href: 'https://supabase.swingz.cloud',
      description: 'Produktions-Supabase (Kong) — liefert JSON im Browser.',
    },
    {
      label: 'Kundendomain',
      href: 'https://swingz.cloud',
      description: 'Vorgesehene Domain; Web-App liegt noch auf Vercel.',
    },
  ],
  commands: [
    {
      value: 'ssh -N -L 8011:127.0.0.1:8011 deploy@178.254.37.110',
      description: 'Prod-Studio-Tunnel → danach http://127.0.0.1:8011',
    },
  ],
};

const THIRD_PARTY: Section = {
  title: 'Verwaltung & Drittanbieter',
  icon: Wrench,
  links: [
    {
      label: 'GitHub',
      href: 'https://github.com/swingz369/swingz',
      description: 'Quellcode, CI (Actions), Issues.',
    },
    {
      label: 'Vercel',
      href: 'https://vercel.com/bartmz-3856s-projects/swingz',
      description: 'Hosting, Env-Vars, Deploy-Historie, Cron-Jobs.',
    },
    { label: 'Stripe', href: 'https://dashboard.stripe.com', description: 'Abos und Zahlungen.' },
    {
      label: 'Resend',
      href: 'https://resend.com/emails',
      description: 'Mailversand inkl. Supabase-Auth-Mails.',
    },
    {
      label: 'Sentry',
      href: 'https://sentry.io',
      description: 'Laufzeitfehler aus Produktion (Region EU).',
    },
    {
      label: 'Upstash Redis',
      href: 'https://console.upstash.com',
      description: 'Rate-Limiting der API-Routen.',
    },
    {
      label: 'Google AI Studio',
      href: 'https://aistudio.google.com/apikey',
      description: 'Gemini-Flash-Key für KI-Funktionen & Midscene-Tests.',
    },
    {
      label: 'manitu',
      href: 'https://mein.manitu.de',
      description: 'VPS-Anbieter (Rechnung, Reboot, Rescue).',
    },
    {
      label: 'nuLiga',
      href: 'https://htv.liga.nu',
      description: 'Externe Ligaverwaltung des Verbands.',
    },
  ],
};

const CREDENTIALS: Section = {
  title: 'Wo Zugangsdaten liegen',
  icon: KeyRound,
  credentials: [
    { label: 'Alle Testkonten', location: 'docs/TEST-CREDENTIALS.md' },
    { label: 'Owner admin@swingz.com', location: 'OWNER_PASSWORD in .env.local' },
    { label: 'Lokale Supabase-Keys', location: 'supabase status' },
    { label: 'Produktions-Keys & -Secrets', location: '.env.prod.local + Vercel Env-Vars' },
    { label: 'VPS-SSH', location: '~/.ssh/manitu_vps' },
    { label: 'Backup-Entschlüsselung', location: '~/.age/swingz-backup-key.txt' },
  ],
};

const SECTIONS: Section[] = [LOCAL, PRODUCTION, THIRD_PARTY, CREDENTIALS];

export default function DevOverviewPage() {
  // Ausschließlich lokal: in Produktion (und jedem `next build`) existiert die
  // Seite nicht — sie liefert eine 404 statt der Link-Übersicht.
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-brand-secondary">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent/15 px-3 py-1 text-xs font-semibold text-brand-light">
            <Terminal className="h-3.5 w-3.5" /> Nur lokal · in Produktion 404
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Dev-Schnellzugriff
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
            Alle Dienste, Links und Zugänge aus <code className="font-mono">docs/SERVICES.md</code>{' '}
            auf einen Blick — zum schnellen Öffnen und Kopieren im Arbeitsalltag.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                  <section.icon className="h-4 w-4" />
                </span>
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              </div>
              {section.blurb && (
                <p className="mb-4 text-sm text-muted-foreground">{section.blurb}</p>
              )}

              {section.links && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {section.links.map((item) =>
                    item.internal ? (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-primary/40 hover:bg-muted/40"
                      >
                        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-primary" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {item.description}
                          </span>
                          <span className="mt-1 block truncate font-mono text-2xs text-muted-foreground/70">
                            {item.href}
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-primary/40 hover:bg-muted/40"
                      >
                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-primary" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {item.description}
                          </span>
                          <span className="mt-1 block truncate font-mono text-2xs text-muted-foreground/70">
                            {item.href}
                          </span>
                        </span>
                      </a>
                    )
                  )}
                </div>
              )}

              {section.commands && (
                <div className="mt-4 space-y-2">
                  {section.commands.map((cmd) => (
                    <div key={cmd.value}>
                      <p className="mb-1 text-xs text-muted-foreground">{cmd.description}</p>
                      <CopyCommand value={cmd.value} />
                    </div>
                  ))}
                </div>
              )}

              {section.credentials && (
                <div className="overflow-hidden rounded-xl border border-border">
                  {section.credentials.map((row, idx) => (
                    <div
                      key={row.label}
                      className={`flex items-center justify-between gap-4 px-4 py-3 ${
                        idx % 2 === 0 ? 'bg-card' : 'bg-muted/40'
                      }`}
                    >
                      <span className="text-sm text-foreground">{row.label}</span>
                      <code className="truncate font-mono text-xs text-muted-foreground">
                        {row.location}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          Quelle: <code className="font-mono">docs/SERVICES.md</code> · Diese Seite ist bewusst nur
          im Dev-Modus erreichbar und für Produktion nicht vorgesehen.
        </footer>
      </main>
    </div>
  );
}
