import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { EmailService } from '@/src/application/services/email.service';
import { EmailService as InfraEmailService } from '@/src/infrastructure/email/email.service';
import crypto from 'crypto';

/**
 * Note: 'registration_requests' is not in the generated Database type.
 * (supabase as any) is used only for that untyped table. auth.supabase is
 * the user-scoped anon-key client so RLS is still enforced.
 */

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = auth.supabase as any;

    const { data, error } = await sb
      .from('registration_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: data });
  });
}

export async function PATCH(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = auth.supabase as any;
    const user = auth.user;

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

    const { error } = await sb.from('registration_requests').update(updateData).eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (status === 'approved') {
      const { data: registration } = await sb
        .from('registration_requests')
        .select('*')
        .eq('id', id)
        .single();

      let warning: string | undefined;
      let newUserId: string | undefined;
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

          newUserId = authUser.user.id;

          // 2. Insert into users table (requires admin client — bypasses RLS for provisioning)
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

          // 3. Insert into user_club_memberships (requires admin client — bypasses RLS for provisioning)
          const clubId = registration.club_id || auth.clubId;
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

        // 4. Auto-generate first invoice for the new member (if fee config exists)
        try {
          const invoiceClubId = registration.club_id || auth.clubId || '';
          if (invoiceClubId) {
            const { data: feeConfig } = await auth.supabase
              .from('fee_configurations')
              .select('amount, currency')
              .eq('club_id', invoiceClubId)
              .eq('type', 'membership')
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const feeAmount = feeConfig ? Number(feeConfig.amount) : 0;

            // Only create invoice if a fee configuration exists with amount > 0
            if (feeAmount > 0) {
              const { billingEngine } = await import('@/lib/billing-engine');
              const now = new Date();
              const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              const dueDateStr = dueDate.toISOString().slice(0, 10);

              await billingEngine.createInvoice({
                club_id: invoiceClubId,
                member_id: newUserId,
                due_date: dueDateStr,
                items: [
                  {
                    description: `Mitgliedsbeitrag ${now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`,
                    quantity: 1,
                    unit_price: feeAmount,
                    tax_rate: 0,
                    item_type: 'membership_fee',
                  },
                ],
                notes: 'Automatisch erstellt bei Mitgliedsantritt',
              });
            } else {
              console.log('[Approval] No fee configuration found — skipping auto-invoice');
            }
          }
        } catch (invoiceError) {
          // Don't fail the approval if invoice creation fails
          console.error('Auto-invoice creation failed:', invoiceError);
        }

        // 5. Send onboarding email directly (avoids internal fetch auth issue)
        try {
          const regClubId = registration.club_id || auth.clubId || '';
          const { data: settingRows } = await auth.supabase
            .from('system_settings')
            .select('key, value')
            .eq('club_id', regClubId)
            .in('key', ['club_name']);
          const clubName =
            settingRows?.find((r: { key: string }) => r.key === 'club_name')?.value || 'SWINGZ';

          const template = EmailService.generateMembershipApprovalEmail({
            recipientName: registration.first_name || 'Mitglied',
            recipientEmail: registration.email,
            clubName,
            memberType: 'member',
          });

          const infraEmail = new InfraEmailService();
          await infraEmail.sendEmail({ to: registration.email, ...template });
        } catch (e) {
          console.error('Onboarding email failed:', e);
          warning =
            'Mitglied genehmigt und Account erstellt, aber Willkommens-Mail konnte nicht gesendet werden.';
        }
      }
      return NextResponse.json({ success: true, warning });
    }

    return NextResponse.json({ success: true });
  });
}
