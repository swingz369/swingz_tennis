-- ============================================================================
-- Migration: 20260627_season_group_weeks.sql
--
-- Adds the `season_group_weeks` table that tracks per-group per-week
-- active/inactive status for a season. The admin can toggle each cell
-- in the Season Calendar UI (Sep-Jul KW grid) and the value drives
-- both session-creation filtering AND billing (inactive weeks reduce
-- `totalSessions` counted in `season-billing.service.ts`).
--
-- Columns:
--   • club_id         — tenant scope (matches season.club_id)
--   • group_id        — FK → groups.id
--   • season_id       — FK → seasons.id
--   • week_monday     — ISO date of the Monday (YYYY-MM-DD)
--   • week_number     — ISO 8601 calendar-week number (1-53)
--   • is_active       — boolean, defaults to true
--   • reason          — optional free-text justification
--   • created_at / updated_at — timestamps
--
-- Indexes:
--   • UNIQUE (season_id, group_id, week_monday) — one row per cell
--   • (season_id) — fast lookup for billing preview
--   • (club_id, week_monday) — tenant-scoped calendar queries
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.season_group_weeks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  group_id      uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  season_id     uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  week_monday   date NOT NULL,
  week_number   integer NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  is_active     boolean NOT NULL DEFAULT true,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- One row per (season, group, week) — prevents accidental duplicates
  CONSTRAINT season_group_weeks_unique_cell UNIQUE (season_id, group_id, week_monday)
);

-- Indexes for the hot read paths
CREATE INDEX IF NOT EXISTS idx_season_group_weeks_season
  ON public.season_group_weeks (season_id);

CREATE INDEX IF NOT EXISTS idx_season_group_weeks_club_week
  ON public.season_group_weeks (club_id, week_monday);

CREATE INDEX IF NOT EXISTS idx_season_group_weeks_group
  ON public.season_group_weeks (group_id, is_active);

-- Auto-update updated_at on row mutation
CREATE OR REPLACE FUNCTION public.season_group_weeks_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_season_group_weeks_updated_at ON public.season_group_weeks;
CREATE TRIGGER trg_season_group_weeks_updated_at
  BEFORE UPDATE ON public.season_group_weeks
  FOR EACH ROW
  EXECUTE FUNCTION public.season_group_weeks_set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.season_group_weeks ENABLE ROW LEVEL SECURITY;

-- Admins/superadmins: full CRUD on their club's rows
DROP POLICY IF EXISTS "season_group_weeks_admin_all" ON public.season_group_weeks;
CREATE POLICY "season_group_weeks_admin_all"
  ON public.season_group_weeks
  FOR ALL
  TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'superadmin')
        AND cm.is_active = true
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'superadmin')
        AND cm.is_active = true
    )
  );

-- Members: read-only access to their own club's calendar (for transparency)
DROP POLICY IF EXISTS "season_group_weeks_member_read" ON public.season_group_weeks;
CREATE POLICY "season_group_weeks_member_read"
  ON public.season_group_weeks
  FOR SELECT
  TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
    )
  );

-- Service role bypasses RLS (for cron jobs, billing service, etc.)
-- The `service_role` key has BYPASSRLS by default in Postgres; no policy needed.

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.season_group_weeks IS
  'Per-group per-week active/inactive flag for a season. Drives session filtering and billing in season-billing.service.ts. Admin-editable via the Season Calendar UI.';
COMMENT ON COLUMN public.season_group_weeks.week_monday IS
  'ISO date (YYYY-MM-DD) of the Monday that anchors the week. Must be a Monday.';
COMMENT ON COLUMN public.season_group_weeks.week_number IS
  'ISO 8601 calendar week (1-53) for convenience — can be derived from week_monday but is stored for query speed.';
COMMENT ON COLUMN public.season_group_weeks.is_active IS
  'Defaults to true. When false, the week is excluded from session creation (confirm route) and from totalSessions in billing.';
COMMENT ON COLUMN public.season_group_weeks.reason IS
  'Optional human-readable note (e.g. "Sommercamp-Ausfall", "Platz-Renovierung").';
