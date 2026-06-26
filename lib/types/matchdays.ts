/**
 * lib/types/matchdays.ts — Zod-Schemas für Matchday-Body-Validation
 *
 * Wave-1 F-Plan Cast-Cleanup: ersetzt die historischen `(body) as {...}` Casts
 * in api/leagues/[id]/matchdays/** durch echte Runtime-Validation.
 * Source-Pattern: lib/types/billing.ts (gleiche Architektur: zentrales
 * Modul mit Schemas + z.infer-Typen fuer Routen-Inputs).
 *
 * Akzeptierte Werte basieren auf den Supabase-DB-Constraints (siehe
 * types/supabase.ts Row-Definitionen fuer `match_days`, `match_results`).
 */
import { z } from 'zod';

// === Enums (müssen mit Supabase CHECK-Constraints uebereinstimmen) ===

/** Position-Typ in einer Aufstellung (Einzel/Doppel) */
export const PositionTypeSchema = z.enum(['singles', 'doubles']);
export type PositionType = z.infer<typeof PositionTypeSchema>;

/** Match-Outcome pro Position (Einzel/Doppel-Ergebnis) — values match the
 *  Postgres enum `public.match_outcome` from migration 20260624_match_results.sql.
 *  'walkover' replaces the earlier (incorrect) 'draw' value because Tennis
 *  is best-of-3 with tiebreak — a draw is impossible at match level. */
export const MatchOutcomeSchema = z.enum(['not_played', 'home_won', 'away_won', 'walkover']);
export type MatchOutcome = z.infer<typeof MatchOutcomeSchema>;

/** Aggregiertes Spieltag-Ergebnis (Heim vs. Auswaerts) */
export const AggregatedResultSchema = z.enum(['win', 'loss', 'draw']);
export type AggregatedResult = z.infer<typeof AggregatedResultSchema>;

/** Spieltag-Status (offen / laufend / abgeschlossen / abgesagt) */
export const MatchdayStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
export type MatchdayStatus = z.infer<typeof MatchdayStatusSchema>;

// === API-Body-Schemas ===

/**
 * Body-Schema fuer PATCH /api/leagues/[id]/matchdays/[matchdayId]
 * Aktualisiert einen Spieltag (z.B. Score-Update, Status-Aenderung).
 * Alle Felder optional — PATCH = partial update.
 */
export const MatchdayUpdateSchema = z
  .object({
    scheduled_date: z.string().nullable().optional(),
    opponent: z.string().min(1).optional(),
    is_home: z.boolean().optional(),
    score_home: z.number().int().nullable().optional(),
    score_away: z.number().int().nullable().optional(),
    result: AggregatedResultSchema.nullable().optional(),
    status: MatchdayStatusSchema.optional(),
    venue: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();
export type MatchdayUpdate = z.infer<typeof MatchdayUpdateSchema>;

/**
 * Body-Schema fuer POST /api/leagues/[id]/matchdays
 * Erstellt einen neuen Spieltag (Liga-Admin).
 * `matchday_number` + `opponent` sind Pflicht (siehe Route-Validation).
 */
export const MatchdayCreateSchema = z
  .object({
    matchday_number: z.number().int().min(1),
    opponent: z.string().min(1),
    scheduled_date: z.string().nullable().optional(),
    is_home: z.boolean().optional(),
    venue: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();
export type MatchdayCreate = z.infer<typeof MatchdayCreateSchema>;

/**
 * Body-Schema fuer POST /api/leagues/[id]/matchdays/[matchdayId]/lineup
 * Speichert eine Aufstellung (upsert per position_number Position).
 * Defensive Validation: positions-Array darf nicht leer sein.
 */
export const LineupPositionsSchema = z
  .object({
    positions: z
      .array(
        z.object({
          position_number: z.number().int().min(1),
          position_type: PositionTypeSchema,
          home_player_ids: z.array(z.string().uuid()),
          away_player_ids: z.array(z.string().uuid()),
        })
      )
      .min(1, 'positions erforderlich'),
  })
  .strict();
export type LineupPositions = z.infer<typeof LineupPositionsSchema>;
export type LineupPosition = LineupPositions['positions'][number];

/**
 * Body-Schema fuer PATCH /api/leagues/[id]/matchdays/[matchdayId]/result
 * Traegt das Ergebnis fuer eine Position ein. `position_number` + `outcome` Pflicht.
 */
export const ResultUpdateSchema = z
  .object({
    position_number: z.number().int().min(1),
    home_sets_won: z.number().int().min(0).default(0),
    away_sets_won: z.number().int().min(0).default(0),
    set_scores: z.unknown().nullable().optional(),
    outcome: MatchOutcomeSchema,
    notes: z.string().nullable().optional(),
  })
  .strict();
export type ResultUpdate = z.infer<typeof ResultUpdateSchema>;
