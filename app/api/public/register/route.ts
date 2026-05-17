import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      street,
      city,
      postalCode,
      playingLevel,
      previousClub,
      motivation,
      wantsTrialTraining,
      clubId,
    } = body;

    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: 'Vorname, Nachname und E-Mail sind erforderlich' },
        { status: 400 }
      );
    }

    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Gültige E-Mail-Adresse erforderlich' }, { status: 400 });
    }

    // Check for existing registration
    const { data: existing } = await (supabase as any)
      .from('registration_requests')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Eine Registrierung mit dieser E-Mail liegt bereits vor' },
        { status: 409 }
      );
    }

    // Check for existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ein Account mit dieser E-Mail existiert bereits' },
        { status: 409 }
      );
    }

    // Insert registration request
    const { error: insertError } = await (supabase as any).from('registration_requests').insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      street: street?.trim() || null,
      city: city?.trim() || null,
      postal_code: postalCode?.trim() || null,
      playing_level: playingLevel || 'intermediate',
      previous_club: previousClub?.trim() || null,
      motivation: motivation?.trim() || null,
      wants_trial_training: wantsTrialTraining ?? true,
      club_id: clubId || null,
      status: 'pending',
    });

    if (insertError) {
      console.error('Registration insert error:', insertError);
      return NextResponse.json(
        { error: 'Fehler beim Speichern der Registrierung' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Registrierung erfolgreich eingereicht' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
