-- ============================================================
-- SEASON WAITLISTS
-- ============================================================
-- Manages waitlist entries for training groups across seasons.
-- Members can be waitlisted when groups are full, with priority
-- ordering and optional alternative group assignments.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.season_waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Waitlist position and priority
  position INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,                -- 1-10, lower = higher priority
  priority_reason VARCHAR(50) DEFAULT 'registration_time',

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',      -- waiting, notified, accepted, declined, expired
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,

  -- Alternative assignment
  alternative_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  alternative_assigned_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS waitlists_season_idx ON public.season_waitlists(season_id);
CREATE INDEX IF NOT EXISTS waitlists_club_idx ON public.season_waitlists(club_id);
CREATE INDEX IF NOT EXISTS waitlists_group_idx ON public.season_waitlists(group_id);
CREATE INDEX IF NOT EXISTS waitlists_member_idx ON public.season_waitlists(member_id);
CREATE INDEX IF NOT EXISTS waitlists_status_idx ON public.season_waitlists(status);
CREATE INDEX IF NOT EXISTS waitlists_group_position_idx ON public.season_waitlists(group_id, position);

-- RLS: Enable row-level security
ALTER TABLE public.season_waitlists ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can do everything
CREATE POLICY "Admins can manage season_waitlists"
  ON public.season_waitlists
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_club_memberships
      WHERE user_id = auth.uid()
        AND club_id = season_waitlists.club_id
        AND role IN ('admin', 'superadmin')
        AND is_active = true
    )
  );

-- RLS: Members can view their own waitlist entries
CREATE POLICY "Members can view own waitlist entries"
  ON public.season_waitlists
  FOR SELECT
  USING (
    member_id = auth.uid()
  );
