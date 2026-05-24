import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createServiceClient();

async function fixAdminClubData() {
  console.log('🔧 Fixing admin club data...\n');

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

  // 2. Create court types if not exist
  console.log('📋 Setting up court types...');
  const courtTypes = [
    { name: 'Standard Court', surface: 'hard', description: 'Standard Badminton Court' },
    {
      name: 'Premium Court',
      surface: 'synthetic',
      description: 'Premium Court with better flooring',
    },
  ];

  const insertedCourtTypes: string[] = [];
  for (const ct of courtTypes) {
    const { data: existing } = await supabase
      .from('court_types')
      .select('id')
      .eq('name', ct.name)
      .limit(1);

    if (existing && existing.length > 0) {
      insertedCourtTypes.push(existing[0].id);
      console.log(`  ✓ Court type exists: ${ct.name}`);
    } else {
      const { data: inserted, error } = await supabase
        .from('court_types')
        .insert(ct)
        .select('id')
        .single();

      if (error) {
        console.log(`  ❌ Error creating court type ${ct.name}:`, error.message);
      } else {
        insertedCourtTypes.push(inserted.id);
        console.log(`  ✓ Created court type: ${ct.name}`);
      }
    }
  }

  // 3. Create courts for the club
  console.log('\n🏟️  Creating courts...');
  const courts = [
    { name: 'Court 1', number: 1, court_type_id: insertedCourtTypes[0] },
    { name: 'Court 2', number: 2, court_type_id: insertedCourtTypes[0] },
    { name: 'Court 3', number: 3, court_type_id: insertedCourtTypes[1] },
    { name: 'Court 4', number: 4, court_type_id: insertedCourtTypes[1] },
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
          court_type_id: court.court_type_id,
          name: court.name,
          number: court.number,
          surface: 'hard',
          has_lighting: true,
          lighting_hours_start: '06:00',
          lighting_hours_end: '22:00',
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

  // 4. Create schedule (season)
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

  // 5. Create/link trainer
  console.log('\n👨‍🏫 Setting up trainers...');

  // First, ensure trainer@swingz.com exists in trainers table
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

  // 6. Create sample sessions
  console.log('\n🎾 Creating sample sessions...');

  if (!trainerId) {
    console.log('  ⚠️  No trainer available, skipping sessions');
  } else {
    // Create a training group
    const { data: existingGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('club_id', clubId)
      .eq('name', 'Beginner Group')
      .limit(1);

    let groupId: string;
    if (existingGroup && existingGroup.length > 0) {
      groupId = existingGroup[0].id;
      console.log(`  ✓ Training group exists`);
    } else {
      const { data: inserted, error } = await supabase
        .from('groups')
        .insert({
          club_id: clubId,
          name: 'Beginner Group',
          description: 'For beginners',
          level: 'beginner',
          age_group: 'adult',
          is_active: true,
          member_ids: [],
        })
        .select('id')
        .single();

      if (error) {
        console.log(`  ❌ Error creating group:`, error.message);
        return;
      }
      groupId = inserted.id;
      console.log(`  ✓ Created training group`);
    }

    // Create 3 sample sessions for this week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
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
          group_ids: [groupId],
          week_number: Math.ceil(sessionDate.getDate() / 7),
          timeslot_start: sessionDate.toISOString(),
          timeslot_end: endDate.toISOString(),
          court_id: insertedCourts[session.courtIndex],
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
}

fixAdminClubData()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
