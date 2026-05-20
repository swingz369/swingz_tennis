import type { SupabaseClient } from '@supabase/supabase-js';

export interface SchoolHoliday {
  name: string;
  start_date: string;
  end_date: string;
}

export function isSessionInHoliday(sessionDate: Date, holidays: SchoolHoliday[]): boolean {
  const d = sessionDate.getTime();
  return holidays.some((h) => {
    const start = new Date(h.start_date).getTime();
    const end = new Date(h.end_date).getTime();
    return d >= start && d <= end;
  });
}

export async function getHolidaysForClub(
  supabase: SupabaseClient,
  clubId: string,
  year: number
): Promise<SchoolHoliday[]> {
  const { data: club, error: clubErr } = await (supabase as any)
    .from('clubs')
    .select('bundesland')
    .eq('id', clubId)
    .single();
  if (clubErr) throw new Error(`Failed to load club: ${clubErr.message}`);
  if (!club?.bundesland) return [];

  const { data, error } = await (supabase as any)
    .from('school_holidays')
    .select('name, start_date, end_date')
    .eq('bundesland', club.bundesland)
    .eq('year', year);
  if (error) throw new Error(`Failed to load holidays: ${error.message}`);
  return (data as SchoolHoliday[]) ?? [];
}

export async function markHolidaySessions(
  supabase: SupabaseClient,
  scheduleId: string,
  clubId: string
): Promise<number> {
  const { data: sessions, error: sessErr } = await (supabase as any)
    .from('sessions')
    .select('id, timeslot_start')
    .eq('schedule_id', scheduleId)
    .eq('status', 'scheduled');
  if (sessErr) throw new Error(`Failed to load sessions: ${sessErr.message}`);
  if (!sessions?.length) return 0;

  const year = new Date(sessions[0].timeslot_start).getFullYear();
  const holidays = await getHolidaysForClub(supabase, clubId, year);
  if (!holidays.length) return 0;

  const holidayIds: string[] = sessions
    .filter((s: any) => isSessionInHoliday(new Date(s.timeslot_start), holidays))
    .map((s: any) => s.id);

  if (!holidayIds.length) return 0;

  const { error } = await (supabase as any)
    .from('sessions')
    .update({ status: 'holiday_cancelled' })
    .in('id', holidayIds);
  if (error) throw new Error(`Failed to mark sessions: ${error.message}`);
  return holidayIds.length;
}
