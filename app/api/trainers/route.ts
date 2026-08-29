/**
 * GET /api/trainers — list trainers in the user's club
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveTrainerRecordIds } from '@/lib/trainers/trainer-record';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainers');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const { clubId } = auth;

    if (!clubId) {
      return NextResponse.json({ trainers: [] });
    }

    // Die RLS-Policy auf user_club_memberships gibt einem Mitglied nur die eigene
    // Zeile frei — ein Client-Query liefert deshalb immer eine leere Liste. Der
    // Service-Client umgeht das; die Autorisierung ist hier explizit: `clubId`
    // stammt aus der eigenen aktiven Mitgliedschaft.
    const supabase = createServiceClient();

    // Fetch trainer memberships for this club
    const { data, error } = await supabase
      .from('user_club_memberships')
      .select(`id, user_id, users!user_club_memberships_user_id_fkey(id, full_name, email)`)
      .eq('club_id', clubId)
      .eq('role', 'trainer')
      .eq('is_active', true);

    if (error) {
      log.error('trainers GET error:', error);
      return NextResponse.json({ error: 'Trainer konnten nicht geladen werden' }, { status: 500 });
    }

    // Trainer-Slots hängen an trainers.id, nicht an users.id. Die Liste liefert
    // deshalb die Datensatz-ID, damit /api/trainer/availability und
    // /api/trainer/book auf denselben Schlüssel zeigen (siehe
    // lib/trainers/trainer-record.ts). Ohne Datensatz fällt sie auf die user_id
    // zurück — solche Trainer haben dann schlicht keine Slots.
    const userIds = (data ?? []).map((m: any) => m.user_id);
    const recordIdByUser = await resolveTrainerRecordIds(userIds);

    // Also try to get trainer profile specialties
    const profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      try {
        const result = await supabase
          .from('trainer_profiles' as any)
          .select('user_id, specialties, bio')
          .in('user_id', userIds);
        (result.data ?? []).forEach((p: any) => {
          profileMap[p.user_id] = p;
        });
      } catch {
        // Table may not exist — skip profiles
      }
    }

    const trainers = (data ?? []).map((m: any) => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      const profile = profileMap[m.user_id] ?? {};
      return {
        id: recordIdByUser.get(m.user_id) ?? m.user_id,
        full_name: u?.full_name ?? 'Trainer',
        email: u?.email ?? '',
        specialties: profile.specialties ?? [],
        bio: profile.bio ?? null,
      };
    });

    return NextResponse.json({ trainers });
  });
}
