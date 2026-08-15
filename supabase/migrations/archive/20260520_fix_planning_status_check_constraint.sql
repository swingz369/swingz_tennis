ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_planning_status_check;

ALTER TABLE seasons ADD CONSTRAINT seasons_planning_status_check
  CHECK (planning_status IN (
    'draft',
    'collecting_preferences',
    'preferences_open',
    'auto_planning',
    'manual_review',
    'invoices_generated',
    'published',
    'active',
    'completed',
    'archived'
  ));
