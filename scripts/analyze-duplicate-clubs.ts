import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function analyzeDuplicateClubs() {
  console.log('🔍 Analyzing Duplicate Clubs\n');
  console.log('='.repeat(80));

  // Get all clubs
  const { data: clubs, error: clubsError } = await supabase
    .from('clubs')
    .select('id, name, created_at')
    .order('name', { ascending: true })
    .order('created_at', { ascending: true });

  if (clubsError || !clubs) {
    console.error('❌ Error fetching clubs:', clubsError);
    return;
  }

  // Group clubs by name
  const clubsByName = clubs.reduce(
    (acc, club) => {
      if (!acc[club.name]) {
        acc[club.name] = [];
      }
      acc[club.name].push(club);
      return acc;
    },
    {} as Record<string, typeof clubs>
  );

  console.log(`\n📊 Found ${clubs.length} total club entries`);
  console.log(`📊 Found ${Object.keys(clubsByName).length} unique club names\n`);

  // Analyze each group
  for (const [clubName, clubEntries] of Object.entries(clubsByName)) {
    if (clubEntries.length === 1) {
      console.log(`✅ ${clubName}: No duplicates`);
      continue;
    }

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`\n⚠️  ${clubName}: ${clubEntries.length} DUPLICATES FOUND\n`);

    for (const club of clubEntries) {
      console.log(`\n   Club ID: ${club.id}`);
      console.log(`   Created: ${club.created_at}`);

      // Count memberships
      const { data: memberships } = await supabase
        .from('user_club_memberships')
        .select('role, is_active')
        .eq('club_id', club.id);

      const activeMemberships = memberships?.filter((m) => m.is_active) || [];
      const admins = activeMemberships.filter((m) => m.role === 'admin').length;
      const trainers = activeMemberships.filter((m) => m.role === 'trainer').length;
      const members = activeMemberships.filter((m) => m.role === 'member').length;

      console.log(
        `   Memberships: ${activeMemberships.length} (${admins} admin, ${trainers} trainer, ${members} member)`
      );

      // Count courts
      const { data: courts } = await supabase
        .from('courts')
        .select('id')
        .eq('club_id', club.id)
        .eq('is_active', true);

      console.log(`   Courts: ${courts?.length || 0}`);

      // Count schedules
      const { data: schedules } = await supabase
        .from('schedules')
        .select('id, season_year')
        .eq('club_id', club.id)
        .eq('is_active', true);

      console.log(
        `   Schedules: ${schedules?.length || 0}${schedules && schedules.length > 0 ? ` (${schedules.map((s) => s.season_year).join(', ')})` : ''}`
      );

      // Count sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .in('schedule_id', schedules?.map((s) => s.id) || []);

      console.log(`   Sessions: ${sessions?.length || 0}`);

      // Count trainers linked
      const { data: trainerClubs } = await supabase
        .from('trainer_club')
        .select('trainer_id')
        .eq('club_id', club.id);

      console.log(`   Linked Trainers: ${trainerClubs?.length || 0}`);

      // Total resource count
      const totalResources =
        activeMemberships.length +
        (courts?.length || 0) +
        (schedules?.length || 0) +
        (sessions?.length || 0) +
        (trainerClubs?.length || 0);

      console.log(`   📦 TOTAL RESOURCES: ${totalResources}`);
    }

    // Determine which club to keep
    console.log(`\n   💡 Recommendation:`);

    // Sort by total resources (descending) then by created_at (ascending - older is better)
    const enrichedClubs = await Promise.all(
      clubEntries.map(async (club) => {
        const { data: memberships } = await supabase
          .from('user_club_memberships')
          .select('id')
          .eq('club_id', club.id)
          .eq('is_active', true);

        const { data: courts } = await supabase
          .from('courts')
          .select('id')
          .eq('club_id', club.id)
          .eq('is_active', true);

        const { data: schedules } = await supabase
          .from('schedules')
          .select('id')
          .eq('club_id', club.id)
          .eq('is_active', true);

        const { data: sessions } = await supabase
          .from('sessions')
          .select('id')
          .in('schedule_id', schedules?.map((s) => s.id) || []);

        const { data: trainerClubs } = await supabase
          .from('trainer_club')
          .select('trainer_id')
          .eq('club_id', club.id);

        return {
          ...club,
          resourceCount:
            (memberships?.length || 0) +
            (courts?.length || 0) +
            (schedules?.length || 0) +
            (sessions?.length || 0) +
            (trainerClubs?.length || 0),
        };
      })
    );

    enrichedClubs.sort((a, b) => {
      // First sort by resource count (more is better)
      if (b.resourceCount !== a.resourceCount) {
        return b.resourceCount - a.resourceCount;
      }
      // If equal resources, prefer older club
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const keepClub = enrichedClubs[0];
    const deleteClubs = enrichedClubs.slice(1);

    console.log(
      `   ✓ KEEP: ${keepClub.id} (${keepClub.resourceCount} resources, created ${keepClub.created_at})`
    );

    for (const club of deleteClubs) {
      console.log(
        `   ✗ DELETE: ${club.id} (${club.resourceCount} resources, created ${club.created_at})`
      );
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);
  console.log('📋 Summary:');

  const duplicateGroups = Object.values(clubsByName).filter((group) => group.length > 1);
  console.log(`   - ${duplicateGroups.length} club(s) have duplicates`);
  console.log(
    `   - ${duplicateGroups.reduce((sum, group) => sum + (group.length - 1), 0)} duplicate(s) to remove`
  );

  console.log('\n✅ Analysis complete!');
}

analyzeDuplicateClubs()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
