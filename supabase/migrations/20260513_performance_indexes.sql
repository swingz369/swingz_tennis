-- =============================================================================
-- Performance Index Migration: Zusätzliche Indices für Booking, Trainer & Full-Text Search
-- 
-- Prerequisites: Alle Core-Tabellen (bookings, trainer_availabilities, users, clubs, courts) müssen existieren
-- Empfohlen: pg_trgm Extension für Full-Text Search (muss vorher installiert werden)
-- =============================================================================

-- =============================================================================
-- 1. Booking Availability Composite Index (häufigste Query)
--    Optimiert: SELECT ... FROM bookings WHERE club_id = X AND court_id = Y 
--               AND start_time >= Z AND status = 'confirmed' ORDER BY start_time
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_availability 
  ON bookings (club_id, court_id, session_start_time, status);

-- =============================================================================
-- 2. Trainer Availability Lookup Index
--    Optimiert: SELECT ... FROM trainer_availabilities 
--               WHERE trainer_id = X AND date BETWEEN Y AND Z AND status = 'available'
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_trainer_availability_lookup 
  ON trainer_availabilities (trainer_id, date, status);

-- =============================================================================
-- 3. Full-Text Search for Members (requires pg_trgm extension)
--    Optimiert: SELECT ... FROM users WHERE full_name ILIKE '%searchterm%'
--    Falls pg_trgm nicht installiert ist, wird dieser Block übersprungen
-- =============================================================================
DO $$
BEGIN
  -- Check if pg_trgm extension is available and install it
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_trgm extension not available. Full-text search index will be skipped.';
      RETURN;
    END;
  END IF;

  -- Create trigram index on full_name for fuzzy search
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_full_name_trgm'
  ) THEN
    CREATE INDEX idx_users_full_name_trgm 
      ON users USING gin (full_name gin_trgm_ops);
  END IF;

  -- Create trigram index on email for search
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_email_trgm'
  ) THEN
    CREATE INDEX idx_users_email_trgm 
      ON users USING gin (email gin_trgm_ops);
  END IF;
END $$;

-- =============================================================================
-- 4. Court Availability by Date Range
--    Optimiert: SELECT ... FROM courts WHERE club_id = X AND is_active = true
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_courts_active_club 
  ON courts (club_id, is_active);

-- =============================================================================
-- 5. Booking Status + Date Composite (for cancellation policy queries)
--    Optimiert: SELECT ... FROM bookings WHERE status = 'confirmed' 
--               AND session_start_time < NOW() - INTERVAL '24 hours'
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_status_date 
  ON bookings (status, session_start_time);

-- =============================================================================
-- 6. Session Schedule + Week Composite (for weekly view queries)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_sessions_schedule_week 
  ON sessions (schedule_id, week_number);
