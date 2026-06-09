/**
 * Trainer type definitions for the admin trainers list + detail views.
 *
 * Mirrors the shape of `app/(protected)/admin/members/member.types.ts` so the
 * table UX is consistent across the two admin pages.
 *
 * Source: rows from the `trainer_profiles` table joined with `users` for
 *         name + email.
 */
export interface Trainer {
  /** trainer_profiles.id (also serves as the route param for /admin/trainers/[id]) */
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'inactive';
  /** Specializations as plain strings (e.g. "Cardio", "Tennis", "Erwachsene") */
  specialties: string[];
  /** EUR/h, may be null if rate comes from a rate tier */
  hourly_rate: number | null;
  max_hours_per_week: number;
  created_at: string;
}
