import { z } from 'zod';

export const CourtSurfaceType = z.enum(['clay', 'hard', 'grass', 'carpet', 'artificial_grass']);
export type CourtSurfaceType = z.infer<typeof CourtSurfaceType>;

export const CourtStatus = z.enum(['available', 'maintenance', 'closed', 'reserved']);
export type CourtStatus = z.infer<typeof CourtStatus>;

// Tabelle `court_types` — fast alle Spalten sind nullable.
export const CourtTypeSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid().nullable(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  surface_type: z.string().nullable(),
  is_indoor: z.boolean().nullable(),
  is_outdoor: z.boolean().nullable(),
  requires_lighting: z.boolean().nullable(),
  max_players: z.number().int().nullable(),
  hourly_rate: z.number().nullable(),
  is_active: z.boolean().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type CourtType = z.infer<typeof CourtTypeSchema>;

export const CourtSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  court_type_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  number: z.number().int().positive(),
  surface: CourtSurfaceType.optional(),
  location: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  status: CourtStatus,
  has_lighting: z.boolean(),
  lighting_hours_start: z.string().nullable().optional(),
  lighting_hours_end: z.string().nullable().optional(),
  is_active: z.boolean(),
  usable_for_training: z.boolean().default(true),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export type Court = z.infer<typeof CourtSchema>;

export const CreateCourtTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  surface_type: CourtSurfaceType,
  is_indoor: z.boolean(),
  is_outdoor: z.boolean(),
  requires_lighting: z.boolean(),
  max_players: z.number().int().positive().default(4),
  hourly_rate: z.number().nonnegative(),
});

export type CreateCourtType = z.infer<typeof CreateCourtTypeSchema>;
