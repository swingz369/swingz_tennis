-- Sprint C: Enable RLS on member_schedule_preferences + user-owned policies
-- Idempotent: only enable if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'member_schedule_preferences' AND relrowsecurity = true
  ) THEN
    ALTER TABLE public.member_schedule_preferences ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Users can CRUD their own preferences
CREATE POLICY member_schedule_prefs_select_own ON public.member_schedule_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY member_schedule_prefs_insert_own ON public.member_schedule_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY member_schedule_prefs_update_own ON public.member_schedule_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY member_schedule_prefs_delete_own ON public.member_schedule_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can read all preferences in their club
CREATE POLICY member_schedule_prefs_admin_select ON public.member_schedule_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_club_memberships m
      WHERE m.user_id = auth.uid()
        AND m.club_id = member_schedule_preferences.club_id
        AND m.role IN ('admin', 'superadmin')
    )
  );
