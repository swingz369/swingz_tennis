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

async function fixAdminClubDataSimple() {
  console.log('🔧 Fixing admin club data (simplified)...\n');

  // 1. Find admin user and club
  const { data: users } = await supabase.auth.admin.listUsers();
  const adminUser = users?.users.find((u) => u.email === 'admin@swingz.com');
  const trainerUser = users?.users.find((u) => u.email === 'trainer@swingz.com');

  if (!adminUser) {
    console.log('❌ Admin user not found');
    return;
  }

  console.log(`✓ Admin user: ${adminUser.id}`);
  console.log(`✓ Trainer user: ${trainerUser?.id || 'N/A'}\n`);

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('club_id, clubs(id, name)')
    .eq('user_id', adminUser.id)
    .eq('is_active', true)
    .limit(1);

  if (!memberships || memberships.length === 0) {
    console.log('❌ No club membership found for admin');
    return;
  }

  const clubId = memberships[0].club_id;
  const clubName = (memberships[0] as any).clubs?.name || 'Unknown';
  console.log(`✓ Club: ${clubName} (${clubId})\n`);

  // 2. Create courts - use minimal fields that exist
  console.log('🏟️  Creating courts...');
  const courts = [
    { name: 'Court 1', surface: 'hard', has_indoor: false },
    { name: 'Court 2', surface: 'hard', has_indoor: false },
    { name: 'Court 3', surface: 'hard', has_indoor: true },
    { name: 'Court 4', surface: 'hard', has_indoor: true },
  ];

  const insertedCourts: string[] = [];
  for (const court of courts) {
    const { data: existing } = await supabase
      .from('courts')
      .select('id')
      .eq('club_id', clubId)
      .eq('name', court.name)
      .limit(1);

    if (existing && existing.length > 0) {
      insertedCourts.push(existing[0].id);
      console.log(`  ✓ Court exists: ${court.name}`);
    } else {
      const { data: inserted, error } = await supabase
        .from('courts')
        .insert({
          club_id: clubId,
          name: court.name,
          surface: court.surface,
          has_indoor: court.has_indoor,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        console.log(`  ❌ Error creating court ${court.name}:`, error.message);
      } else {
        insertedCourts.push(inserted.id);
        console.log(`  ✓ Created court: ${court.name}`);
      }
    }
  }

  // 3. Create schedule (season)
  console.log('\n📅 Creating schedule...');
  const currentYear = new Date().getFullYear();
  const seasonStart = new Date(currentYear, 0, 1); // Jan 1
  const seasonEnd = new Date(currentYear, 11, 31); // Dec 31

  const { data: existingSchedule } = await supabase
    .from('schedules')
    .select('id')
    .eq('club_id', clubId)
    .eq('season_year', currentYear)
    .eq('is_active', true)
    .limit(1);

  let scheduleId: string;
  if (existingSchedule && existingSchedule.length > 0) {
    scheduleId = existingSchedule[0].id;
    console.log(`  ✓ Schedule exists for ${currentYear}`);
  } else {
    const { data: inserted, error } = await supabase
      .from('schedules')
      .insert({
        club_id: clubId,
        season_type: 'full_year',
        season_year: currentYear,
        season_start_date: seasonStart.toISOString(),
        season_end_date: seasonEnd.toISOString(),
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      console.log(`  ❌ Error creating schedule:`, error.message);
      return;
    }
    scheduleId = inserted.id;
    console.log(`  ✓ Created schedule for ${currentYear}`);
  }

  // 4. Create/link trainer
  console.log('\n👨‍🏫 Setting up trainers...');

  let trainerId: string | null = null;
  if (trainerUser) {
    const { data: existingTrainer } = await supabase
      .from('trainers')
      .select('id')
      .eq('email', trainerUser.email!)
      .limit(1);

    if (existingTrainer && existingTrainer.length > 0) {
      trainerId = existingTrainer[0].id;
      console.log(`  ✓ Trainer record exists`);
    } else {
      const trainerName = trainerUser.user_metadata?.full_name || 'Trainer User';
      const { data: inserted, error } = await supabase
        .from('trainers')
        .insert({
          email: trainerUser.email!,
          name: trainerName,
          specialties: ['badminton', 'coaching'],
          max_hours_per_week: 30,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        console.log(`  ❌ Error creating trainer record:`, error.message);
      } else {
        trainerId = inserted.id;
        console.log(`  ✓ Created trainer record`);
      }
    }

    // Link trainer to club
    if (trainerId) {
      const { data: existingLink } = await supabase
        .from('trainer_club')
        .select('trainer_id')
        .eq('trainer_id', trainerId)
        .eq('club_id', clubId)
        .limit(1);

      if (existingLink && existingLink.length > 0) {
        console.log(`  ✓ Trainer already linked to club`);
      } else {
        const { error } = await supabase.from('trainer_club').insert({
          trainer_id: trainerId,
          club_id: clubId,
        });

        if (error) {
          console.log(`  ❌ Error linking trainer to club:`, error.message);
        } else {
          console.log(`  ✓ Linked trainer to club`);
        }
      }
    }
  }

  // 5. Create sample sessions
  console.log('\n🎾 Creating sample sessions...');

  if (!trainerId) {
    console.log('  ⚠️  No trainer available, skipping sessions');
  } else if (insertedCourts.length === 0) {
    console.log('  ⚠️  No courts available, skipping sessions');
  } else {
    // Create 3 sample sessions for this week (without groups for now)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday);
    monday.setHours(18, 0, 0, 0);

    const sessions = [
      { day: 0, time: '18:00', endTime: '19:30', courtIndex: 0 }, // Monday
      { day: 2, time: '19:00', endTime: '20:30', courtIndex: 1 }, // Wednesday
      { day: 4, time: '17:30', endTime: '19:00', courtIndex: 2 }, // Friday
    ];

    for (const session of sessions) {
      const sessionDate = new Date(monday);
      sessionDate.setDate(monday.getDate() + session.day);
      const [hours, minutes] = session.time.split(':').map(Number);
      sessionDate.setHours(hours, minutes, 0, 0);

      const [endHours, endMinutes] = session.endTime.split(':').map(Number);
      const endDate = new Date(sessionDate);
      endDate.setHours(endHours, endMinutes, 0, 0);

      const courtId = insertedCourts[session.courtIndex % insertedCourts.length];

      // Check if session already exists
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('trainer_id', trainerId)
        .eq('timeslot_start', sessionDate.toISOString())
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`  ✓ Session exists for ${session.time}`);
      } else {
        const { error } = await supabase.from('sessions').insert({
          schedule_id: scheduleId,
          trainer_id: trainerId,
          group_ids: [], // Empty array for now
          week_number: Math.ceil(sessionDate.getDate() / 7),
          timeslot_start: sessionDate.toISOString(),
          timeslot_end: endDate.toISOString(),
          court_id: courtId,
          max_participants: 8,
          notes: 'Regular training session',
        });

        if (error) {
          console.log(`  ❌ Error creating session:`, error.message);
        } else {
          console.log(`  ✓ Created session for ${session.time}`);
        }
      }
    }
  }

  console.log('\n✅ Admin club setup complete!');
  console.log('\n📊 Summary:');
  console.log(`  - Courts: ${insertedCourts.length}`);
  console.log(`  - Schedule: ${scheduleId}`);
  console.log(`  - Trainer: ${trainerId ? 'Yes' : 'No'}`);
}

fixAdminClubDataSimple()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
