import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const trainerId = searchParams.get('trainer_id');
    const startDate = searchParams.get('start_date');
    const clubId = searchParams.get('club_id');

    // Build query
    let query = (supabase as any).from('trainer_availability').select('*');

    if (trainerId) {
      query = query.eq('trainer_id', trainerId);
    }

    if (clubId) {
      query = query.eq('club_id', clubId);
    }

    if (startDate) {
      query = query.gte('day_of_week', new Date(startDate).getDay());
    }

    const { data: availabilities, error } = await query.order('day_of_week', { ascending: true });

    if (error) {
      console.error('Error fetching availabilities:', error);
      return NextResponse.json({ error: 'Failed to fetch availabilities' }, { status: 500 });
    }

    return NextResponse.json({ availabilities: availabilities || [] });
  } catch (error) {
    console.error('Trainer availability GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { trainer_id, club_id, day_of_week, start_time, end_time, is_available } = body;

    // Validate required fields
    if (
      trainer_id === undefined ||
      club_id === undefined ||
      day_of_week === undefined ||
      !start_time ||
      !end_time
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if trainer exists and user has permission
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'trainer', 'superadmin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // If trainer role, can only manage own availability
    if (profile.role === 'trainer' && trainer_id !== user.id) {
      return NextResponse.json({ error: 'Can only manage own availability' }, { status: 403 });
    }

    // Check for conflicts
    const { data: conflicts } = await (supabase as any)
      .from('trainer_availability')
      .select('id')
      .eq('trainer_id', trainer_id)
      .eq('club_id', club_id)
      .eq('day_of_week', day_of_week)
      .or(`and(start_time.lte.${end_time},end_time.gte.${start_time})`);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: 'Availability conflict detected' }, { status: 409 });
    }

    // Create availability
    const { data: availability, error } = await (supabase as any)
      .from('trainer_availability')
      .insert({
        trainer_id,
        club_id,
        day_of_week,
        start_time,
        end_time,
        is_available: is_available !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating availability:', error);
      return NextResponse.json({ error: 'Failed to create availability' }, { status: 500 });
    }

    return NextResponse.json({ availability }, { status: 201 });
  } catch (error) {
    console.error('Trainer availability POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const availabilityId = searchParams.get('id');

    if (!availabilityId) {
      return NextResponse.json({ error: 'Availability ID required' }, { status: 400 });
    }

    // Get availability to check permissions
    const { data: availability } = await (supabase as any)
      .from('trainer_availability')
      .select('trainer_id')
      .eq('id', availabilityId)
      .single();

    if (!availability) {
      return NextResponse.json({ error: 'Availability not found' }, { status: 404 });
    }

    // Check permissions
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'trainer', 'superadmin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (profile.role === 'trainer' && availability.trainer_id !== user.id) {
      return NextResponse.json({ error: 'Can only delete own availability' }, { status: 403 });
    }

    // Delete availability
    const { error } = await (supabase as any)
      .from('trainer_availability')
      .delete()
      .eq('id', availabilityId);

    if (error) {
      console.error('Error deleting availability:', error);
      return NextResponse.json({ error: 'Failed to delete availability' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trainer availability DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
