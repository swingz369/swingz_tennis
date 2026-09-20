-- Ankündigungen: Zielgruppe je Beitrag und Lesebestätigung (Lesequote für die Verwaltung).
-- Rundnachrichten laufen künftig über Gruppen-Chats bzw. diese Ankündigungen.

ALTER TABLE public.news_posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all';
ALTER TABLE public.news_posts DROP CONSTRAINT IF EXISTS news_posts_audience_check;
ALTER TABLE public.news_posts
  ADD CONSTRAINT news_posts_audience_check CHECK (audience IN ('all', 'trainers', 'members'));

-- 'trainers' = Trainer + Verwaltung, 'members' = Mitglieder ohne Trainerrolle.
CREATE OR REPLACE FUNCTION public.news_audience_matches(p_club_id uuid, p_audience text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_club_memberships
    WHERE user_id = auth.uid() AND club_id = p_club_id AND is_active
      AND CASE p_audience
            WHEN 'all' THEN true
            WHEN 'trainers' THEN role IN ('trainer', 'admin', 'superadmin')
            ELSE role = 'member'
          END
  )
$$;

-- Die beiden Mitglieder-SELECT-Policies (OR-verknüpft, ohne Zielgruppe) werden durch eine ersetzt.
DROP POLICY IF EXISTS club_members_see_published_news ON public.news_posts;
DROP POLICY IF EXISTS members_can_view_published_news ON public.news_posts;
CREATE POLICY news_posts_member_select ON public.news_posts
  FOR SELECT USING (
    is_published = true AND public.news_audience_matches(club_id, audience)
  );

CREATE TABLE IF NOT EXISTS public.news_post_reads (
  post_id uuid NOT NULL REFERENCES public.news_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE public.news_post_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY news_post_reads_select_own ON public.news_post_reads
  FOR SELECT USING (user_id = auth.uid());
-- Einfügen nur für sich selbst und nur für einen Beitrag, den man per RLS sehen darf.
CREATE POLICY news_post_reads_insert_own ON public.news_post_reads
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.news_posts p WHERE p.id = post_id)
  );

-- Lesequote je Beitrag; nur für die Verwaltung des Vereins.
CREATE OR REPLACE FUNCTION public.news_read_stats(p_club_id uuid)
RETURNS TABLE (post_id uuid, read_count bigint, audience_count bigint)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET row_security TO 'off' SET search_path = public AS $$
BEGIN
  IF NOT public.is_club_admin(p_club_id) THEN
    RAISE EXCEPTION 'Nur für die Vereinsverwaltung' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT n.id,
    (SELECT count(*) FROM news_post_reads r WHERE r.post_id = n.id),
    (SELECT count(DISTINCT m.user_id) FROM user_club_memberships m
      WHERE m.club_id = n.club_id AND m.is_active
        AND CASE n.audience
              WHEN 'all' THEN true
              WHEN 'trainers' THEN m.role IN ('trainer', 'admin', 'superadmin')
              ELSE m.role = 'member'
            END)
  FROM news_posts n
  WHERE n.club_id = p_club_id AND n.is_published;
END $$;

REVOKE ALL ON FUNCTION public.news_audience_matches(uuid, text), public.news_read_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.news_audience_matches(uuid, text), public.news_read_stats(uuid) TO authenticated;
