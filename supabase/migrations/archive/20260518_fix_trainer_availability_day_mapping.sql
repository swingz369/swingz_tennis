-- Fix day_of_week mapping in trainer_availabilities view.
-- Previous mapping had 0=monday which is wrong (ISO/PostgreSQL: 0=Sunday).
-- Corrected: 0=Sunday, 1=Monday, ..., 6=Saturday

CREATE OR REPLACE VIEW trainer_availabilities AS
  SELECT
    id,
    user_id     AS trainer_id,
    club_id,
    CASE day_of_week
      WHEN 0 THEN 'sunday'
      WHEN 1 THEN 'monday'
      WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday'
      WHEN 4 THEN 'thursday'
      WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday'
    END          AS day_of_week,
    start_time,
    end_time,
    is_available,
    created_at,
    created_at  AS updated_at,
    NULL::text  AS notes
  FROM trainer_availability;
