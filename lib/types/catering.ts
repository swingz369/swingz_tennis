import { z } from 'zod';

export const CATERING_STATUSES = ['not_planned', 'planned', 'ready'] as const;
export type CateringStatus = (typeof CATERING_STATUSES)[number];

export const UpdateCateringSchema = z.object({
  status: z.enum(CATERING_STATUSES).optional(),
  organizer_name: z.string().max(100).nullable().optional(),
  expected_guests: z.number().int().min(0).max(9999).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export interface MatchCatering {
  id: string;
  match_day_id: string;
  club_id: string;
  status: CateringStatus;
  organizer_name: string | null;
  expected_guests: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_LABELS: Record<CateringStatus, string> = {
  not_planned: 'Nicht geplant',
  planned: 'Geplant',
  ready: 'Bereit',
};
