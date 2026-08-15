import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';

const log = createLogger('page:status');

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Systemstatus — SwingZ',
  description: 'Aktuelle Verfügbarkeit von SwingZ.',
  robots: { index: false },
};

/** Deckungsgleich mit /api/health — ein Backup darf einen Lauf aussetzen, keine zwei. */
const BACKUP_MAX_AGE_HOURS = 36;

type Zustand = 'ok' | 'gestoert' | 'unbekannt';

async function ermittleZustand() {
  let datenbank: Zustand = 'gestoert';
  let backup: Zustand = 'unbekannt';
  let backupAlterStunden: number | null = null;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('clubs').select('id').limit(1);
    datenbank = error ? 'gestoert' : 'ok';

    if (datenbank === 'ok') {
      const { data } = await supabase
        .from('ops_heartbeats')
        .select('last_seen_at')
        .eq('name', 'vps-backup')
        .maybeSingle();

      if (data?.last_seen_at) {
        backupAlterStunden =
          Math.round(((Date.now() - new Date(data.last_seen_at).getTime()) / 3_600_000) * 10) / 10;
        backup = backupAlterStunden <= BACKUP_MAX_AGE_HOURS ? 'ok' : 'gestoert';
      }
    }
  } catch (e) {
    log.error('Statusseite konnte den Zustand nicht ermitteln', e instanceof Error ? e : undefined);
  }

  return { datenbank, backup, backupAlterStunden };
}

const ANZEIGE: Record<Zustand, { text: string; punkt: string; farbe: string }> = {
  ok: {
    text: 'Betriebsbereit',
    punkt: 'bg-emerald-500',
    farbe: 'text-emerald-600 dark:text-emerald-400',
  },
  gestoert: { text: 'Gestört', punkt: 'bg-destructive', farbe: 'text-destructive' },
  unbekannt: { text: 'Unbekannt', punkt: 'bg-muted-foreground', farbe: 'text-muted-foreground' },
};

function Zeile({
  name,
  beschreibung,
  zustand,
  zusatz,
}: {
  name: string;
  beschreibung: string;
  zustand: Zustand;
  zusatz?: string;
}) {
  const a = ANZEIGE[zustand];
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{beschreibung}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', a.farbe)}>
          <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', a.punkt)} />
          {a.text}
        </span>
        {zusatz && <p className="mt-0.5 text-xs text-muted-foreground">{zusatz}</p>}
      </div>
    </div>
  );
}

export default async function StatusPage() {
  const { datenbank, backup, backupAlterStunden } = await ermittleZustand();

  // Die Seite selbst wird gerendert — also läuft die App. Das ist keine
  // Selbstverständlichkeit zum Weglassen, sondern die Antwort auf die Frage,
  // die jemand stellt, der hier landet: "liegt es an euch oder an mir?"
  const alles = datenbank === 'ok' && backup === 'ok';

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-foreground">Systemstatus</h1>
      <p className="mt-2 text-muted-foreground">
        {alles
          ? 'Alle Systeme arbeiten normal.'
          : 'Mindestens ein System ist beeinträchtigt — Einzelheiten unten.'}
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card px-5">
        <Zeile
          name="Anwendung"
          beschreibung="Weboberfläche und API"
          zustand="ok"
          zusatz="diese Seite kommt von dort"
        />
        <Zeile
          name="Datenbank"
          beschreibung="Mitglieder, Buchungen, Saisonplanung"
          zustand={datenbank}
        />
        <Zeile
          name="Datensicherung"
          beschreibung="Nächtliche Sicherung, verschlüsselt"
          zustand={backup}
          zusatz={
            backupAlterStunden === null
              ? 'noch keine Rückmeldung'
              : `vor ${backupAlterStunden.toLocaleString('de-DE')} Stunden`
          }
        />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Stand:{' '}
        {new Date().toLocaleString('de-DE', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Europe/Berlin',
        })}{' '}
        Uhr. Die Seite fragt bei jedem Aufruf neu ab.
      </p>
    </main>
  );
}
