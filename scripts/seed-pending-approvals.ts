#!/usr/bin/env npx tsx
/**
 * Visual-Audit Helper: Setzt 3 pending registration_requests für TC Rheinland e.V.,
 * damit das `/admin`-Dashboard den "Urgent"-Inbox-Banner capturen lässt.
 *
 * Usage:   npx tsx scripts/seed-pending-approvals.ts           # Insert (idempotent)
 * Revert:  npx tsx scripts/seed-pending-approvals.ts --revert  # Cleanup
 * Check:   npx tsx scripts/seed-pending-approvals.ts --check   # Status nur lesen
 *
 * Setzt den TC-Rheinland-Club automatisch voraus — bricht sauber ab, falls die
 * Test-DB noch nicht geseedet ist (siehe scripts/seed-test-data.ts).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SAMPLE_REQUESTS = [
  {
    first_name: 'Markus',
    last_name: 'Wendt',
    email: 'audit.markus.wendt@example.de',
    motivation:
      'Hallo, ich interessiere mich für eine Mitgliedschaft im Verein und bringe bereits 5 Jahre Tennis-Erfahrung mit.',
  },
  {
    first_name: 'Sabine',
    last_name: 'Kraus',
    email: 'audit.sabine.kraus@example.de',
    motivation: 'Anfrage nach Probetraining. Bitte um Rückmeldung zu den verfügbaren Slots.',
  },
  {
    first_name: 'Tobias',
    last_name: 'Frank',
    email: 'audit.tobias.frank@example.de',
    motivation: 'Empfehlung durch Bekannten. Mein Ziel: Mannschaftsspieler in der Sommersaison.',
  },
];

async function main() {
  const args = process.argv.slice(2);
  const doRevert = args.includes('--revert');
  const doCheck = args.includes('--check');

  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .select('id, name')
    .eq('name', 'TC Rheinland e.V.')
    .maybeSingle();
  if (clubErr) {
    console.error('Club-Lookup fehlgeschlagen:', clubErr.message);
    process.exit(1);
  }
  if (!club) {
    console.error(
      'TC Rheinland e.V. nicht gefunden — bitte zuerst scripts/seed-test-data.ts laufen lassen.'
    );
    process.exit(1);
  }
  console.log(`Verein gefunden: ${club.name} (${club.id})`);

  const emails = SAMPLE_REQUESTS.map((r) => r.email);

  if (doCheck) {
    const { count, error: countErr } = await supabase
      .from('registration_requests')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', club.id)
      .eq('status', 'pending')
      .in('email', emails);
    if (countErr) {
      console.error('Count fehlgeschlagen:', countErr.message);
      process.exit(1);
    }
    console.log(
      `Aktuell ${count ?? 0} von ${emails.length} Audit-Hilfs-Pending-Anfragen vorhanden.`
    );
    return;
  }

  // Idempotenter Cleanup vor Insert/Revert — vermeidet Duplikate.
  const { error: delErr } = await supabase
    .from('registration_requests')
    .delete()
    .eq('club_id', club.id)
    .in('email', emails);
  if (delErr) {
    console.error('Cleanup fehlgeschlagen:', delErr.message);
    process.exit(1);
  }

  if (doRevert) {
    console.log('✓ Pending-Hilfs-Anfragen entfernt.');
    return;
  }

  const rows = SAMPLE_REQUESTS.map((r) => ({
    club_id: club.id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    motivation: r.motivation,
    status: 'pending',
    phone: '+49 000 0000000',
    wants_trial_training: false,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('registration_requests').insert(rows);
  if (error) {
    console.error('Insert fehlgeschlagen:', error.message);
    process.exit(1);
  }
  console.log(`✓ ${rows.length} pending registration_requests eingefügt.`);
  console.log('  → /admin Dashboard zeigt jetzt den "Urgent"-Inbox-Banner.');
  console.log('  → Revert:    npx tsx scripts/seed-pending-approvals.ts --revert');
  console.log('  → Check:     npx tsx scripts/seed-pending-approvals.ts --check');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
