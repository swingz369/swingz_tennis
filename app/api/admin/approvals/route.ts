import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { createServiceClient } from '@/lib/supabase/service';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { EmailService } from '@/src/application/services/email.service';
import { EmailService as InfraEmailService } from '@/src/infrastructure/email/email.service';
import { createLogger } from '@/lib/logger';
import crypto from 'crypto';

const log = createLogger('api:approvals');

/**
 * Note: 'registration_requests' is not in the generated Database type.
 * (supabase) is used only for that untyped table. auth.supabase is
 * the user-scoped anon-key client so RLS is still enforced.
 */

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const sb = auth.supabase;

    const { data, error } = await sb
      .from('registration_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ requests: data });
  });
}

export async function PATCH(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const sb = auth.supabase;
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

    const { error } = await sb
      .from('registration_requests')
      .update(updateData as never)
      .eq('id', id);

    if (error) {
      return internalErrorResponse();
    }

    if (status === 'approved') {
      // ── Provisioning (best-effort) ───────────────────────────────
      // The status is already 'approved' — all provisioning steps below
      // are best-effort. Failures are logged and returned as warnings,
      // never as 500 errors, so the client always sees success.
      // ─────────────────────────────────────────────────────────────
      const warnings: string[] = [];

      try {
        const { data: registration } = await sb
          .from('registration_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (!registration) {
          log.warn('Registration not found after status update — skipping provisioning', { id });
          return NextResponse.json({
            success: true,
            warning: 'Genehmigt, aber Registrierung konnte nicht nachgeladen werden.',
          });
        }

        const adminClient = createServiceClient();
        let newUserId: string | undefined;

        // 1. Create or reuse Supabase Auth user
        try {
          const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers();
          const existingAuthUser = existingAuthUsers?.users.find(
            (u) => u.email?.toLowerCase() === registration.email.toLowerCase()
          );

          if (existingAuthUser) {
            newUserId = existingAuthUser.id;
            log.info('Auth user already exists, reusing', { userId: newUserId });
          } else {
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
              log.error('Failed to create Auth user', { error: createError });
              warnings.push('Account-Erstellung fehlgeschlagen.');
            } else {
              newUserId = authUser.user.id;
            }
          }
        } catch (e) {
          log.error('Auth user provisioning failed', { error: e });
          warnings.push('Account-Erstellung fehlgeschlagen.');
        }

        // 2. Insert into users table (idempotent)
        if (newUserId) {
          try {
            const { data: existingPublicUser } = await adminClient
              .from('users')
              .select('id')
              .eq('id', newUserId)
              .maybeSingle();

            if (!existingPublicUser) {
              const { data: ghostProfile } = await adminClient
                .from('users')
                .select('id')
                .eq('email', registration.email)
                .maybeSingle();

              if (ghostProfile) {
                log.info('Ghost profile found, migrating to auth user', {
                  ghostId: ghostProfile.id,
                  authUserId: newUserId,
                });
                await adminClient
                  .from('user_club_memberships')
                  .update({ user_id: newUserId })
                  .eq('user_id', ghostProfile.id);
                await adminClient.from('users').delete().eq('id', ghostProfile.id);
              }

              const { error: userInsertError } = await adminClient.from('users').insert({
                id: newUserId,
                email: registration.email,
                full_name:
                  `${registration.first_name || ''} ${registration.last_name || ''}`.trim(),
                phone: registration.phone,
                created_at: new Date().toISOString(),
              });
              if (userInsertError) {
                log.error('Failed to insert user', { error: userInsertError });
                warnings.push('Profil-Erstellung fehlgeschlagen.');
              }
            }
          } catch (e) {
            log.error('User profile provisioning failed', { error: e });
            warnings.push('Profil-Erstellung fehlgeschlagen.');
          }

          // 3. Insert into user_club_memberships
          try {
            const clubId = registration.club_id || auth.clubId;
            if (clubId) {
              const { error: membershipError } = await adminClient
                .from('user_club_memberships')
                .insert({ user_id: newUserId, club_id: clubId, role: 'member', is_active: true });
              if (membershipError) {
                log.error('Failed to insert membership', { error: membershipError });
                warnings.push('Vereinszuordnung fehlgeschlagen.');
              }
            }
          } catch (e) {
            log.error('Membership provisioning failed', { error: e });
            warnings.push('Vereinszuordnung fehlgeschlagen.');
          }
        }

        // 4. Auto-generate invoice (best-effort)
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
            if (feeAmount > 0 && newUserId) {
              const { billingEngine } = await import('@/lib/billing-engine');
              const now = new Date();
              const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              await billingEngine.createInvoice({
                club_id: invoiceClubId,
                member_id: newUserId,
                due_date: dueDate.toISOString().slice(0, 10),
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
            }
          }
        } catch (invoiceError) {
          log.error('Auto-invoice creation failed', { error: invoiceError });
        }

        // 5. Send onboarding email (best-effort)
        try {
          const regClubId = registration.club_id || auth.clubId || '';
          const { data: clubRow } = await auth.supabase
            .from('clubs')
            .select('name')
            .eq('id', regClubId)
            .maybeSingle();
          const clubName = clubRow?.name || 'Dein Verein';
          const template = EmailService.generateMembershipApprovalEmail({
            recipientName: registration.first_name || 'Mitglied',
            recipientEmail: registration.email,
            clubName,
            memberType: 'member',
          });
          const infraEmail = new InfraEmailService();
          await infraEmail.sendEmail({ to: registration.email, ...template });
        } catch (e) {
          log.error('Onboarding email failed', { error: e });
          warnings.push('Willkommens-Mail konnte nicht gesendet werden.');
        }
      } catch (outerErr) {
        log.error('Approval provisioning failed (outer)', { error: outerErr });
        warnings.push('Einige Nachbereitungen sind fehlgeschlagen.');
      }

      return NextResponse.json({
        success: true,
        ...(warnings.length > 0 ? { warning: warnings.join(' ') } : {}),
      });
    }

    return NextResponse.json({ success: true });
  });
}
