import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { logPiiRead } from '@/lib/db/audit-logger';
import { createServiceClient } from '@/lib/supabase/service';
import { toCsv, csvHeaders } from '@/lib/csv';
import { formatMemberNumber } from '@/lib/format';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:analytics:members:export');

/**
 * Mitgliederliste als CSV — der Ausstiegsweg aus SwingZ
 * (PRODUKTIONSREIFE.md 3.5 und 4.7).
 *
 * Liest die Mitgliedschaften direkt statt über den Domain-Use-Case: der
 * Export braucht die Mitgliedsnummer, und die haengt an der Mitgliedschaft
 * (`user_club_memberships.member_number`), nicht an der Person. Ein Export
 * ist eine Auswertung, kein Vorgang der Domaene.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Der aktive Verein aus dem Auth-Kontext ist der Normalfall; der
    // clubId-Parameter bleibt für den Superadmin, der einen bestimmten Verein
    // exportiert. Vorher war der Parameter Pflicht — und die einzige Stelle,
    // die den Export verlinkt (components/reports-dashboard.tsx), gab ihn
    // nicht mit. Der Download lieferte damit immer 400.
    const requested = new URL(request.url).searchParams.get('clubId');
    const clubId = requested ?? auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
    }
    if (!verifyClubAccess(auth, clubId)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const sb = createServiceClient();
      const { data, error } = await sb
        .from('user_club_memberships')
        .select(
          'member_number, role, is_active, joined_at, users!user_club_memberships_user_id_fkey(full_name, email, phone)'
        )
        .eq('club_id', clubId)
        .order('member_number', { ascending: true });

      if (error) {
        log.error('Mitglieder-Export nicht lesbar', new Error(error.message));
        return internalErrorResponse('Mitgliederliste konnte nicht gelesen werden');
      }

      const rows = (data ?? []).map((m: Record<string, any>) => ({
        nr: formatMemberNumber(m.member_number),
        name: m.users?.full_name ?? '',
        email: m.users?.email ?? '',
        telefon: m.users?.phone ?? '',
        rolle: m.role ?? '',
        beitritt: m.joined_at ? String(m.joined_at).slice(0, 10) : '',
        status: m.is_active ? 'aktiv' : 'inaktiv',
      }));

      // Ein Export trägt die Mitgliederdaten aus dem System heraus — das ist
      // der Vorgang, den ein Protokoll festhalten muss (anders als das bloße
      // Öffnen der Liste, siehe /api/members).
      await logPiiRead(
        auth.user.id,
        'member',
        `export:${clubId}`,
        request,
        { format: 'csv', count: rows.length },
        clubId
      );

      const csv = toCsv(rows, [
        ['nr', 'Mitgliedsnummer'],
        ['name', 'Name'],
        ['email', 'E-Mail'],
        ['telefon', 'Telefon'],
        ['rolle', 'Rolle'],
        ['beitritt', 'Beitritt'],
        ['status', 'Status'],
      ]);

      return new NextResponse(csv, { headers: csvHeaders(`mitglieder-${clubId}`) });
    } catch (err) {
      log.error('Mitglieder-Export fehlgeschlagen', err instanceof Error ? err : undefined);
      return internalErrorResponse();
    }
  });
}
