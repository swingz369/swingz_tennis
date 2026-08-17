import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { internalErrorResponse } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
import { availabilitySlots, type WeeklyAvailability } from '@/app/api/partner-finder/route';

const log = createLogger('api:admin:partner-finder:stats');

/**
 * GET /api/admin/partner-finder/stats
 *
 * Vereinsweite Kennzahlen der Spielpartner-Suche für die Admin-Übersicht.
 * Bewusst KEINE persönlichen Matches — das ist die Verwaltungssicht, die
 * persönliche Suche lebt auf der Mitglieder-Oberfläche (/partner-finder).
 */
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Zugriff nur für Admins' }, { status: 403 });
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 404 });
    }

    try {
      // Spieler-Pool = alle aktiven Vereinsmitglieder mit Spieler-Rolle.
      // Ein Admin ist selbst Mitglied seines Vereins (eine Zeile pro (user,
      // club)) und darf als Spieler suchen — also zählt er auch hier als
      // Spieler. Deckungsgleich mit der persönlichen Suche (/partner-finder).
      const { data: membershipRows } = await auth.supabase
        .from('user_club_memberships')
        .select('user_id')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .in('role', ['member', 'trainer', 'admin']);

      const memberIds = (membershipRows ?? []).map((m) => m.user_id);
      const totalMembers = memberIds.length;

      // Niveau-Verteilung über die spielenden Mitglieder. NULL / fehlende
      // Angabe wird als 'unbekannt' gebuckelt statt als 'beginner' — die
      // Übersicht soll ehrlich zeigen, wer noch nichts hinterlegt hat.
      //
      // Verwaiste Memberships (user_club_memberships.user_id hat keinen FK auf
      // users.id) werden als 'unbekannt' mitgezählt, damit die Summe der
      // Verteilung exakt totalMembers ergibt — sonst verschwinden sie still.
      const levelDistribution: Record<string, number> = {};
      const foundIds = new Set<string>();
      if (memberIds.length > 0) {
        const { data: users } = await auth.supabase
          .from('users')
          .select('id, skill_level')
          .in('id', memberIds);

        for (const u of users ?? []) {
          foundIds.add(u.id);
          const level = u.skill_level || 'unbekannt';
          levelDistribution[level] = (levelDistribution[level] ?? 0) + 1;
        }

        const orphanCount = memberIds.filter((id) => !foundIds.has(id)).length;
        if (orphanCount > 0) {
          levelDistribution['unbekannt'] = (levelDistribution['unbekannt'] ?? 0) + orphanCount;
        }
      }

      // Aktive Suchende = distinct Spieler, die ihre wöchentliche Verfügbarkeit
      // eingerichtet haben (mindestens ein Zeitfenster). Ohne diese Angabe
      // liefert die Suche keine Zeitfenster-Überschneidungen — die Zahl misst,
      // wie tragfähig das Matching im Verein aktuell ist.
      //
      // Zwei Fallen im alten Code: weekly_availability ist NOT NULL mit Default
      // (alle Tage leer) — ein `not(..., is, null)`-Filter matcht also JEDE
      // Zeile. Und `count: 'exact'` zählt Zeilen, aber user_training_preferences
      // hat eine Zeile pro (User, Saison). Korrekt: Verfügbarkeit laden, über
      // dieselbe availabilitySlots-Logik wie die Suche auf Nicht-Leere prüfen,
      // distinct user_id zählen (Saisons werden je User vereinigt).
      const activeSearcherIds = new Set<string>();
      if (memberIds.length > 0) {
        const { data: prefRows } = (await auth.supabase
          .from('user_training_preferences')
          .select('user_id, weekly_availability')
          .eq('club_id', clubId)
          .in('user_id', memberIds)) as {
          data: { user_id: string; weekly_availability: WeeklyAvailability | null }[] | null;
        };

        for (const row of prefRows ?? []) {
          if (availabilitySlots(row.weekly_availability).length > 0) {
            activeSearcherIds.add(row.user_id);
          }
        }
      }

      return NextResponse.json({
        totalMembers,
        activeSearchers: activeSearcherIds.size,
        levelDistribution,
      });
    } catch (error) {
      log.error('Partner-Finder-Stats error:', error);
      return internalErrorResponse();
    }
  });
}
