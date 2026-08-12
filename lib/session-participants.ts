/**
 * Teilnehmer einer Trainingseinheit — die eine Stelle, an der aus einer Session
 * eine Teilnehmerliste wird.
 *
 * Warum es diesen Helfer gibt: „Wer ist in diesem Training?" existierte im Projekt
 * in vier Repräsentationen — `season_plan_entries.expected_participants` (Absicht
 * des Plans), `bookings` (was beim Veröffentlichen tatsächlich entsteht),
 * `session_rsvps` (ausdrückliche Zu-/Absage) und `training_group_memberships`
 * (manuelle Gruppenpflege, ohne Oberfläche). Jede Ansicht las eine andere davon,
 * weshalb die Traineransicht „0 zugesagt" für eine Gruppe mit sechs zugeteilten
 * Mitgliedern zeigte, während die Abrechnung sie berechnete.
 *
 * Verbindlich ist die **Buchung**: Wer eingeteilt ist, gilt als zugesagt; eine
 * stornierte Buchung (Abmeldung) als abgesagt. Eine ausdrückliche RSVP-Zeile
 * überschreibt beides. Neue Leser rufen diese Funktion auf, statt eine der
 * Tabellen erneut selbst auszuwerten.
 */

export type SessionParticipant = {
  id: string;
  sessionId: string;
  memberId: string;
  status: string;
  respondedAt: string | null;
  notes?: string;
  user: { fullName: string };
};

type BookingRow = { id: string; member_id: string; status: string };
type RsvpRow = {
  id: string;
  member_id: string;
  status: string;
  responded_at: string | null;
  notes?: string;
};

// Der Aufrufer reicht seinen bereits authentifizierten Supabase-Client durch;
// die Sichtbarkeit richtet sich damit weiterhin nach dessen RLS-Kontext.
type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>;
      in: (column: string, values: string[]) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

export async function getSessionParticipants(
  supabase: SupabaseLike,
  sessionId: string
): Promise<SessionParticipant[]> {
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select('id, member_id, status')
    .eq('session_id', sessionId);
  if (bookingError) throw bookingError;

  const { data: rsvpData, error: rsvpError } = await supabase
    .from('session_rsvps')
    .select('id, session_id, member_id, status, responded_at, notes, created_at')
    .eq('session_id', sessionId);
  if (rsvpError) throw rsvpError;

  const bookings = (bookingData ?? []) as BookingRow[];
  const rsvps = (rsvpData ?? []) as RsvpRow[];

  const memberIds = [
    ...new Set([...bookings.map((b) => b.member_id), ...rsvps.map((r) => r.member_id)]),
  ].filter(Boolean);

  const { data: userData } = memberIds.length
    ? await supabase.from('users').select('id, full_name').in('id', memberIds)
    : { data: [] };
  const names = Object.fromEntries(
    ((userData ?? []) as { id: string; full_name: string | null }[]).map((u) => [
      u.id,
      u.full_name ?? 'Mitglied',
    ])
  );

  const explicit = new Map(rsvps.map((r) => [r.member_id, r]));

  // Feldnamen in camelCase — genau so liest sie components/trainer-rsvp-list.tsx.
  return memberIds.map((memberId) => {
    const own = explicit.get(memberId);
    const booking = bookings.find((b) => b.member_id === memberId);

    return {
      id: own?.id ?? booking?.id ?? memberId,
      sessionId,
      memberId,
      status: own?.status ?? (booking?.status === 'cancelled' ? 'declined' : 'accepted'),
      respondedAt: own?.responded_at ?? null,
      notes: own?.notes,
      user: { fullName: names[memberId] ?? 'Mitglied' },
    };
  });
}
