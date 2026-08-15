/**
 * Migrations-Tracking für supabase/migrations/*.sql
 *
 * Warum eine eigene Tabelle statt `supabase_migrations.schema_migrations`:
 * deren PK ist `version` (der Zahlen-Präfix des Dateinamens). Zwei Dateien mit
 * gleichem Präfix kollabieren dort zu einer Zeile — genau die Lücke, durch die
 * Migrationen unbemerkt nie angewendet wurden (siehe AGENTS.md § Migrationen).
 * Hier ist der volle Dateiname der Schlüssel, plus Checksumme: eine nachträglich
 * editierte Migrationsdatei fällt damit auf statt still durchzugehen.
 *
 *   npx tsx scripts/migrate.ts status      # was ist offen
 *   npx tsx scripts/migrate.ts dry         # offene Migrationen testen (Rollback)
 *   npx tsx scripts/migrate.ts up          # offene Migrationen anwenden
 *   npx tsx scripts/migrate.ts baseline    # alles als angewendet markieren (DDL läuft NICHT)
 *
 * `baseline` ist für den Erstlauf gegen eine DB, die den Stand bereits hat.
 */
import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const DIR = 'supabase/migrations';
const cmd = process.argv[2] ?? 'status';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL fehlt (.env.local)');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_SSL === 'require' ? 'require' : false,
  max: 1,
  prepare: false,
  // ponytail: großzügig, weil einzelne RLS-Migrationen mehrere Sekunden brauchen
  idle_timeout: 20,
  // NOTICEs von `create ... if not exists` sind hier Normalbetrieb, kein Befund
  onnotice: () => {},
});

type Local = { file: string; sql: string; checksum: string };

const local: Local[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((file) => {
    const body = readFileSync(join(DIR, file), 'utf8');
    return { file, sql: body, checksum: createHash('sha256').update(body).digest('hex') };
  });

async function ensureTable() {
  await sql.unsafe(`
    create table if not exists public.schema_migrations (
      filename    text primary key,
      checksum    text not null,
      applied_at  timestamptz not null default now(),
      applied_by  text not null default current_user,
      baselined   boolean not null default false
    );
    comment on table public.schema_migrations is
      'Welche Datei aus supabase/migrations/ auf dieser DB gelaufen ist. Gepflegt von scripts/migrate.ts.';
  `);
}

async function applied(): Promise<Map<string, string>> {
  const rows = await sql<{ filename: string; checksum: string }[]>`
    select filename, checksum from public.schema_migrations
  `;
  return new Map(rows.map((r) => [r.filename, r.checksum]));
}

async function main() {
  await ensureTable();
  const done = await applied();
  const pending = local.filter((m) => !done.has(m.file));
  const changed = local.filter((m) => done.has(m.file) && done.get(m.file) !== m.checksum);

  if (changed.length) {
    console.warn(
      `⚠ ${changed.length} bereits angewendete Migration(en) wurden nachträglich editiert:\n` +
        changed.map((m) => `   ${m.file}`).join('\n') +
        '\n  Migrationsdateien sind Historie (AGENTS.md) — Korrektur gehört in eine neue Datei.'
    );
  }

  if (cmd === 'status') {
    console.log(`${local.length} Dateien, ${done.size} angewendet, ${pending.length} offen`);
    pending.forEach((m) => console.log(`  offen: ${m.file}`));
    return;
  }

  if (cmd === 'baseline') {
    // --through <datei>: nur bis einschließlich dieser Datei markieren. Für den
    // Erstlauf, wenn der Altbestand auf der DB liegt, die letzten Dateien aber
    // wirklich noch offen sind.
    const throughArg = process.argv.indexOf('--through');
    const through = throughArg > -1 ? process.argv[throughArg + 1] : undefined;
    if (through && !local.some((m) => m.file === through)) {
      console.error(`--through: ${through} gibt es in ${DIR} nicht`);
      process.exit(1);
    }
    const target = through ? pending.filter((m) => m.file <= through) : pending;
    if (!target.length) return console.log('Nichts zu baselinen.');
    await sql`
      insert into public.schema_migrations ${sql(
        target.map((m) => ({ filename: m.file, checksum: m.checksum, baselined: true }))
      )}
    `;
    console.log(`${target.length} Migration(en) als angewendet markiert (kein DDL ausgeführt).`);
    return;
  }

  if (cmd !== 'up' && cmd !== 'dry') {
    console.error(`Unbekannt: ${cmd}. Erlaubt: status | dry | up | baseline`);
    process.exit(1);
  }

  if (!pending.length) return console.log('Keine offenen Migrationen.');

  if (cmd === 'dry') {
    // Eine einzige Transaktion über alle offenen Migrationen, am Ende Rollback.
    // Getrennte Transaktionen je Datei würden falsch Alarm schlagen, sobald eine
    // Migration auf dem Ergebnis der vorigen aufbaut.
    try {
      await sql.begin(async (tx) => {
        for (const m of pending) {
          await tx.unsafe(m.sql);
          console.log(`  ✓ ${m.file}`);
        }
        throw new DryRunDone();
      });
    } catch (err) {
      if (err instanceof DryRunDone) {
        console.log('Alle offenen Migrationen laufen durch (zurückgerollt).');
        return;
      }
      console.error(`  ✗ ${err instanceof Error ? err.message : err}`);
      process.exitCode = 1;
    }
    return;
  }

  for (const m of pending) {
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(m.sql);
        await tx`insert into public.schema_migrations ${tx({
          filename: m.file,
          checksum: m.checksum,
        })}`;
      });
      console.log(`  ✓ ${m.file}`);
    } catch (err) {
      console.error(`  ✗ ${m.file}\n      ${err instanceof Error ? err.message : err}`);
      console.error('Abbruch — vorherige Migrationen bleiben angewendet.');
      process.exit(1);
    }
  }
  console.log('Alle Migrationen angewendet.');
}

class DryRunDone extends Error {}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
