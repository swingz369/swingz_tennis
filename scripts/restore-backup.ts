/**
 * Restore a database backup produced by app/api/cron/backup/route.ts.
 *
 * The backup cron writes `{ metadata, data: { [table]: rows[] } }` JSON files to
 * the `swingz-files` Storage bucket under `backups/<timestamp>.json`. This script
 * reads one of those files and upserts each table's rows back into the database
 * via the service client (bypasses RLS, same as the backup itself).
 *
 * Usage:
 *   npx tsx scripts/restore-backup.ts --list
 *   npx tsx scripts/restore-backup.ts --file backups/2026-07-01T02-00-00-000Z.json [--tables clubs,users] --confirm
 *
 * Safety: dry-run by default (prints what WOULD be restored). Nothing is written
 * unless --confirm is passed. Upserts by primary key `id` — existing rows with
 * the same id are overwritten, rows deleted since the backup are NOT removed.
 */
import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';

const STORAGE_BUCKET = 'swingz-files';
const BACKUP_PREFIX = 'backups';

/**
 * Upsert rows into a table whose name comes from the backup file at runtime —
 * der Per-Tabelle-Query-Builder kann hier nicht greifen (gleiche Begründung wie
 * beim Backup-Cron). Einmaliger, lokal begrenzter Cast statt `as any`.
 */
async function restoreTable(
  sb: ReturnType<typeof createServiceClient>,
  table: string,
  rows: Record<string, unknown>[]
): Promise<{ error: { message: string } | null }> {
  const dynamic = sb.from as unknown as (table: string) => {
    upsert: (
      rows: Record<string, unknown>[],
      opts: { onConflict: string }
    ) => Promise<{ error: { message: string } | null }>;
  };
  return dynamic(table).upsert(rows, { onConflict: 'id' });
}

function parseArgs(argv: string[]) {
  const args = { list: false, file: '', tables: null as string[] | null, confirm: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--list') args.list = true;
    else if (argv[i] === '--file') args.file = argv[++i] ?? '';
    else if (argv[i] === '--tables') args.tables = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (argv[i] === '--confirm') args.confirm = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sb = createServiceClient();

  if (args.list) {
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).list(BACKUP_PREFIX, {
      sortBy: { column: 'name', order: 'desc' },
    });
    if (error) {
      console.error('FATAL: could not list backups:', error.message);
      process.exit(1);
    }
    for (const f of data ?? []) console.log(`${BACKUP_PREFIX}/${f.name}`);
    return;
  }

  if (!args.file) {
    console.error(
      'Usage: npx tsx scripts/restore-backup.ts --file <path> [--tables a,b] [--confirm]'
    );
    console.error('       npx tsx scripts/restore-backup.ts --list');
    process.exit(1);
  }

  const { data: fileData, error: downloadError } = await sb.storage
    .from(STORAGE_BUCKET)
    .download(args.file);
  if (downloadError || !fileData) {
    console.error('FATAL: could not download backup:', downloadError?.message ?? 'no data');
    process.exit(1);
  }

  const payload = JSON.parse(await fileData.text()) as {
    metadata: { timestamp: string; tables: number; totalRows: number };
    data: Record<string, Record<string, unknown>[]>;
  };

  console.log(`Backup timestamp: ${payload.metadata.timestamp}`);
  console.log(`Tables in backup: ${payload.metadata.tables}, rows: ${payload.metadata.totalRows}`);

  const tableNames = args.tables ?? Object.keys(payload.data);

  for (const table of tableNames) {
    const rows = payload.data[table];
    if (!rows) {
      console.warn(`  [skip] "${table}" not present in this backup`);
      continue;
    }
    if (!args.confirm) {
      console.log(`  [dry-run] would upsert ${rows.length} rows into "${table}"`);
      continue;
    }
    if (rows.length === 0) continue;
    const { error } = await restoreTable(sb, table, rows);
    if (error) {
      console.error(`  [FAIL] "${table}": ${error.message}`);
    } else {
      console.log(`  [ok] restored ${rows.length} rows into "${table}"`);
    }
  }

  if (!args.confirm) {
    console.log('\nDry-run only — re-run with --confirm to actually write to the database.');
  }
}

main().catch((e: unknown) => {
  console.error('FATAL:', (e as Error)?.message ?? e);
  process.exit(1);
});
