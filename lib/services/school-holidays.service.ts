import type { SupabaseClient } from '@supabase/supabase-js';

export interface SchoolHoliday {
  name: string;
  start_date: string;
  end_date: string;
}

/**
 * Minimal typed shape for the supabase queries used here.
 * The generated `Database` type does not include the `school_holidays`
 * table, so we declare a narrow local interface instead of `any`.
 */
interface ClubRow {
  bundesland: string | null;
}

interface SchoolHolidayRow {
  name: string;
  start_date: string;
  end_date: string;
}

interface SessionRow {
  id: string;
  timeslot_start: string;
}

interface MinimalSupabaseClient {
  from(table: 'clubs'): {
    select(cols: 'bundesland'): {
      eq(
        col: 'id',
        val: string
      ): {
        single(): Promise<{ data: ClubRow | null; error: { message: string } | null }>;
      };
    };
  };
  from(table: 'school_holidays'): {
    select(cols: 'name, start_date, end_date'): {
      eq(
        col: 'bundesland',
        val: string
      ): {
        eq(
          col: 'year',
          val: number
        ): Promise<{
          data: SchoolHolidayRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  from(table: 'sessions'): {
    select(cols: 'id, timeslot_start'): {
      eq(
        col: 'schedule_id',
        val: string
      ): {
        eq(
          col: 'status',
          val: string
        ): Promise<{
          data: SessionRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
    update(values: { status: string }): {
      in(col: 'id', vals: string[]): Promise<{ error: { message: string } | null }>;
    };
  };
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
  const client = supabase as unknown as MinimalSupabaseClient;

  const { data: club, error: clubErr } = await client
    .from('clubs')
    .select('bundesland')
    .eq('id', clubId)
    .single();
  if (clubErr) throw new Error(`Failed to load club: ${clubErr.message}`);
  if (!club?.bundesland) return [];

  const { data, error } = await client
    .from('school_holidays')
    .select('name, start_date, end_date')
    .eq('bundesland', club.bundesland)
    .eq('year', year);
  if (error) throw new Error(`Failed to load holidays: ${error.message}`);
  return data ?? [];
}

export async function markHolidaySessions(
  supabase: SupabaseClient,
  scheduleId: string,
  clubId: string
): Promise<number> {
  const client = supabase as unknown as MinimalSupabaseClient;

  const { data: sessions, error: sessErr } = await client
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
    .filter((s) => isSessionInHoliday(new Date(s.timeslot_start), holidays))
    .map((s) => s.id);

  if (!holidayIds.length) return 0;

  const { error } = await client
    .from('sessions')
    .update({ status: 'holiday_cancelled' })
    .in('id', holidayIds);
  if (error) throw new Error(`Failed to mark sessions: ${error.message}`);
  return holidayIds.length;
}
