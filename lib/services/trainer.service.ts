/**
 * Trainer Availability Service
 * Manages trainer schedules, absences, and assignments
 */

import { createClient } from '@/lib/supabase/server';
import type {
  TrainerAvailability,
  TrainerAbsence,
  TrainerAssignment,
  AvailableTrainer,
  TrainerWithDetails,
} from '@/lib/types/trainer';

/**
 * Get trainer's weekly availability
 */
export async function getTrainerAvailability(
  userId: string,
  clubId: string
): Promise<TrainerAvailability[]> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('trainer_availability')
    .select('*')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching trainer availability:', error);
    return [];
  }

  return (data as any) || [];
}

/**
 * Set trainer availability for a specific day/time
 */
export async function setTrainerAvailability(
  availability: Omit<TrainerAvailability, 'id' | 'created_at' | 'updated_at'>
): Promise<TrainerAvailability | null> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('trainer_availability')
    .upsert(
      {
        ...availability,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,club_id,day_of_week,start_time,end_time',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error setting trainer availability:', error);
    return null;
  }

  return data as any;
}

/**
 * Delete trainer availability
 */
export async function deleteTrainerAvailability(id: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase.from('trainer_availability').delete().eq('id', id);

  if (error) {
    console.error('Error deleting trainer availability:', error);
    return false;
  }

  return true;
}

/**
 * Get trainer absences
 */
export async function getTrainerAbsences(
  userId: string,
  clubId: string,
  futureOnly = true
): Promise<TrainerAbsence[]> {
  const supabase = await createClient();

  let query = (supabase as any)
    .from('trainer_absences')
    .select('*')
    .eq('user_id', userId)
    .eq('club_id', clubId);

  if (futureOnly) {
    query = query.gte('end_date', new Date().toISOString().split('T')[0]);
  }

  const { data, error } = await query.order('start_date', { ascending: true });

  if (error) {
    console.error('Error fetching trainer absences:', error);
    return [];
  }

  return (data as any) || [];
}

/**
 * Create trainer absence
 */
export async function createTrainerAbsence(
  absence: Omit<TrainerAbsence, 'id' | 'created_at' | 'updated_at'>
): Promise<TrainerAbsence | null> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('trainer_absences')
    .insert(absence)
    .select()
    .single();

  if (error) {
    console.error('Error creating trainer absence:', error);
    return null;
  }

  return data as any;
}

/**
 * Update trainer absence
 */
export async function updateTrainerAbsence(
  id: string,
  updates: Partial<TrainerAbsence>
): Promise<TrainerAbsence | null> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('trainer_absences')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating trainer absence:', error);
    return null;
  }

  return data as any;
}

/**
 * Delete trainer absence
 */
export async function deleteTrainerAbsence(id: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await (supabase as any).from('trainer_absences').delete().eq('id', id);

  if (error) {
    console.error('Error deleting trainer absence:', error);
    return false;
  }

  return true;
}

/**
 * Get trainer assignment for a club
 */
export async function getTrainerAssignment(
  userId: string,
  clubId: string
): Promise<TrainerAssignment | null> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('trainer_assignments')
    .select('*')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching trainer assignment:', error);
    return null;
  }

  return data as any;
}

/**
 * Get all trainers for a club
 */
export async function getClubTrainers(clubId: string): Promise<TrainerWithDetails[]> {
  const supabase = await createClient();

  const { data: assignments, error } = await (supabase as any)
    .from('trainer_assignments')
    .select(
      `
      *,
      users!inner(id, full_name, email, avatar_url)
    `
    )
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('users(full_name)', { ascending: true });

  if (error) {
    console.error('Error fetching club trainers:', error);
    return [];
  }

  if (!assignments) return [];

  // Fetch availability and absences for each trainer
  const trainersWithDetails = await Promise.all(
    assignments.map(async (assignment: any) => {
      const availability = await getTrainerAvailability(assignment.user_id, clubId);
      const upcoming_absences = await getTrainerAbsences(assignment.user_id, clubId, true);

      return {
        ...assignment,
        full_name: assignment.users.full_name,
        email: assignment.users.email,
        avatar_url: assignment.users.avatar_url,
        availability,
        upcoming_absences,
      };
    })
  );

  return trainersWithDetails;
}

/**
 * Check if trainer is available at specific date/time
 */
export async function isTrainerAvailable(
  userId: string,
  clubId: string,
  datetime: Date
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any).rpc('is_trainer_available', {
    p_user_id: userId,
    p_club_id: clubId,
    p_datetime: datetime.toISOString(),
  });

  if (error) {
    console.error('Error checking trainer availability:', error);
    return false;
  }

  return data === true || data === 1;
}

/**
 * Get available trainers for a specific date/time
 */
export async function getAvailableTrainers(
  clubId: string,
  datetime: Date
): Promise<AvailableTrainer[]> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any).rpc('get_available_trainers', {
    p_club_id: clubId,
    p_datetime: datetime.toISOString(),
  });

  if (error) {
    console.error('Error fetching available trainers:', error);
    return [];
  }

  return (data as any) || [];
}

/**
 * Update trainer assignment
 */
export async function updateTrainerAssignment(
  userId: string,
  clubId: string,
  updates: Partial<TrainerAssignment>
): Promise<TrainerAssignment | null> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from('trainer_assignments')
    .upsert(
      {
        user_id: userId,
        club_id: clubId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,club_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error updating trainer assignment:', error);
    return null;
  }

  return data as any;
}
