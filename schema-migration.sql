-- SWINGZ Database Schema
-- Generated from src/infrastructure/persistence/schema.ts
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(255) NOT NULL,
  address text,
  max_members integer NOT NULL DEFAULT 100,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- Courts table
CREATE TABLE IF NOT EXISTS courts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  surface varchar(20) NOT NULL CHECK (surface IN ('clay', 'grass', 'hard', 'carpet')),
  has_indoor boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season_type varchar(20) NOT NULL CHECK (season_type IN ('spring', 'summer', 'autumn', 'winter', 'year-round')),
  season_year integer NOT NULL,
  season_start_date date NOT NULL,
  season_end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES trainers(id),
  court_id uuid REFERENCES courts(id),
  group_ids jsonb NOT NULL DEFAULT '[]',
  week_number integer NOT NULL,
  timeslot_start timestamp NOT NULL,
  timeslot_end timestamp NOT NULL,
  max_participants integer NOT NULL DEFAULT 10,
  notes text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- Trainers table
CREATE TABLE IF NOT EXISTS trainers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email varchar(255) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  specialties jsonb NOT NULL DEFAULT '[]',
  max_hours_per_week integer NOT NULL DEFAULT 40,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- Trainer-Club relationships (many-to-many)
CREATE TABLE IF NOT EXISTS trainer_clubs (
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trainer_id, club_id)
);

-- Users table (for members)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email varchar(255) NOT NULL UNIQUE,
  full_name varchar(100),
  avatar_url text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- User-Club Memberships (many-to-many with role)
CREATE TABLE IF NOT EXISTS user_club_memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'trainer', 'admin', 'superadmin')),
  joined_at timestamp NOT NULL DEFAULT NOW(),
  is_active boolean NOT NULL DEFAULT true,
  tenant_id varchar(100),
  created_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, club_id)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES users(id),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show')),
  booked_at timestamp NOT NULL DEFAULT NOW(),
  cancelled_at timestamp,
  cancellation_reason varchar(50),
  cancellation_notes text,
  created_at timestamp NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clubs_max_members ON clubs(max_members);
CREATE INDEX IF NOT EXISTS idx_courts_club_id ON courts(club_id);
CREATE INDEX IF NOT EXISTS idx_schedules_club_id ON schedules(club_id);
CREATE INDEX IF NOT EXISTS idx_sessions_schedule_id ON sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sessions_trainer_id ON sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_court_id ON sessions(court_id);
CREATE INDEX IF NOT EXISTS idx_sessions_week_number ON sessions(week_number);
CREATE INDEX IF NOT EXISTS idx_trainer_clubs_club_id ON trainer_clubs(club_id);
CREATE INDEX IF NOT EXISTS idx_user_club_memberships_user_id ON user_club_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_club_memberships_club_id ON user_club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_bookings_club_id ON bookings(club_id);
CREATE INDEX IF NOT EXISTS idx_bookings_member_id ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session_id ON bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Basic - adjust as needed)
-- Clubs: visible to members of the club
CREATE POLICY "Club members can view clubs" ON clubs
  FOR SELECT USING (
    id IN (
      SELECT club_id FROM user_club_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Members can view members of their own club (excluding sensitive data)
CREATE POLICY "Members can view club members" ON users
  FOR SELECT USING (
    id IN (
      SELECT user_id FROM user_club_memberships
      WHERE club_id IN (
        SELECT club_id FROM user_club_memberships
        WHERE user_id = auth.uid() AND is_active = true
      ) AND is_active = true
    )
  );

-- Sessions: visible to members of the club
CREATE POLICY "Club members can view sessions" ON sessions
  FOR SELECT USING (
    schedule_id IN (
      SELECT id FROM schedules WHERE club_id IN (
        SELECT club_id FROM user_club_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Bookings: users can only see their own bookings and club bookings
CREATE POLICY "Users can view their own bookings" ON bookings
  FOR SELECT USING (
    member_id = auth.uid() OR
    club_id IN (
      SELECT club_id FROM user_club_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Insert policy for bookings (members can create bookings)
CREATE POLICY "Members can create bookings" ON bookings
  FOR INSERT WITH CHECK (
    member_id = auth.uid() AND
    club_id IN (
      SELECT club_id FROM user_club_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Update/Delete policies for bookings (only member can cancel own pending booking)
CREATE POLICY "Members can update their bookings" ON bookings
  FOR UPDATE USING (
    member_id = auth.uid() AND status = 'pending'
  );

-- Unique constraint to prevent double booking
ALTER TABLE bookings ADD CONSTRAINT IF NOT EXISTS unique_session_member UNIQUE (session_id, member_id);

-- =============================================================================
-- SEASON PLANNING: Additional columns (added 2026-05-26)
-- =============================================================================

-- season_planning_configs: kids group size config and slot duration
ALTER TABLE season_planning_configs
  ADD COLUMN IF NOT EXISTS kids_group_max_size integer NOT NULL DEFAULT 6;
ALTER TABLE season_planning_configs
  ADD COLUMN IF NOT EXISTS kids_group_min_size integer NOT NULL DEFAULT 3;
ALTER TABLE season_planning_configs
  ADD COLUMN IF NOT EXISTS slot_duration_minutes integer NOT NULL DEFAULT 90;

-- user_training_preferences: members to avoid (negative partner wishes)
ALTER TABLE user_training_preferences
  ADD COLUMN IF NOT EXISTS avoid_member_ids jsonb DEFAULT '[]'::jsonb;

