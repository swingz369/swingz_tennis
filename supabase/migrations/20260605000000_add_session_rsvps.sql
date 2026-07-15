-- Migration: Create session_rsvps table
-- This table is defined in the Drizzle schema (src/infrastructure/persistence/schema.ts)
-- but was never deployed as a Supabase migration.

CREATE TABLE IF NOT EXISTS public.session_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  notes text,
  reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS rsvp_session_member_idx ON public.session_rsvps(session_id, member_id);
CREATE INDEX IF NOT EXISTS rsvp_member_idx ON public.session_rsvps(member_id);
CREATE INDEX IF NOT EXISTS rsvp_status_idx ON public.session_rsvps(status);
CREATE INDEX IF NOT EXISTS rsvp_session_status_idx ON public.session_rsvps(session_id, status);
CREATE INDEX IF NOT EXISTS rsvp_club_idx ON public.session_rsvps(club_id);

-- RLS
ALTER TABLE public.session_rsvps ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Members can RSVP to their own sessions" ON public.session_rsvps;
CREATE POLICY "Members can RSVP to their own sessions" ON public.session_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS "Members can view their own RSVPs" ON public.session_rsvps;
CREATE POLICY "Members can view their own RSVPs" ON public.session_rsvps
  FOR SELECT TO authenticated
  USING (member_id = auth.uid());

DROP POLICY IF EXISTS "Members can update their own RSVPs" ON public.session_rsvps;
CREATE POLICY "Members can update their own RSVPs" ON public.session_rsvps
  FOR UPDATE TO authenticated
  USING (member_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all RSVPs in their club" ON public.session_rsvps;
CREATE POLICY "Admins can manage all RSVPs in their club" ON public.session_rsvps
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_club_memberships ucm
      WHERE ucm.user_id = auth.uid()
        AND ucm.club_id = session_rsvps.club_id
        AND ucm.role IN ('admin', 'superadmin')
    )
  );

COMMENT ON TABLE public.session_rsvps IS 'Session RSVPs – member attendance confirmations for training sessions';
