import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:user:export');

/**
 * Selbstauskunft nach Art. 15 DSGVO.
 *
 * Gibt einem angemeldeten Nutzer alle personenbezogenen Daten heraus, die zu
 * ihm gespeichert sind — auch die, die *über* ihn geführt werden (z. B.
 * Trainer-Notizen). Läuft über den Service-Client, weil RLS sonst genau die
 * Zeilen ausblendet, die der Nutzer laut Gesetz sehen darf.
 *
 * Die Vollständigkeit hängt an dieser Tabelle. Wer eine Tabelle mit
 * Personenbezug ergänzt, ergänzt sie hier — sonst ist die Auskunft
 * unvollständig und das fällt niemandem auf.
 */
const PERSONAL_DATA: ReadonlyArray<{ table: string; columns: string[]; label: string }> = [
  { table: 'user_club_memberships', columns: ['user_id'], label: 'Mitgliedschaften' },
  { table: 'bookings', columns: ['member_id'], label: 'Platzbuchungen' },
  { table: 'invoices', columns: ['member_id', 'trainer_id'], label: 'Rechnungen' },
  { table: 'invoice_installments', columns: ['member_id'], label: 'Ratenzahlungen' },
  { table: 'payments', columns: ['user_id'], label: 'Zahlungen' },
  { table: 'dunning_records', columns: ['member_id'], label: 'Mahnungen' },
  { table: 'sepa_mandates', columns: ['member_id'], label: 'SEPA-Mandate' },
  { table: 'member_balances', columns: ['member_id'], label: 'Guthabenkonto' },
  { table: 'user_training_preferences', columns: ['user_id'], label: 'Trainingswünsche' },
  { table: 'member_schedule_preferences', columns: ['user_id'], label: 'Zeitpräferenzen' },
  { table: 'session_rsvps', columns: ['member_id'], label: 'Trainings-Zu-/Absagen' },
  {
    table: 'attendance_records',
    columns: ['participant_id', 'trainer_id'],
    label: 'Anwesenheiten',
  },
  { table: 'hours_logs', columns: ['trainer_id'], label: 'Erfasste Trainerstunden' },
  { table: 'trainer_absences', columns: ['trainer_id'], label: 'Abwesenheiten' },
  { table: 'trainer_availability', columns: ['user_id'], label: 'Verfügbarkeiten' },
  { table: 'trainer_profiles', columns: ['trainer_id'], label: 'Trainerprofil' },
  { table: 'trainer_member_notes', columns: ['member_id'], label: 'Notizen über Sie' },
  { table: 'trainer_feedback', columns: ['member_id', 'trainer_id'], label: 'Feedback' },
  { table: 'season_waitlists', columns: ['member_id'], label: 'Wartelisten (Saison)' },
  { table: 'waitlist_entries', columns: ['user_id'], label: 'Wartelisten (Kurse)' },
  { table: 'work_duty_assignments', columns: ['member_id'], label: 'Arbeitsdienste' },
  { table: 'team_members', columns: ['member_id'], label: 'Mannschaften' },
  { table: 'league_players', columns: ['member_id'], label: 'Ligaspieler' },
  { table: 'open_match_participants', columns: ['user_id'], label: 'Offene Spiele' },
  { table: 'trial_trainings', columns: ['participant_id'], label: 'Probetrainings' },
  { table: 'shop_orders', columns: ['user_id'], label: 'Shop-Bestellungen' },
  { table: 'gamification_points', columns: ['user_id'], label: 'Punkte' },
  { table: 'family_accounts', columns: ['user_id'], label: 'Familienkonto' },
  { table: 'notifications', columns: ['user_id'], label: 'Benachrichtigungen' },
  { table: 'messages', columns: ['sender_id', 'receiver_id'], label: 'Nachrichten' },
  { table: 'news_comments', columns: ['user_id'], label: 'Kommentare' },
  { table: 'qr_checkins', columns: ['user_id'], label: 'Check-ins' },
  { table: 'push_subscriptions', columns: ['user_id'], label: 'Push-Anmeldungen' },
  { table: 'audit_logs', columns: ['actor_id'], label: 'Protokoll Ihrer Aktionen' },
];

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { user } = auth;
    const sb = createServiceClient();

    const daten: Record<string, unknown> = {};
    // Wenn eine Abfrage scheitert, darf das nicht als "keine Daten vorhanden"
    // durchgehen — eine unvollständige Auskunft ist ein Rechtsverstoß, kein
    // leeres Ergebnis. Deshalb steht der Fehler mit in der Antwort.
    const unvollstaendig: string[] = [];

    const { data: stammdaten } = await sb.from('users').select('*').eq('id', user.id).maybeSingle();

    // Die Tabellennamen stehen in PERSONAL_DATA als Text, damit die Liste
    // lesbar bleibt; der generierte Supabase-Typ verlangt hier ein Literal.
    const untyped = sb as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          or: (f: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    };

    for (const { table, columns, label } of PERSONAL_DATA) {
      const filter = columns.map((c) => `${c}.eq.${user.id}`).join(',');
      const { data, error } = await untyped.from(table).select('*').or(filter);
      if (error) {
        log.error(`Auskunft: ${table} nicht lesbar`, new Error(error.message));
        unvollstaendig.push(label);
        continue;
      }
      if (data && data.length > 0) daten[label] = data;
    }

    await logAudit({
      actorId: user.id,
      action: 'DSGVO_EXPORT',
      resourceType: 'user',
      resourceId: user.id,
      clubId: auth.clubId,
      details: { tabellen: Object.keys(daten).length },
      request,
    });

    log.info('DSGVO-Auskunft erstellt', { userId: user.id, tabellen: Object.keys(daten).length });

    const body = {
      hinweis:
        'Selbstauskunft nach Art. 15 DSGVO. Enthält alle personenbezogenen Daten, die zu Ihnen gespeichert sind.',
      erstelltAm: new Date().toISOString(),
      stammdaten,
      ...(unvollstaendig.length > 0
        ? {
            warnung: `Folgende Bereiche konnten nicht gelesen werden und fehlen in dieser Auskunft: ${unvollstaendig.join(', ')}. Bitte wenden Sie sich an den Support.`,
          }
        : {}),
      daten,
    };

    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="swingz-auskunft-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
