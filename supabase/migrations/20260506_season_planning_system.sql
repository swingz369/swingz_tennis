-- =============================================================================
-- SEASON PLANNING SYSTEM MIGRATION
-- =============================================================================
-- Creates all tables required for the AI-powered season planning feature.
--
-- PREREQUISITES (these tables must exist before running this migration):
--   - clubs, users, trainers, courts, groups, sessions
--   - user_club_memberships (for RLS policies)
--
-- Run with: psql "$DATABASE_URL" -f supabase/migrations/20260506_season_planning_system.sql
-- =============================================================================

-- 1. Seasons table (core planning unit)
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    -- Season identification
    name VARCHAR(100) NOT NULL,
    season_type VARCHAR(20) NOT NULL,       -- 'summer', 'winter', 'year_round', 'clinic'
    year INTEGER NOT NULL,

    -- Date ranges
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Planning status: 'draft' | 'preferences_open' | 'preferences_closed' | 'planning' | 'planned' | 'published' | 'archived'
    planning_status VARCHAR(20) NOT NULL DEFAULT 'draft',

    -- Preferences collection
    preferences_deadline DATE,
    preferences_open BOOLEAN NOT NULL DEFAULT false,

    -- Auto-planning configuration (JSON)
    auto_plan_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_plan_config JSONB DEFAULT '{
        "max_iterations": 1000,
        "optimization_goals": ["minimize_conflicts", "balance_trainer_load", "maximize_preferences"],
        "allow_overbooking": false,
        "prefer_consistent_timeslots": true
    }'::jsonb,

    -- Metadata
    description TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    last_planned_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS seasons_club_active_idx ON seasons(club_id, is_active);
CREATE INDEX IF NOT EXISTS seasons_club_dates_idx ON seasons(club_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS seasons_planning_status_idx ON seasons(planning_status);

-- 2. User Training Preferences (per season)
CREATE TABLE IF NOT EXISTS user_training_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    -- User role context
    user_role VARCHAR(20) NOT NULL,         -- 'member', 'trainer', 'admin'

    -- Training preferences
    preferred_level VARCHAR(20),            -- 'beginner', 'intermediate', 'advanced'
    preferred_age_group VARCHAR(20),        -- 'junior', 'senior'
    preferred_group_ids JSONB DEFAULT '[]'::jsonb,

    -- Weekly availability (recurring pattern)
    weekly_availability JSONB NOT NULL DEFAULT '{
        "monday": [],
        "tuesday": [],
        "wednesday": [],
        "thursday": [],
        "friday": [],
        "saturday": [],
        "sunday": []
    }'::jsonb,

    -- Specific unavailable dates
    unavailable_dates JSONB DEFAULT '[]'::jsonb,

    -- Trainer-specific fields
    max_sessions_per_week INTEGER,
    preferred_court_ids JSONB DEFAULT '[]'::jsonb,
    can_teach_groups JSONB DEFAULT '[]'::jsonb,

    -- Priority and notes
    priority INTEGER NOT NULL DEFAULT 5,
    special_requests TEXT,
    notes TEXT,

    -- Submission tracking
    submitted_at TIMESTAMPTZ,
    is_submitted BOOLEAN NOT NULL DEFAULT false,
    last_modified_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS user_prefs_season_idx ON user_training_preferences(season_id);
CREATE INDEX IF NOT EXISTS user_prefs_user_idx ON user_training_preferences(user_id);
CREATE INDEX IF NOT EXISTS user_prefs_club_idx ON user_training_preferences(club_id);
CREATE INDEX IF NOT EXISTS user_prefs_submitted_idx ON user_training_preferences(season_id, is_submitted);

-- 3. Season Plan Entries (generated schedule slots)
CREATE TABLE IF NOT EXISTS season_plan_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    -- Session details
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE RESTRICT,
    court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,

    -- Timing (recurring weekly pattern)
    day_of_week INTEGER NOT NULL,           -- 1=Monday, 7=Sunday
    start_time VARCHAR(8) NOT NULL,         -- 'HH:MM:SS'
    end_time VARCHAR(8) NOT NULL,
    duration_minutes INTEGER NOT NULL,

    -- Recurrence within season
    starts_from_week INTEGER NOT NULL DEFAULT 1,
    ends_at_week INTEGER,

    -- Planning metadata
    entry_type VARCHAR(20) NOT NULL DEFAULT 'training', -- 'training', 'match', 'clinic', 'open_court'
    planning_source VARCHAR(20) NOT NULL DEFAULT 'auto', -- 'auto', 'manual', 'imported'

    -- Quality scores (0-100)
    preference_match_score NUMERIC(5,2) DEFAULT 0,
    conflict_score NUMERIC(5,2) DEFAULT 0,
    optimization_score NUMERIC(5,2) DEFAULT 0,

    -- Participants
    max_participants INTEGER NOT NULL DEFAULT 10,
    expected_participants JSONB DEFAULT '[]'::jsonb,

    -- Status: 'planned', 'approved', 'rejected', 'published', 'cancelled'
    status VARCHAR(20) NOT NULL DEFAULT 'planned',

    -- Link to actual session (after publishing)
    published_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,

    notes TEXT,
    admin_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS plan_entries_season_idx ON season_plan_entries(season_id);
CREATE INDEX IF NOT EXISTS plan_entries_club_idx ON season_plan_entries(club_id);
CREATE INDEX IF NOT EXISTS plan_entries_trainer_idx ON season_plan_entries(trainer_id);
CREATE INDEX IF NOT EXISTS plan_entries_court_idx ON season_plan_entries(court_id);
CREATE INDEX IF NOT EXISTS plan_entries_group_idx ON season_plan_entries(group_id);
CREATE INDEX IF NOT EXISTS plan_entries_day_time_idx ON season_plan_entries(day_of_week, start_time);
CREATE INDEX IF NOT EXISTS plan_entries_status_idx ON season_plan_entries(status);

-- 4. Planning Conflicts (detected schedule issues)
CREATE TABLE IF NOT EXISTS planning_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    -- Conflict identification
    conflict_type VARCHAR(50) NOT NULL,     -- 'trainer_double_booked', 'court_double_booked',
                                            -- 'group_double_booked', 'user_unavailable',
                                            -- 'preference_violation', 'capacity_exceeded'
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'

    -- Affected entities
    affected_plan_entry_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    affected_trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    affected_court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
    affected_user_ids JSONB DEFAULT '[]'::jsonb,
    affected_group_ids JSONB DEFAULT '[]'::jsonb,

    -- Conflict details
    conflict_time_slot JSONB,
    description TEXT NOT NULL,
    suggested_resolution TEXT,

    -- Resolution tracking
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'in_review', 'resolved', 'wont_fix'
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolution_action VARCHAR(50),

    -- Metadata
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detection_source VARCHAR(20) DEFAULT 'auto_planner',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS conflicts_season_idx ON planning_conflicts(season_id);
CREATE INDEX IF NOT EXISTS conflicts_club_idx ON planning_conflicts(club_id);
CREATE INDEX IF NOT EXISTS conflicts_status_idx ON planning_conflicts(status);
CREATE INDEX IF NOT EXISTS conflicts_severity_idx ON planning_conflicts(severity);
CREATE INDEX IF NOT EXISTS conflicts_trainer_idx ON planning_conflicts(affected_trainer_id);
CREATE INDEX IF NOT EXISTS conflicts_court_idx ON planning_conflicts(affected_court_id);

-- 5. Season Planning History (audit trail)
CREATE TABLE IF NOT EXISTS season_planning_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

    action_type VARCHAR(50) NOT NULL,       -- 'plan_created', 'plan_regenerated', 'entry_added',
                                            -- 'entry_modified', 'entry_removed', 'conflict_resolved',
                                            -- 'preferences_opened', 'preferences_closed', 'published'
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(20),

    -- Action details
    details JSONB DEFAULT '{}'::jsonb,
    entries_affected INTEGER DEFAULT 0,
    conflicts_created INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,

    -- Algorithm-specific metrics
    algorithm_metrics JSONB,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS planning_history_season_idx ON season_planning_history(season_id);
CREATE INDEX IF NOT EXISTS planning_history_club_idx ON season_planning_history(club_id);
CREATE INDEX IF NOT EXISTS planning_history_action_idx ON season_planning_history(action_type);
CREATE INDEX IF NOT EXISTS planning_history_actor_idx ON season_planning_history(actor_id);
CREATE INDEX IF NOT EXISTS planning_history_created_idx ON season_planning_history(created_at);

-- =============================================================================
-- RLS Policies (enable Row Level Security for multi-tenant isolation)
-- =============================================================================

-- Seasons: Club-based access
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view seasons of their club" ON seasons
    FOR SELECT USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage seasons of their club" ON seasons
    FOR ALL USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships
            WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin') AND is_active = true
        )
    );

-- User Training Preferences: Own data access
ALTER TABLE user_training_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON user_training_preferences
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all preferences in club" ON user_training_preferences
    FOR SELECT USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships
            WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin') AND is_active = true
        )
    );

CREATE POLICY "Users can manage own preferences" ON user_training_preferences
    FOR ALL USING (user_id = auth.uid());

-- Season Plan Entries: Club-based access
ALTER TABLE season_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view plan entries of their club" ON season_plan_entries
    FOR SELECT USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage plan entries of their club" ON season_plan_entries
    FOR ALL USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships
            WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin') AND is_active = true
        )
    );

-- Planning Conflicts: Club-based access
ALTER TABLE planning_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conflicts of their club" ON planning_conflicts
    FOR SELECT USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage conflicts of their club" ON planning_conflicts
    FOR ALL USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships
            WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin') AND is_active = true
        )
    );

-- Season Planning History: Club-based read-only
ALTER TABLE season_planning_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view planning history of their club" ON season_planning_history
    FOR SELECT USING (
        club_id IN (
            SELECT club_id FROM user_club_memberships WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can insert planning history" ON season_planning_history
    FOR INSERT WITH CHECK (
        club_id IN (
            SELECT club_id FROM user_club_memberships
            WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin') AND is_active = true
        )
    );
