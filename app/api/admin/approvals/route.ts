import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin role
    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await (supabase as any)
      .from('registration_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ requests: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin
    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('role, club_id')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, status, rejectionReason } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'ID und Status erforderlich' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (status === 'rejected' && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    const { error } = await (supabase as any)
      .from('registration_requests')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    if (status === 'approved') {
      const { data: registration } = await (supabase as any)
        .from('registration_requests')
        .select('*')
        .eq('id', id)
        .single();

      let warning: string | undefined;
      if (registration) {
        // 1. Create Supabase Auth user via Admin API
        try {
          const adminClient = await createAdminClient();
          const tempPassword = crypto.randomBytes(24).toString('base64url');

          const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
            email: registration.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              first_name: registration.first_name,
              last_name: registration.last_name,
              phone: registration.phone,
            },
          });

          if (createError || !authUser?.user) {
            console.error('Failed to create Auth user:', createError);
            return NextResponse.json(
              { error: 'Mitglied genehmigt, aber Account-Erstellung fehlgeschlagen' },
              { status: 500 }
            );
          }

          // 2. Insert into users table
          const { error: userInsertError } = await (adminClient as any).from('users').insert({
            id: authUser.user.id,
            email: registration.email,
            first_name: registration.first_name,
            last_name: registration.last_name,
            phone: registration.phone,
            playing_level: registration.playing_level,
            created_at: new Date().toISOString(),
          });

          if (userInsertError) {
            console.error('Failed to insert user — cleaning up Auth user:', userInsertError);
            await adminClient.auth.admin.deleteUser(authUser.user.id);
            return NextResponse.json(
              { error: 'Mitglied genehmigt, aber Profil-Erstellung fehlgeschlagen' },
              { status: 500 }
            );
          }

          // 3. Insert into user_club_memberships
          const clubId = registration.club_id || membership.club_id;
          if (clubId) {
            const { error: membershipError } = await (adminClient as any)
              .from('user_club_memberships')
              .insert({
                user_id: authUser.user.id,
                club_id: clubId,
                role: 'member',
                is_active: true,
              });

            if (membershipError) {
              console.error('Failed to insert membership:', membershipError);
              warning = 'Mitglied erstellt, aber Vereinszuordnung konnte nicht gespeichert werden.';
            }
          }
        } catch (e) {
          console.error('Auth user creation failed:', e);
          return NextResponse.json(
            { error: 'Mitglied genehmigt, aber Account-Erstellung fehlgeschlagen' },
            { status: 500 }
          );
        }

        // 4. Send onboarding email (existing flow)
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/emails/onboarding`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: registration.email,
              firstName: registration.first_name,
              clubId: registration.club_id || membership.club_id,
            }),
          });
        } catch (e) {
          console.error('Onboarding email trigger failed:', e);
          warning =
            'Mitglied genehmigt und Account erstellt, aber Willkommens-Mail konnte nicht gesendet werden.';
        }
      }
      return NextResponse.json({ success: true, warning });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
