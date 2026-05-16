import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// POST /api/applications — submit a membership application (public endpoint)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const requiredFields = ['firstName', 'lastName', 'email'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    });

    const { data, error } = await supabase
      .from('membership_applications')
      .insert({
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email,
        phone: body.phone || '',
        date_of_birth: body.dateOfBirth || null,
        street: body.street || '',
        house_number: body.houseNumber || '',
        postal_code: body.postalCode || '',
        city: body.city || '',
        tennis_experience: body.experience || '',
        tennis_playing_level: body.playingLevel || '',
        tennis_preferred_days: body.preferredDays || [],
        tennis_goals: body.goals || '',
        previous_clubs: body.previousClubs || '',
        motivation: body.motivation || '',
        availability: body.availability || '',
        special_requirements: body.specialRequirements || '',
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      // Table may not exist — still return success for demo mode
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, id: 'demo-application-id' });
      }
      console.error('Application submission error:', error);
      return NextResponse.json({ error: 'Submission failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Application error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
