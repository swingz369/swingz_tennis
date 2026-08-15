import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:partner-finder');

interface MatchCandidate {
  userId: string;
  name: string;
  playingLevel: string;
  compatibilityScore: number;
  groupOverlap: string[];
  commonSessions: number;
  /** Übereinstimmende Wochenstunden — 0 heißt: einer von beiden hat nichts hinterlegt */
  sharedSlots: number;
  levelDiff: number;
  reasons: string[];
}

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WeeklyAvailability = Partial<
  Record<(typeof WEEKDAYS)[number], Array<{ start: string; end: string }>>
>;

/**
 * Zerlegt die hinterlegte Wochenverfügbarkeit in Stundenmarken ("monday-18").
 *
 * Stundenraster statt exakter Intervallschnitt: Tennis wird in Stunden gebucht, und
 * zwei Mengen zu schneiden ist billiger und leichter zu lesen als Intervallarithmetik.
 */
export function availabilitySlots(availability: WeeklyAvailability | null): string[] {
  if (!availability) return [];
  const slots: string[] = [];
  for (const day of WEEKDAYS) {
    for (const range of availability[day] ?? []) {
      const start = parseInt(range.start?.slice(0, 2) ?? '', 10);
      const end = parseInt(range.end?.slice(0, 2) ?? '', 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      for (let h = start; h < end; h++) slots.push(`${day}-${h}`);
    }
  }
  return slots;
}

/**
 * Spielpartner-Suche — deterministisches Scoring, kein Modell im Spiel
 * Multi-dimensional matching: Level + Gruppen + gemeinsame Sessions
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'No active membership' }, { status: 404 });
    }

    try {
      const supabase = auth.supabase;
      const clubId = auth.clubId;
      const userId = auth.user.id;

      // ── 1. Current user profile ──
      const { data: myProfile } = (await supabase
        .from('users')
        .select('skill_level')
        .eq('id', userId)
        .single()) as { data: { skill_level?: string | null } | null };

      const myLevel = myProfile?.skill_level || 'beginner';

      // ── 2. My group memberships ──
      const { data: myGroups } = (await supabase
        .from('groups')
        .select('id, name, level')
        .contains('member_ids', [userId])
        .eq('club_id', clubId)
        .eq('is_active', true)) as {
        data: { id: string; name: string; level: string | null }[] | null;
      };

      const myGroupIds = new Set(myGroups?.map((g) => g.id) ?? []);
      // Der frühere Bonus „Niveau der Gruppe passt zum Niveau des Kandidaten" ist
      // entfallen: er zählte dasselbe Signal ein zweites Mal, das Dimension 1 schon
      // bewertet, und verzerrte dadurch die Rangfolge.

      // ── 3. My recent session bookings (for common session overlap) ──
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: myBookings } = (await supabase
        .from('bookings')
        .select('session_id')
        .eq('member_id', userId)
        .gte('booked_at', thirtyDaysAgo)) as { data: { session_id?: string | null }[] | null };

      const mySessionIds = new Set(
        (myBookings ?? [])
          .map((b) => b.session_id)
          .filter((s): s is string => s !== null && s !== undefined)
      );

      // ── 4. Find candidates: active club members (excluding self) ──
      // Kein `users!inner(...)`-Embed: user_club_memberships.user_id hat keinen FK
      // auf users.id (nur deactivated_by), PostgREST würde den Embed sonst über
      // deactivated_by auflösen und aktive Mitglieder (deactivated_by = NULL) rausfiltern.
      const { data: membershipRows } = (await supabase
        .from('user_club_memberships')
        .select('user_id')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .neq('user_id', userId)) as { data: { user_id: string }[] | null };

      if (!membershipRows || membershipRows.length === 0) {
        return NextResponse.json({ matches: [] });
      }

      const allMemberIds = membershipRows.map((m) => m.user_id);

      const { data: candidateUsers } = await supabase
        .from('users')
        .select('id, full_name, skill_level') // ohne E-Mail: ging vorher an jedes Mitglied raus
        .in('id', allMemberIds);

      const candidateUserMap = new Map((candidateUsers ?? []).map((u) => [u.id, u]));
      const members = membershipRows.map((m) => ({
        user_id: m.user_id,
        users: candidateUserMap.get(m.user_id) ?? {
          full_name: null,
          skill_level: null,
        },
      }));

      // ── 5. Batch: Load ALL groups for this club ──
      const { data: allGroups } = (await supabase
        .from('groups')
        .select('id, name, level, member_ids')
        .eq('club_id', clubId)
        .eq('is_active', true)) as {
        data: { id: string; name: string; level: string | null; member_ids: string[] }[] | null;
      };

      // ── 6. Batch: Load common session attendance ──
      const { data: candidateBookings } = (await supabase
        .from('bookings')
        .select('member_id, session_id')
        .in('member_id', allMemberIds)
        .gte('booked_at', thirtyDaysAgo)) as {
        data: { member_id?: string | null; session_id?: string | null }[] | null;
      };

      // Build member -> session_ids map
      const memberSessionMap = new Map<string, Set<string>>();
      for (const b of candidateBookings ?? []) {
        if (!b.member_id || !b.session_id) continue;
        if (!memberSessionMap.has(b.member_id)) {
          memberSessionMap.set(b.member_id, new Set());
        }
        memberSessionMap.get(b.member_id)!.add(b.session_id);
      }

      // ── 6b. Wöchentliche Verfügbarkeit ──
      // Ohne diese Dimension schlug die Suche Partner vor, die nie zur selben Zeit
      // können — das häufigste Scheitern einer Verabredung und genau das, was die
      // Modulbeschreibung zusagt. Quelle ist dieselbe Angabe wie in der
      // Saisonplanung (user_training_preferences.weekly_availability).
      const { data: availabilityRows } = (await supabase
        .from('user_training_preferences')
        .select('user_id, weekly_availability')
        .eq('club_id', clubId)
        .in('user_id', [userId, ...allMemberIds])) as {
        data: { user_id: string; weekly_availability: WeeklyAvailability | null }[] | null;
      };

      // Mehrere Saisons pro Nutzer möglich — die Angaben werden vereinigt, weil eine
      // frühere Saison die Zeiten eines Mitglieds nicht weniger wahr macht.
      const availabilityByUser = new Map<string, Set<string>>();
      for (const row of availabilityRows ?? []) {
        const existing = availabilityByUser.get(row.user_id) ?? new Set<string>();
        for (const slot of availabilitySlots(row.weekly_availability)) existing.add(slot);
        availabilityByUser.set(row.user_id, existing);
      }
      const mySlots = availabilityByUser.get(userId) ?? new Set<string>();

      // ── 7. Scoring ──
      const levelOrder = [
        'beginner',
        'advanced_beginner',
        'intermediate',
        'advanced',
        'tournament',
      ];
      // Unbekannte Werte (NULL oder ein Wert außerhalb der Liste) ergaben mit
      // indexOf() eine -1 und damit einen Niveau-Abstand von bis zu 5 — der
      // Betroffene fiel dann grundlos unter die Schwelle. Jetzt gilt „Anfänger".
      const levelIndexOf = (level: string | null | undefined): number => {
        const idx = levelOrder.indexOf(level ?? '');
        return idx === -1 ? 0 : idx;
      };
      const myLevelIdx = levelIndexOf(myLevel);

      const matches: MatchCandidate[] = [];

      for (const m of members) {
        const memberId = m.user_id;
        const memberLevel = m.users?.skill_level || 'beginner';
        const memberLevelIdx = levelIndexOf(memberLevel);
        const levelDiff = Math.abs(myLevelIdx - memberLevelIdx);

        // ═══ Score Dimension 1: Level (0-40 points) ═══
        const levelScore = Math.max(0, 40 - levelDiff * 10);

        // ═══ Score Dimension 2: Group overlap (0-30 points) ═══
        const groupOverlap: string[] = [];
        let groupScore = 0;

        if (allGroups) {
          for (const group of allGroups) {
            const memberIds = Array.isArray(group.member_ids) ? group.member_ids : [];
            const isMyGroup = myGroupIds.has(group.id);
            const isTheirGroup = memberIds.includes(memberId);

            if (isMyGroup && isTheirGroup) {
              groupOverlap.push(group.name);
            }
          }
        }
        // Gewicht halbiert (vorher 15 je Gruppe, max 30): gemeinsame Gruppen und
        // gemeinsame Einheiten heißen „ihr spielt bereits miteinander". Sie machten
        // zusammen 50 der 100 Punkte aus, wodurch die Suche vor allem Leute nach
        // oben spülte, die man ohnehin jede Woche trifft — für eine Partnersuche
        // das Gegenteil des Zwecks.
        groupScore = Math.min(15, groupOverlap.length * 8);

        // ═══ Score Dimension 3: Common sessions (0-15 points) ═══
        const theirSessions = memberSessionMap.get(memberId) ?? new Set();
        let commonSessions = 0;
        for (const sid of mySessionIds) {
          if (theirSessions.has(sid)) commonSessions++;
        }
        const sessionScore = Math.min(15, commonSessions * 8);

        // ═══ Score Dimension 4: Verfügbarkeit (0-30 Punkte) ═══
        const theirSlots = availabilityByUser.get(memberId) ?? new Set<string>();
        let sharedSlots = 0;
        for (const slot of mySlots) if (theirSlots.has(slot)) sharedSlots++;
        // Wer keine Zeiten hinterlegt hat, wird nicht bestraft (0 Punkte) — sonst
        // verschwinden neue Mitglieder aus der Suche, bevor sie etwas ausfüllen.
        const bothDeclared = mySlots.size > 0 && theirSlots.size > 0;
        const availabilityScore = Math.min(30, sharedSlots * 6);

        const totalScore = levelScore + groupScore + sessionScore + availabilityScore;

        // Build reasons
        const reasons: string[] = [];
        if (levelDiff === 0) reasons.push('Gleiches Spielniveau');
        else if (levelDiff <= 1) reasons.push('Ähnliches Spielniveau');
        if (sharedSlots > 0) reasons.push(`${sharedSlots} gemeinsame Zeitfenster pro Woche`);
        else if (!bothDeclared) reasons.push('Zeiten noch nicht hinterlegt');
        if (groupOverlap.length > 0) reasons.push(`${groupOverlap.length} gemeinsame Gruppe(n)`);
        if (commonSessions > 0) reasons.push(`${commonSessions} gemeinsame Trainingseinheit(en)`);
        if (reasons.length === 0) reasons.push('Im gleichen Verein');

        // Haben beide Seiten ihre Zeiten hinterlegt und überschneidet sich keine
        // einzige, ist ein Spiel nicht verabredbar — solche Treffer wären eine
        // Enttäuschung mit hohem Punktestand.
        if (bothDeclared && sharedSlots === 0) continue;

        if (totalScore >= 40) {
          matches.push({
            userId: memberId,
            name: m.users?.full_name || 'Unbekannt',
            playingLevel: memberLevel,
            compatibilityScore: Math.min(100, totalScore),
            groupOverlap,
            commonSessions,
            sharedSlots,
            levelDiff,
            reasons,
          });
        }
      }

      // Sort by score descending
      matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

      return NextResponse.json({
        matches: matches.slice(0, 10),
        totalMembers: members.length,
        myLevel,
      });
    } catch (error) {
      log.error('Partner-Finder error:', error);
      return internalErrorResponse();
    }
  });
}
