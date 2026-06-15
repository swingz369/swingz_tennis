-- =============================================================================
-- New Feature Tables: Weather Closures, League/Lineup, Work Duties
-- Generated from Drizzle schema definitions
-- =============================================================================

-- =============================================================================
-- 1. Court Closures (Weather Integration)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.court_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  court_id uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  reason varchar(50) NOT NULL, -- 'weather', 'maintenance', 'event', 'other'
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  weather_condition varchar(50), -- 'rain', 'frost', 'extreme_heat', 'snow'
  auto_generated boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_court_closures_club ON public.court_closures(club_id);
CREATE INDEX IF NOT EXISTS idx_court_closures_court ON public.court_closures(court_id);
CREATE INDEX IF NOT EXISTS idx_court_closures_active ON public.court_closures(is_active);
CREATE INDEX IF NOT EXISTS idx_court_closures_dates ON public.court_closures(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_court_closures_reason ON public.court_closures(reason);

-- =============================================================================
-- 2. Leagues (League & Team Lineup)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  season_year integer NOT NULL,
  league_type varchar(50) NOT NULL DEFAULT 'regular', -- 'regular', 'playoff', 'friendly'
  division varchar(100), -- e.g. 'Bezirksliga', 'Kreisklasse'
  sport varchar(50) NOT NULL DEFAULT 'tennis', -- 'tennis', 'squash', 'badminton'
  age_group varchar(50), -- 'Herren', 'Damen', 'Jugend U14', etc.
  status varchar(20) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leagues_club ON public.leagues(club_id);
CREATE INDEX IF NOT EXISTS idx_leagues_season ON public.leagues(season_year);
CREATE INDEX IF NOT EXISTS idx_leagues_status ON public.leagues(status);

-- =============================================================================
-- 3. Teams
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  captain_id uuid,
  position integer, -- current league position
  matches_played integer NOT NULL DEFAULT 0,
  matches_won integer NOT NULL DEFAULT 0,
  matches_lost integer NOT NULL DEFAULT 0,
  matches_drawn integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_club ON public.teams(club_id);
CREATE INDEX IF NOT EXISTS idx_teams_league ON public.teams(league_id);
CREATE INDEX IF NOT EXISTS idx_teams_position ON public.teams(league_id, position);

-- =============================================================================
-- 4. Team Members
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'player', -- 'captain', 'player', 'substitute'
  position_number integer, -- playing position (1 = first singles, etc.)
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON public.team_members(member_id);

-- =============================================================================
-- 5. Match Days
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.match_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  matchday_number integer NOT NULL,
  scheduled_date timestamptz,
  opponent varchar(200) NOT NULL,
  is_home boolean NOT NULL DEFAULT true,
  venue text,
  result varchar(20), -- 'win', 'loss', 'draw', null = not played
  score_home integer,
  score_away integer,
  notes text,
  status varchar(20) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_days_league ON public.match_days(league_id);
CREATE INDEX IF NOT EXISTS idx_match_days_date ON public.match_days(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_match_days_status ON public.match_days(status);

-- =============================================================================
-- 6. Work Duties
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.work_duties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  description text,
  duty_type varchar(50) NOT NULL, -- 'court_maintenance', 'event_support', 'bar_duty', 'cleaning', 'coaching_assist', 'other'
  scheduled_date timestamptz,
  start_time varchar(5), -- HH:MM
  end_time varchar(5), -- HH:MM
  max_participants integer DEFAULT 1,
  status varchar(20) NOT NULL DEFAULT 'open', -- 'open', 'assigned', 'completed', 'cancelled'
  assigned_to uuid,
  priority varchar(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  season_year integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_duties_club ON public.work_duties(club_id);
CREATE INDEX IF NOT EXISTS idx_work_duties_status ON public.work_duties(status);
CREATE INDEX IF NOT EXISTS idx_work_duties_assigned ON public.work_duties(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_duties_date ON public.work_duties(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_work_duties_type ON public.work_duties(duty_type);

-- =============================================================================
-- 7. Work Duty Assignments
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.work_duty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_id uuid NOT NULL REFERENCES public.work_duties(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'assigned', -- 'assigned', 'completed', 'excused', 'no_show'
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(duty_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_work_duty_assignments_duty ON public.work_duty_assignments(duty_id);
CREATE INDEX IF NOT EXISTS idx_work_duty_assignments_member ON public.work_duty_assignments(member_id);
CREATE INDEX IF NOT EXISTS idx_work_duty_assignments_status ON public.work_duty_assignments(status);

-- =============================================================================
-- RLS Policies (Row Level Security)
-- =============================================================================

ALTER TABLE public.court_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_duty_assignments ENABLE ROW LEVEL SECURITY;

-- Helper: check if user has access to a club
-- Reuses existing is_member_of_club / is_admin_of_club if available

-- Court Closures: members can read, admins can write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'court_closures_select' AND tablename = 'court_closures') THEN
    CREATE POLICY court_closures_select ON public.court_closures
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = court_closures.club_id AND ucm.is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'court_closures_insert' AND tablename = 'court_closures') THEN
    CREATE POLICY court_closures_insert ON public.court_closures
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = court_closures.club_id
          AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'court_closures_update' AND tablename = 'court_closures') THEN
    CREATE POLICY court_closures_update ON public.court_closures
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = court_closures.club_id
          AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'court_closures_delete' AND tablename = 'court_closures') THEN
    CREATE POLICY court_closures_delete ON public.court_closures
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = court_closures.club_id
          AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true
        )
      );
  END IF;
END $$;

-- Leagues: members can read, admins can write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'leagues_select' AND tablename = 'leagues') THEN
    CREATE POLICY leagues_select ON public.leagues
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = leagues.club_id AND ucm.is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'leagues_insert' AND tablename = 'leagues') THEN
    CREATE POLICY leagues_insert ON public.leagues
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = leagues.club_id
          AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'leagues_update' AND tablename = 'leagues') THEN
    CREATE POLICY leagues_update ON public.leagues
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = leagues.club_id
          AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'leagues_delete' AND tablename = 'leagues') THEN
    CREATE POLICY leagues_delete ON public.leagues
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.user_club_memberships ucm
          WHERE ucm.user_id = auth.uid() AND ucm.club_id = leagues.club_id
          AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true
        )
      );
  END IF;
END $$;

-- Teams: same pattern
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teams_select' AND tablename = 'teams') THEN
    CREATE POLICY teams_select ON public.teams FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.user_club_memberships ucm WHERE ucm.user_id = auth.uid() AND ucm.club_id = teams.club_id AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teams_insert' AND tablename = 'teams') THEN
    CREATE POLICY teams_insert ON public.teams FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.user_club_memberships ucm WHERE ucm.user_id = auth.uid() AND ucm.club_id = teams.club_id AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teams_update' AND tablename = 'teams') THEN
    CREATE POLICY teams_update ON public.teams FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.user_club_memberships ucm WHERE ucm.user_id = auth.uid() AND ucm.club_id = teams.club_id AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teams_delete' AND tablename = 'teams') THEN
    CREATE POLICY teams_delete ON public.teams FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.user_club_memberships ucm WHERE ucm.user_id = auth.uid() AND ucm.club_id = teams.club_id AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;

-- Team Members: inherited via team -> club
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'team_members_select' AND tablename = 'team_members') THEN
    CREATE POLICY team_members_select ON public.team_members FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.teams t JOIN public.user_club_memberships ucm ON ucm.club_id = t.club_id WHERE t.id = team_members.team_id AND ucm.user_id = auth.uid() AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'team_members_insert' AND tablename = 'team_members') THEN
    CREATE POLICY team_members_insert ON public.team_members FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.teams t JOIN public.user_club_memberships ucm ON ucm.club_id = t.club_id WHERE t.id = team_members.team_id AND ucm.user_id = auth.uid() AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'team_members_delete' AND tablename = 'team_members') THEN
    CREATE POLICY team_members_delete ON public.team_members FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.teams t JOIN public.user_club_memberships ucm ON ucm.club_id = t.club_id WHERE t.id = team_members.team_id AND ucm.user_id = auth.uid() AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;

-- Match Days: inherited via league -> club
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_days_select' AND tablename = 'match_days') THEN
    CREATE POLICY match_days_select ON public.match_days FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.leagues l JOIN public.user_club_memberships ucm ON ucm.club_id = l.club_id WHERE l.id = match_days.league_id AND ucm.user_id = auth.uid() AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_days_insert' AND tablename = 'match_days') THEN
    CREATE POLICY match_days_insert ON public.match_days FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.leagues l JOIN public.user_club_memberships ucm ON ucm.club_id = l.club_id WHERE l.id = match_days.league_id AND ucm.user_id = auth.uid() AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_days_update' AND tablename = 'match_days') THEN
    CREATE POLICY match_days_update ON public.match_days FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.leagues l JOIN public.user_club_memberships ucm ON ucm.club_id = l.club_id WHERE l.id = match_days.league_id AND ucm.user_id = auth.uid() AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'match_days_delete' AND tablename = 'match_days') THEN
    CREATE POLICY match_days_delete ON public.match_days FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.leagues l JOIN public.user_club_memberships ucm ON ucm.club_id = l.club_id WHERE l.id = match_days.league_id AND ucm.user_id = auth.uid() AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;

-- Work Duties: members can read, admins can write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_duties_select' AND tablename = 'work_duties') THEN
    CREATE POLICY work_duties_select ON public.work_duties FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.user_club_memberships ucm WHERE ucm.user_id = auth.uid() AND ucm.club_id = work_duties.club_id AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_duties_insert' AND tablename = 'work_duties') THEN
    CREATE POLICY work_duties_insert ON public.work_duties FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.user_club_memberships ucm WHERE ucm.user_id = auth.uid() AND ucm.club_id = work_duties.club_id AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_duties_update' AND tablename = 'work_duties') THEN
    CREATE POLICY work_duties_update ON public.work_duties FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.user_club_memberships ucm WHERE ucm.user_id = auth.uid() AND ucm.club_id = work_duties.club_id AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_duties_delete' AND tablename = 'work_duties') THEN
    CREATE POLICY work_duties_delete ON public.work_duties FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.user_club_memberships ucm WHERE ucm.user_id = auth.uid() AND ucm.club_id = work_duties.club_id AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;

-- Work Duty Assignments: inherited via duty -> club
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_duty_assignments_select' AND tablename = 'work_duty_assignments') THEN
    CREATE POLICY work_duty_assignments_select ON public.work_duty_assignments FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.work_duties wd JOIN public.user_club_memberships ucm ON ucm.club_id = wd.club_id WHERE wd.id = work_duty_assignments.duty_id AND ucm.user_id = auth.uid() AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_duty_assignments_insert' AND tablename = 'work_duty_assignments') THEN
    CREATE POLICY work_duty_assignments_insert ON public.work_duty_assignments FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.work_duties wd JOIN public.user_club_memberships ucm ON ucm.club_id = wd.club_id WHERE wd.id = work_duty_assignments.duty_id AND ucm.user_id = auth.uid() AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_duty_assignments_update' AND tablename = 'work_duty_assignments') THEN
    CREATE POLICY work_duty_assignments_update ON public.work_duty_assignments FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.work_duties wd JOIN public.user_club_memberships ucm ON ucm.club_id = wd.club_id WHERE wd.id = work_duty_assignments.duty_id AND ucm.user_id = auth.uid() AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_duty_assignments_delete' AND tablename = 'work_duty_assignments') THEN
    CREATE POLICY work_duty_assignments_delete ON public.work_duty_assignments FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.work_duties wd JOIN public.user_club_memberships ucm ON ucm.club_id = wd.club_id WHERE wd.id = work_duty_assignments.duty_id AND ucm.user_id = auth.uid() AND ucm.role IN ('admin', 'superadmin') AND ucm.is_active = true)
    );
  END IF;
END $$;
