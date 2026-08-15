/**
 * scripts/reset-owner-password.ts
 *
 * Setzt das Passwort des Plattform-Owners (`admin@swingz.com`) neu und schreibt
 * es in `docs/TEST-CREDENTIALS.md` (gitignored, Klartext — siehe AGENTS.md,
 * "Zugangsdaten sind generiert, nicht gepflegt").
 *
 * Bewusst ein eigenes Skript und NICHT Teil von `seed-testdata.ts`: der Seed
 * fasst diesen Account laut CLAUDE.md nie an. Dieses Skript läuft nur, wenn
 * jemand es ausdrücklich aufruft.
 *
 *   npx tsx scripts/reset-owner-password.ts
 *
 * Solange das System nur Testdaten enthält, ist das unkritisch. Sobald echte
 * Vereine darauf liegen, gehört das Owner-Passwort in einen Passwortmanager
 * und NICHT mehr in eine Datei — dann dieses Skript löschen.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local'), override: true });

const OWNER_EMAIL = 'admin@swingz.com';
const DOC_PATH = resolve(process.cwd(), 'docs/TEST-CREDENTIALS.md');

/** 24 Zeichen aus einem Alphabet ohne verwechselbare Zeichen (0/O, 1/l/I). */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_';
  const bytes = randomBytes(24);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SERVICE_ROLE_KEY fehlen');

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);

  const owner = list.users.find((u) => u.email === OWNER_EMAIL);
  if (!owner) throw new Error(`Account ${OWNER_EMAIL} existiert nicht`);

  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(owner.id, { password });
  if (error) throw new Error(`updateUserById: ${error.message}`);

  console.log(`Passwort für ${OWNER_EMAIL} neu gesetzt.`);
  console.log(`  user_id: ${owner.id}`);
  console.log(`  Passwort: ${password}`);

  // ── In die Zugangsdaten-Doku schreiben ────────────────────────────────
  if (!existsSync(DOC_PATH)) {
    console.warn(`\n${DOC_PATH} fehlt — bitte erst "npm run seed:docs" ausführen.`);
    return;
  }

  const doc = readFileSync(DOC_PATH, 'utf8');
  const stamp = new Date().toISOString().slice(0, 10);
  const newRow = `| owner | \`${OWNER_EMAIL}\` | \`${password}\` | zuletzt zurückgesetzt am ${stamp} via \`scripts/reset-owner-password.ts\` |`;

  // Die bestehende Owner-Zeile ersetzen, egal wie sie formatiert war.
  const ownerRow = new RegExp(`^\\|\\s*owner\\s*\\|.*$`, 'm');
  const updated = ownerRow.test(doc)
    ? doc.replace(ownerRow, newRow)
    : `${doc.trimEnd()}\n\n## Plattform-Owner\n\n| Rolle | E-Mail | Passwort | Hinweis |\n| --- | --- | --- | --- |\n${newRow}\n`;

  writeFileSync(DOC_PATH, updated, 'utf8');
  console.log(`\nIn ${DOC_PATH} eingetragen.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
