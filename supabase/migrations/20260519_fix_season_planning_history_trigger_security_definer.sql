-- Fix log_season_planning_action trigger: was SECURITY INVOKER, causing RLS
-- INSERT policy on season_planning_history to fail because auth.uid() doesn't
-- resolve in a SECURITY INVOKER trigger context when called from the API.
-- Making it SECURITY DEFINER (consistent with log_season_plan_entry_changes)
-- lets the trigger bypass RLS and write history entries correctly.

CREATE OR REPLACE FUNCTION log_season_planning_action()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO season_planning_history (season_id, club_id, action_type, actor_id, details)
    VALUES (NEW.id, NEW.club_id, 'season_created', NEW.created_by,
            jsonb_build_object('season_name', NEW.name, 'season_type', NEW.season_type));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.planning_status != NEW.planning_status THEN
      INSERT INTO season_planning_history (season_id, club_id, action_type, details)
      VALUES (NEW.id, NEW.club_id,
              CASE NEW.planning_status
                WHEN 'collecting_preferences' THEN 'preferences_opened'
                WHEN 'auto_planning' THEN 'auto_plan_started'
                WHEN 'published' THEN 'plan_published'
                WHEN 'active' THEN 'season_activated'
                WHEN 'completed' THEN 'season_completed'
                ELSE 'manual_edit'
              END,
              jsonb_build_object('old_status', OLD.planning_status, 'new_status', NEW.planning_status));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
