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

async function getClubResources(clubId: string) {
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('id')
    .eq('club_id', clubId)
    .eq('is_active', true);

  const { data: courts } = await supabase
    .from('courts')
    .select('id')
    .eq('club_id', clubId)
    .eq('is_active', true);

  const { data: schedules } = await supabase
    .from('schedules')
    .select('id')
    .eq('club_id', clubId)
    .eq('is_active', true);

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .in('schedule_id', schedules?.map((s) => s.id) || []);

  const { data: trainerClubs } = await supabase
    .from('trainer_club')
    .select('trainer_id')
    .eq('club_id', clubId);

  return {
    memberships: memberships?.length || 0,
    courts: courts?.length || 0,
    schedules: schedules?.length || 0,
    sessions: sessions?.length || 0,
    trainerClubs: trainerClubs?.length || 0,
    total:
      (memberships?.length || 0) +
      (courts?.length || 0) +
      (schedules?.length || 0) +
      (sessions?.length || 0) +
      (trainerClubs?.length || 0),
  };
}

async function migrateCourts(fromClubId: string, toClubId: string) {
  const { data: courts, error } = await supabase
    .from('courts')
    .update({ club_id: toClubId })
    .eq('club_id', fromClubId)
    .select();

  if (error) {
    console.error(`   ❌ Failed to migrate courts: ${error.message}`);
    return 0;
  }

  return courts?.length || 0;
}

async function migrateSchedules(fromClubId: string, toClubId: string) {
  const { data: schedules, error } = await supabase
    .from('schedules')
    .update({ club_id: toClubId })
    .eq('club_id', fromClubId)
    .select();

  if (error) {
    console.error(`   ❌ Failed to migrate schedules: ${error.message}`);
    return 0;
  }

  return schedules?.length || 0;
}

async function migrateMemberships(fromClubId: string, toClubId: string) {
  // First, check for conflicts - memberships that already exist in the target club
  const { data: fromMemberships } = await supabase
    .from('user_club_memberships')
    .select('user_id, role')
    .eq('club_id', fromClubId);

  const { data: toMemberships } = await supabase
    .from('user_club_memberships')
    .select('user_id, role')
    .eq('club_id', toClubId);

  const toUserIds = new Set(toMemberships?.map((m) => m.user_id) || []);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const membership of fromMemberships || []) {
    if (toUserIds.has(membership.user_id)) {
      // User already has membership in target club - deactivate source membership
      await supabase
        .from('user_club_memberships')
        .update({ is_active: false })
        .eq('club_id', fromClubId)
        .eq('user_id', membership.user_id);

      skippedCount++;
    } else {
      // Migrate membership to target club
      const { error } = await supabase
        .from('user_club_memberships')
        .update({ club_id: toClubId })
        .eq('club_id', fromClubId)
        .eq('user_id', membership.user_id);

      if (error) {
        console.error(
          `   ❌ Failed to migrate membership for user ${membership.user_id}: ${error.message}`
        );
      } else {
        migratedCount++;
      }
    }
  }

  if (skippedCount > 0) {
    console.log(`   ⚠️  Deactivated ${skippedCount} duplicate memberships`);
  }

  return migratedCount;
}

async function migrateTrainerClubs(fromClubId: string, toClubId: string) {
  // Check for conflicts
  const { data: fromTrainers } = await supabase
    .from('trainer_club')
    .select('trainer_id')
    .eq('club_id', fromClubId);

  const { data: toTrainers } = await supabase
    .from('trainer_club')
    .select('trainer_id')
    .eq('club_id', toClubId);

  const toTrainerIds = new Set(toTrainers?.map((t) => t.trainer_id) || []);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const trainer of fromTrainers || []) {
    if (toTrainerIds.has(trainer.trainer_id)) {
      // Trainer already linked to target club - delete duplicate
      await supabase
        .from('trainer_club')
        .delete()
        .eq('club_id', fromClubId)
        .eq('trainer_id', trainer.trainer_id);

      skippedCount++;
    } else {
      // Migrate trainer link to target club
      const { error } = await supabase
        .from('trainer_club')
        .update({ club_id: toClubId })
        .eq('club_id', fromClubId)
        .eq('trainer_id', trainer.trainer_id);

      if (error) {
        console.error(
          `   ❌ Failed to migrate trainer link ${trainer.trainer_id}: ${error.message}`
        );
      } else {
        migratedCount++;
      }
    }
  }

  if (skippedCount > 0) {
    console.log(`   ⚠️  Removed ${skippedCount} duplicate trainer links`);
  }

  return migratedCount;
}

async function deleteClub(clubId: string) {
  // First verify no resources are left
  const resources = await getClubResources(clubId);

  if (resources.total > 0) {
    console.error(`   ❌ Cannot delete club ${clubId} - still has ${resources.total} resources!`);
    return false;
  }

  const { error } = await supabase.from('clubs').delete().eq('id', clubId);

  if (error) {
    console.error(`   ❌ Failed to delete club: ${error.message}`);
    return false;
  }

  return true;
}

async function fixDuplicateClubs() {
  console.log('🔧 Fixing Duplicate Clubs\n');
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

  const duplicateGroups = Object.entries(clubsByName).filter(([_, group]) => group.length > 1);

  console.log(`\n📊 Found ${duplicateGroups.length} club(s) with duplicates`);
  console.log(
    `📊 Total ${duplicateGroups.reduce((sum, [_, group]) => sum + (group.length - 1), 0)} duplicate(s) to fix\n`
  );

  for (const [clubName, clubEntries] of duplicateGroups) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`\n🏢 Processing: ${clubName}\n`);

    // Determine which club to keep (same logic as analyze script)
    const enrichedClubs = await Promise.all(
      clubEntries.map(async (club) => {
        const resources = await getClubResources(club.id);
        return {
          ...club,
          resourceCount: resources.total,
        };
      })
    );

    enrichedClubs.sort((a, b) => {
      if (b.resourceCount !== a.resourceCount) {
        return b.resourceCount - a.resourceCount;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const keepClub = enrichedClubs[0];
    const deleteClubs = enrichedClubs.slice(1);

    console.log(`   ✓ KEEPING: ${keepClub.id} (${keepClub.resourceCount} resources)`);

    for (const clubToDelete of deleteClubs) {
      console.log(
        `   ✗ MIGRATING FROM: ${clubToDelete.id} (${clubToDelete.resourceCount} resources)`
      );

      // Migrate all resources
      console.log(`\n   🔄 Migrating resources...`);

      const courtsCount = await migrateCourts(clubToDelete.id, keepClub.id);
      console.log(`      ✓ Courts: ${courtsCount}`);

      const schedulesCount = await migrateSchedules(clubToDelete.id, keepClub.id);
      console.log(`      ✓ Schedules: ${schedulesCount}`);

      const membershipsCount = await migrateMemberships(clubToDelete.id, keepClub.id);
      console.log(`      ✓ Memberships: ${membershipsCount}`);

      const trainersCount = await migrateTrainerClubs(clubToDelete.id, keepClub.id);
      console.log(`      ✓ Trainer Links: ${trainersCount}`);

      // Verify migration
      const remainingResources = await getClubResources(clubToDelete.id);
      console.log(`\n   📦 Remaining resources in duplicate: ${remainingResources.total}`);

      if (remainingResources.total === 0) {
        console.log(`   🗑️  Deleting duplicate club ${clubToDelete.id}...`);
        const deleted = await deleteClub(clubToDelete.id);

        if (deleted) {
          console.log(`   ✅ Successfully deleted duplicate club`);
        }
      } else {
        console.log(`   ⚠️  Cannot delete club - still has resources:`);
        console.log(`      - Memberships: ${remainingResources.memberships}`);
        console.log(`      - Courts: ${remainingResources.courts}`);
        console.log(`      - Schedules: ${remainingResources.schedules}`);
        console.log(`      - Sessions: ${remainingResources.sessions}`);
        console.log(`      - Trainer Links: ${remainingResources.trainerClubs}`);
      }
    }

    // Show final state
    const finalResources = await getClubResources(keepClub.id);
    console.log(`\n   📈 Final club resources: ${finalResources.total}`);
  }

  console.log(`\n${'='.repeat(80)}\n`);

  // Final validation
  const { data: finalClubs } = await supabase.from('clubs').select('id, name').order('name');

  console.log('📋 Final Club List:');
  const finalClubsByName = (finalClubs || []).reduce(
    (acc, club) => {
      if (!acc[club.name]) {
        acc[club.name] = 0;
      }
      acc[club.name]++;
      return acc;
    },
    {} as Record<string, number>
  );

  for (const [name, count] of Object.entries(finalClubsByName)) {
    console.log(
      `   ${count === 1 ? '✅' : '❌'} ${name}: ${count} ${count === 1 ? 'entry' : 'entries'}`
    );
  }

  const totalClubs = finalClubs?.length || 0;
  const uniqueNames = Object.keys(finalClubsByName).length;

  console.log(`\n📊 Total: ${totalClubs} clubs, ${uniqueNames} unique names`);

  if (totalClubs === uniqueNames) {
    console.log('\n🎉 SUCCESS! All duplicates resolved!');
  } else {
    console.log(`\n⚠️  WARNING: Still ${totalClubs - uniqueNames} duplicate(s) remaining`);
  }
}

fixDuplicateClubs()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
