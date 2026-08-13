import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { searchQuerySchema } from '@/application/validation/schemas';
import { validateQuery } from '@/application/validation/validator';
import { withApiAuth, type AuthContext } from '@/lib/api-auth';
import { hasRole } from '@/lib/auth-common';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:search');

export interface SearchResult {
  id: string;
  type: 'member' | 'booking' | 'trainer' | 'club';
  title: string;
  subtitle?: string;
  url: string;
  relevance: number;
}

/**
 * Welche Vereine darf eine Rolle durchsuchen?
 *
 *   owner      → alle (null = kein Club-Filter)
 *   superadmin → die von der Tennisschule verwalteten Vereine (bzw. der per
 *                Cookie gewählte)
 *   admin      → genau der eigene Verein
 *   trainer    → genau der eigene Verein
 *   member     → genau der eigene Verein
 *
 * Die Suche liest über den Service-Client (RLS umgangen) — die Autorisierung
 * passiert deshalb ausschließlich hier über diese Scope-Grenze plus die
 * Rollen-Gates in `GET` (gleiches Muster wie /api/members/directory).
 */
function resolveSearchScope(auth: AuthContext): string[] | null {
  if (auth.role === 'owner') return null;
  if (auth.role === 'superadmin') {
    if (auth.clubId) return [auth.clubId];
    return [
      ...new Set(
        auth.memberships
          .filter((m) => m.role === 'superadmin' && m.club_id)
          .map((m) => m.club_id as string)
      ),
    ];
  }
  return auth.clubId ? [auth.clubId] : [];
}

type Supabase = ReturnType<typeof createServiceClient>;

/** Gemeinsame Basis: passende `users`-Zeilen zu Name/E-Mail. */
async function findMatchingUsers(
  supabase: Supabase,
  q: string,
  limit: number
): Promise<Array<{ id: string; full_name: string | null; email: string }>> {
  const { data } = await supabase
    .from('users')
    .select('id, full_name, email')
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(Math.max(limit * 2, 50));
  return (data ?? []) as Array<{ id: string; full_name: string | null; email: string }>;
}

async function searchMembers(
  supabase: Supabase,
  scope: string[] | null,
  q: string,
  limit: number
): Promise<SearchResult[]> {
  const users = await findMatchingUsers(supabase, q, limit);
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return [];

  let query = supabase
    .from('user_club_memberships')
    .select('id, user_id')
    .in('user_id', userIds)
    .eq('is_active', true)
    .not('role', 'in', '(trainer,superadmin)')
    .limit(limit);
  if (scope !== null) query = query.in('club_id', scope);

  const { data: memberships } = await query;

  const userMap = new Map(users.map((u) => [u.id, u]));
  return ((memberships ?? []) as Array<{ id: string; user_id: string }>).map((m) => {
    const u = userMap.get(m.user_id);
    return {
      id: m.id,
      type: 'member' as const,
      title: u?.full_name || u?.email || 'Mitglied',
      subtitle: u?.email,
      url: `/admin/members/${m.id}`,
      relevance: 10,
    };
  });
}

async function searchTrainers(
  supabase: Supabase,
  scope: string[] | null,
  q: string,
  limit: number
): Promise<SearchResult[]> {
  const users = await findMatchingUsers(supabase, q, limit);
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return [];

  let query = supabase
    .from('user_club_memberships')
    .select('id, user_id')
    .in('user_id', userIds)
    .eq('role', 'trainer')
    .eq('is_active', true)
    .limit(limit);
  if (scope !== null) query = query.in('club_id', scope);

  const { data: memberships } = await query;

  const userMap = new Map(users.map((u) => [u.id, u]));
  return ((memberships ?? []) as Array<{ id: string; user_id: string }>).map((m) => {
    const u = userMap.get(m.user_id);
    return {
      id: m.id,
      type: 'trainer' as const,
      title: u?.full_name || u?.email || 'Trainer',
      subtitle: u?.email,
      url: '/admin/trainers',
      relevance: 8,
    };
  });
}

async function searchBookings(
  supabase: Supabase,
  scope: string[] | null,
  auth: AuthContext,
  q: string,
  limit: number
): Promise<SearchResult[]> {
  let query = supabase
    .from('bookings')
    .select('id, booking_number, booked_at, status')
    .or(`booking_number.ilike.%${q}%,id.ilike.%${q}%`)
    .limit(limit);

  if (hasRole(auth.role, 'admin')) {
    // Admin/Superadmin/Owner: Vereins-weit (owner = alle Vereine).
    if (scope !== null) query = query.in('club_id', scope);
  } else {
    // Trainer/Mitglied: nur die eigenen Buchungen.
    query = query.eq('member_id', auth.user.id);
  }

  const { data: bookings } = await query;

  return (
    (bookings ?? []) as Array<{
      id: string;
      booking_number: string | null;
      booked_at: string;
      status: string;
    }>
  ).map((b) => {
    const date = new Date(b.booked_at).toLocaleDateString('de-DE');
    return {
      id: b.id,
      type: 'booking' as const,
      title: b.booking_number ? `Buchung ${b.booking_number}` : `Buchung ${date}`,
      subtitle: `Status: ${b.status}`,
      url: '/bookings',
      relevance: 5,
    };
  });
}

async function searchClubs(
  supabase: Supabase,
  scope: string[] | null,
  q: string,
  limit: number,
  clubUrl: string
): Promise<SearchResult[]> {
  let query = supabase.from('clubs').select('id, name').ilike('name', `%${q}%`).limit(limit);
  if (scope !== null) query = query.in('id', scope);

  const { data: clubs } = await query;

  return ((clubs ?? []) as Array<{ id: string; name: string }>).map((c) => ({
    id: c.id,
    type: 'club' as const,
    title: c.name,
    url: clubUrl,
    relevance: 7,
  }));
}

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    // Bewusst KEIN Rollen-Gate: jeder angemeldete Nutzer darf suchen. Was er
    // sieht, entscheidet die Scope-/Rollen-Logik weiter unten.
    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const validation = validateQuery(searchQuerySchema, url.searchParams);
    if (!validation) {
      return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
    }
    const { q, type, limit } = validation.data;

    const scope = resolveSearchScope(auth);
    const supabase = createServiceClient();

    // Wem darf welcher Ergebnistyp angezeigt werden?
    const isAdminOrAbove = hasRole(auth.role, 'admin');
    const isPlatformStaff = auth.role === 'owner' || auth.role === 'superadmin';
    const hasScope = scope === null || scope.length > 0;

    const tasks: Promise<SearchResult[]>[] = [];
    // Ein einzelner fehlschlagender Bereich (z. B. noch nicht migrierte
    // Tabelle) soll die übrigen Ergebnisse nicht mitreißen.
    const safe = (p: Promise<SearchResult[]>) =>
      p.catch((e) => {
        log.warn('Ein Suchbereich schlug fehl:', e);
        return [];
      });

    // Mitglieder & Trainer: Vereinsverwaltung → nur Admin/Superadmin/Owner.
    if (hasScope && isAdminOrAbove && (type === 'all' || type === 'members')) {
      tasks.push(safe(searchMembers(supabase, scope, q, limit)));
    }
    if (hasScope && isAdminOrAbove && (type === 'all' || type === 'trainers')) {
      tasks.push(safe(searchTrainers(supabase, scope, q, limit)));
    }

    // Buchungen: Admin+ vereinsweit, Trainer/Mitglied nur die eigenen.
    if (type === 'all' || type === 'bookings') {
      if (isAdminOrAbove ? hasScope : true) {
        tasks.push(safe(searchBookings(supabase, scope, auth, q, limit)));
      }
    }

    // Vereine: nur Plattform-Personal (Owner/Superadmin).
    if (type === 'all' && isPlatformStaff && hasScope) {
      tasks.push(
        safe(
          searchClubs(
            supabase,
            scope,
            q,
            limit,
            auth.role === 'owner' ? '/owner/clubs' : '/superadmin/clubs'
          )
        )
      );
    }

    const grouped = await Promise.all(tasks);
    const results = grouped
      .flat()
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    return NextResponse.json(results);
  });
}
