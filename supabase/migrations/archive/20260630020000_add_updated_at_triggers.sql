-- Sprint C: Add auto-update triggers for updated_at column
-- on 23 tables that have the column but no trigger.

-- Reusable trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to all 23 tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'background_jobs', 'booking_rules', 'clubs', 'court_types', 'courts',
    'dunning_records', 'gamification_points', 'groups', 'invoice_items',
    'invoices', 'member_balances', 'member_schedule_preferences', 'messages',
    'news_posts', 'schedules', 'season_planning_configs', 'season_waitlists',
    'session_rsvps', 'sessions', 'tournaments',
    'trainers', 'users'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;
