import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { parseMemberCsv, validateMemberRecords } from '@/lib/csv/member-import';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:members:bulk-import');

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  invalid: Array<{ record: { email: string; fullName: string }; errors: string[] }>;
  errors: Array<{ record: { email: string; fullName: string }; error: string }>;
}

/**
 * POST /api/members/bulk-import
 * Admin imports members from a CSV file.
 * Uses Supabase Admin API (service role) to create users and memberships.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) {
      return forbiddenResponse('Admin-Zugriff erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server-Konfigurationsfehler: Service-Key fehlt' },
        { status: 500 }
      );
    }

    /** Convert German date (DD.MM.YYYY) or ISO date to YYYY-MM-DD for DB */
    function normalizeDate(raw?: string): string | undefined {
      if (!raw) return undefined;
      // Already ISO format
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      // German format DD.MM.YYYY
      const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (match) {
        const [, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return undefined;
    }

    // Determine target club. auth.clubId is the cookie-aware resolved club for
    // the caller (see lib/auth/resolve-active-club.ts via buildAuthContext) —
    // superadmin picks up ADMIN_CLUB_COOKIE only when it points at an existing
    // club, admin gets their pinned admin club.
    const { searchParams } = new URL(request.url);
    const targetClubId: string | null = auth.clubId;
    if (!targetClubId) {
      return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
    }

    // Parse CSV from form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Nur CSV-Dateien werden akzeptiert' }, { status: 400 });
    }

    const csvContent = await file.text();

    // Allow caller to set a default role (e.g. ?defaultRole=trainer for trainer import)
    const rawRole = searchParams.get('defaultRole');
    const defaultRole = rawRole === 'trainer' ? ('trainer' as const) : undefined;

    // Parse and validate
    let records;
    try {
      records = parseMemberCsv(csvContent, defaultRole);
    } catch (parseErr) {
      log.error('CSV parse error:', parseErr);
      return NextResponse.json(
        { error: 'CSV-Datei konnte nicht gelesen werden. Bitte prüfe das Format.' },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'Keine Datensätze in der CSV-Datei gefunden' },
        { status: 400 }
      );
    }

    if (records.length > 500) {
      return NextResponse.json(
        { error: 'Maximal 500 Mitglieder pro Import erlaubt' },
        { status: 400 }
      );
    }

    const { valid, invalid } = validateMemberRecords(records);

    // Use service role client to create users
    const adminSupabase = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: { getAll: () => [], setAll: () => {} },
    });

    // Pre-fetch existing users by email from public.users table
    const validEmails = valid.map((r) => r.email);
    const { data: existingUsersData } = await adminSupabase
      .from('users')
      .select('id, email')
      .in('email', validEmails);

    const existingUsersByEmail = new Map(
      (existingUsersData || []).map((u: { id: string; email: string }) => [
        u.email.toLowerCase(),
        u,
      ])
    );

    // Pre-fetch existing memberships for this club
    const { data: existingMemberships } = await adminSupabase
      .from('user_club_memberships')
      .select('user_id, is_active')
      .eq('club_id', targetClubId);

    const existingMemberIds = new Set(
      (existingMemberships || []).map((m: { user_id: string }) => m.user_id)
    );

    // For users not in public.users, try to find them via auth admin listUsers
    const emailsToLookup = validEmails.filter((e) => !existingUsersByEmail.has(e));
    if (emailsToLookup.length > 0) {
      const { data: authUsersList } = await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (authUsersList?.users) {
        for (const authUser of authUsersList.users) {
          const email = authUser.email?.toLowerCase();
          if (email && emailsToLookup.includes(email) && !existingUsersByEmail.has(email)) {
            existingUsersByEmail.set(email, { id: authUser.id, email });
          }
        }
      }
    }

    const result: ImportResult = {
      success: true,
      total: records.length,
      imported: 0,
      skipped: 0,
      failed: 0,
      invalid,
      errors: [],
    };

    // Process each valid record
    for (const record of valid) {
      try {
        const existingUser = existingUsersByEmail.get(record.email);

        let userId: string;

        if (existingUser) {
          // User already exists — use existing ID
          userId = existingUser.id;

          // Check if already member of this club
          if (existingMemberIds.has(userId)) {
            result.skipped++;
            continue;
          }

          const dob = normalizeDate(record.dateOfBirth);
          // Ensure user is in public.users table (may be missing if found only in auth)
          await adminSupabase.from('users').upsert({
            id: userId,
            email: record.email,
            full_name: record.fullName,
            ...(record.phone ? { phone: record.phone } : {}),
            ...(dob ? { date_of_birth: dob } : {}),
            ...(record.street ? { address: record.street } : {}),
            ...(record.postalCode ? { postal_code: record.postalCode } : {}),
            ...(record.city ? { city: record.city } : {}),
            ...(record.emergencyContact ? { emergency_contact: record.emergencyContact } : {}),
            ...(record.emergencyPhone ? { emergency_phone: record.emergencyPhone } : {}),
            updated_at: new Date().toISOString(),
          });
        } else {
          // Create new user via Supabase Admin API (without sending invite email)
          const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
            email: record.email,
            email_confirm: true,
            user_metadata: {
              full_name: record.fullName,
            },
          });

          if (createError || !newUser?.user) {
            result.failed++;
            result.errors.push({
              record,
              error: createError?.message || 'User-Erstellung fehlgeschlagen',
            });
            continue;
          }

          userId = newUser.user.id;

          const dob = normalizeDate(record.dateOfBirth);
          // Ensure user is in public.users table
          await adminSupabase.from('users').upsert({
            id: userId,
            email: record.email,
            full_name: record.fullName,
            ...(record.phone ? { phone: record.phone } : {}),
            ...(dob ? { date_of_birth: dob } : {}),
            ...(record.street ? { address: record.street } : {}),
            ...(record.postalCode ? { postal_code: record.postalCode } : {}),
            ...(record.city ? { city: record.city } : {}),
            ...(record.emergencyContact ? { emergency_contact: record.emergencyContact } : {}),
            ...(record.emergencyPhone ? { emergency_phone: record.emergencyPhone } : {}),
            updated_at: new Date().toISOString(),
          });
        }

        // Create membership
        const { error: membershipError } = await adminSupabase
          .from('user_club_memberships')
          .insert({
            user_id: userId,
            club_id: targetClubId,
            role: record.role,
            is_active: true,
            status: 'active',
            ...(normalizeDate(record.joinedAt)
              ? { joined_at: normalizeDate(record.joinedAt) }
              : {}),
          });

        if (membershipError) {
          result.failed++;
          result.errors.push({
            record,
            error: `Membership-Erstellung fehlgeschlagen: ${membershipError.message}`,
          });
          continue;
        }

        // If role is trainer, ensure trainers record exists
        if (record.role === 'trainer') {
          const { data: existingTrainer } = await adminSupabase
            .from('trainers')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

          if (!existingTrainer) {
            await adminSupabase.from('trainers').upsert({
              id: userId,
              // Siehe app/api/members/invite/route.ts: ohne user_id findet die
              // Saisonplanung die Präferenzen dieses Trainers nie.
              user_id: userId,
              email: record.email,
              name: record.fullName,
              specialties: [],
              max_hours_per_week: 30,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }

        result.imported++;
      } catch (_err) {
        result.failed++;
        result.errors.push({
          record,
          error: 'Import fehlgeschlagen',
        });
      }
    }

    // Audit log
    if (result.imported > 0) {
      await logAudit({
        actorId: auth.user.id,
        action: 'members_bulk_imported',
        resourceType: 'member',
        resourceId: targetClubId,
        clubId: targetClubId,
        details: {
          total: result.total,
          imported: result.imported,
          skipped: result.skipped,
          failed: result.failed,
        },
        request,
      });
    }

    return NextResponse.json(result);
  });
}
