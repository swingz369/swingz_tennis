// One-off diagnostic: dump all audit.*@example.de registration_requests
// rows with their status / club_id / created_at, plus count breakdowns.
// Re-run anytime with: `node scripts/diag/missing-tobias.cjs | head -120`
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({
  path: require('path').resolve(process.cwd(), '.env.local'),
  override: true,
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('ENV missing');
  process.exit(2);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  try {
    const { data: club, error: clubErr } = await sb
      .from('clubs')
      .select('id, name')
      .eq('name', 'TC Rheinland e.V.')
      .maybeSingle();
    if (clubErr) {
      console.error('club-lookup error:', clubErr.message);
      process.exit(1);
    }
    console.log('=== TC Rheinland club.id ===');
    console.log(club ? `${club.id}  (${club.name})` : 'NOT FOUND');
    console.log('');

    const { data: rows, error: rowsErr } = await sb
      .from('registration_requests')
      .select(
        'id, email, status, club_id, created_at, reviewed_at, reviewed_by'
      )
      .like('email', 'audit.%@example.de')
      .order('created_at', { ascending: false });
    if (rowsErr) {
      console.error('rows error:', rowsErr.message);
      process.exit(1);
    }
    console.log(
      `=== ALL audit.*@example.de rows (n=${(rows || []).length}) ===`
    );
    for (const r of rows || []) {
      console.log(JSON.stringify(r));
    }
    console.log('');

    const { count: pendingAll } = await sb
      .from('registration_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .like('email', 'audit.%@example.de');
    console.log(
      `=== pending audit.* count (no club_id filter): ${pendingAll} ===`
    );

    if (club) {
      const { count: pendingClub } = await sb
        .from('registration_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('club_id', club.id)
        .like('email', 'audit.%@example.de');
      console.log(
        `=== pending audit.* count (club_id=TC Rheinland): ${pendingClub} ===`
      );

      const { data: clubRows } = await sb
        .from('registration_requests')
        .select('id, email, status, club_id')
        .eq('club_id', club.id)
        .like('email', 'audit.%@example.de');
      console.log(
        `=== ALL audit.* in TC Rheinland by status (n=${(clubRows || []).length}) ===`
      );
      const byStatus = {};
      for (const r of clubRows || []) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      }
      console.log(JSON.stringify(byStatus, null, 2));
    }

    const seen = new Map();
    for (const r of rows || []) {
      const k = r.club_id || '<null>';
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    console.log('');
    console.log('=== audit.* club_id distribution ===');
    for (const [k, v] of seen.entries()) {
      console.log(`${k}  →  ${v} row(s)`);
    }
  } catch (e) {
    console.error('FATAL:', e);
    process.exit(1);
  }
})();
