import { createClient } from '@/lib/supabase/server';
import type { GroupChangeParams, GroupChangeCreditResult } from '@/lib/types/billing.types';
import { getOrCreateMemberBalance, addBalanceEntry } from './member-balance.service';

interface SessionRow {
  id: string;
  timeslot_start: string;
  timeslot_end: string;
  schedule_id: string | null;
  court_id: string | null;
}

/** Mitglied in den Planeinträgen einer Gruppe eintragen bzw. austragen. */
async function moveParticipant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: GroupChangeParams,
  groupId: string,
  mode: 'add' | 'remove'
): Promise<void> {
  const { data: entries, error } = await supabase
    .from('season_plan_entries')
    .select('id, expected_participants')
    .eq('season_id', params.season_id)
    .eq('club_id', params.club_id)
    .eq('group_id', groupId);
  if (error) throw new Error(`Failed to load plan entries: ${error.message}`);

  for (const entry of (entries ?? []) as {
    id: string;
    expected_participants: unknown;
  }[]) {
    const current = Array.isArray(entry.expected_participants)
      ? (entry.expected_participants as string[])
      : [];
    const next =
      mode === 'remove'
        ? current.filter((id) => id !== params.member_id)
        : current.includes(params.member_id)
          ? current
          : [...current, params.member_id];
    if (next.length === current.length) continue; // nichts zu tun

    const { error: updErr } = await supabase
      .from('season_plan_entries')
      .update({ expected_participants: next })
      .eq('id', entry.id);
    if (updErr) throw new Error(`Failed to update plan entry: ${updErr.message}`);
  }
}

export async function processGroupChange(
  params: GroupChangeParams
): Promise<GroupChangeCreditResult> {
  const supabase = await createClient();

  const loadSessions = async (groupId: string) => {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, timeslot_start, timeslot_end, schedule_id, court_id')
      // `sessions.group_ids` ist jsonb: supabase-js serialisiert ein JS-Array als
      // Postgres-Array-Literal (`{uuid}`), was Postgres hier mit
      // "invalid input syntax for type json" quittiert — der Gruppenwechsel
      // scheiterte dadurch bei jedem Aufruf mit 500. Deshalb JSON-Text übergeben.
      .contains('group_ids', JSON.stringify([groupId]))
      .gt('timeslot_start', params.change_date)
      .not('status', 'in', '("holiday_cancelled","cancelled")');
    if (error) throw new Error(`Failed to load sessions for group ${groupId}: ${error.message}`);
    return (data ?? []) as SessionRow[];
  };

  const oldSessions = await loadSessions(params.old_group_id);
  const newSessions = await loadSessions(params.new_group_id);

  // Load member's fee config
  const { data: membership, error: memberErr } = await supabase
    .from('user_club_memberships')
    .select('fee_configuration_id, fee_configurations(amount, billing_unit_count)')
    .eq('user_id', params.member_id)
    .eq('club_id', params.club_id)
    .eq('is_active', true)
    .maybeSingle();
  if (memberErr) throw new Error(`Failed to load membership: ${memberErr.message}`);

  const feeConfig = membership?.fee_configurations;
  const pricePerUnit: number = feeConfig?.amount ?? 0;
  const billingUnitsPerSession: number = feeConfig?.billing_unit_count ?? 1;

  const calcAmount = (sessions: unknown[]): number =>
    sessions.length * pricePerUnit * billingUnitsPerSession;

  const credit_amount = calcAmount(oldSessions);
  const charge_amount = calcAmount(newSessions);
  const net_delta = credit_amount - charge_amount;

  // ── Gruppenzugehörigkeit umhängen ────────────────────────────────────────
  // Verbindlich ist `season_plan_entries.expected_participants` — daran hängen
  // Abrechnungsvorschau, Mitglieder-Ansicht und die Teilnehmerlisten. Die
  // frühere Fassung schrieb stattdessen in `training_group_memberships`, eine
  // Tabelle ohne eine einzige Zeile: Der Wechsel meldete Erfolg, im Plan änderte
  // sich nichts (behoben am 16.08.2026).
  await moveParticipant(supabase, params, params.old_group_id, 'remove');
  await moveParticipant(supabase, params, params.new_group_id, 'add');

  // Buchungen ab dem Wechseldatum mitziehen — sonst steht das Mitglied weiter
  // in den Trainings der alten Gruppe und in keinem der neuen.
  const oldSessionIds = oldSessions.map((s) => s.id);
  if (oldSessionIds.length > 0) {
    const { error: delErr } = await supabase
      .from('bookings')
      .delete()
      .eq('member_id', params.member_id)
      .in('session_id', oldSessionIds);
    if (delErr) throw new Error(`Failed to remove old bookings: ${delErr.message}`);
  }

  // `bookings.court_id` ist NOT NULL — Sessions ohne Platz bekommen keine
  // Buchung (gleiche Regel wie beim Veröffentlichen der Saison).
  const newBookings = newSessions
    .filter((s) => s.court_id && s.schedule_id)
    .map((s) => ({
      club_id: params.club_id,
      member_id: params.member_id,
      schedule_id: s.schedule_id as string,
      session_id: s.id,
      court_id: s.court_id as string,
      status: 'confirmed',
      booking_type: 'session',
      is_recurring: true,
      session_start_time: s.timeslot_start,
      start_time: s.timeslot_start,
      end_time: s.timeslot_end,
      notes: 'Erstellt durch Gruppenwechsel',
    }));
  if (newBookings.length > 0) {
    const { error: insErr } = await supabase.from('bookings').insert(newBookings);
    if (insErr) throw new Error(`Failed to create new bookings: ${insErr.message}`);
  }

  // Update balance
  const balance = await getOrCreateMemberBalance(supabase, params.member_id, params.club_id);

  if (credit_amount > 0) {
    await addBalanceEntry(supabase, {
      member_balance_id: balance.id,
      amount: credit_amount,
      reason: `Gutschrift Gruppenwechsel (Austritt)`,
      reference_type: 'group_change',
      created_by: params.created_by,
    });
  }
  if (charge_amount > 0) {
    await addBalanceEntry(supabase, {
      member_balance_id: balance.id,
      amount: -charge_amount,
      reason: `Belastung Gruppenwechsel (Eintritt)`,
      reference_type: 'group_change',
      created_by: params.created_by,
    });
  }

  // Re-fetch balance after entries to get the current value from DB
  const { getMemberBalance } = await import('./member-balance.service');
  const updatedBalance = await getMemberBalance(supabase, params.member_id, params.club_id);
  const new_balance = updatedBalance?.balance ?? balance.balance + net_delta;
  return { credit_amount, charge_amount, net_delta, new_balance };
}
