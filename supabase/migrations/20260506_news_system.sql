-- News & Announcements System
-- Based on TSOWAPP implementation
-- Created: 2026-05-06

-- ============================================
-- NEWS POSTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS news_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  slug varchar(250) UNIQUE NOT NULL,
  content text NOT NULL,
  excerpt text,
  cover_image_url text,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category varchar(50) DEFAULT 'general' CHECK (category IN ('general', 'event', 'announcement', 'tournament', 'training', 'maintenance')),
  status varchar(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_pinned boolean DEFAULT false,
  published_at timestamp,
  tags text[],
  view_count integer DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- NEWS COMMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS news_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  news_post_id uuid NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_edited boolean DEFAULT false,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_news_posts_club_id ON news_posts(club_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_author_id ON news_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_status ON news_posts(status);
CREATE INDEX IF NOT EXISTS idx_news_posts_category ON news_posts(category);
CREATE INDEX IF NOT EXISTS idx_news_posts_published_at ON news_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_news_posts_pinned ON news_posts(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_news_posts_slug ON news_posts(slug);

CREATE INDEX IF NOT EXISTS idx_news_comments_post_id ON news_comments(news_post_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_user_id ON news_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_created_at ON news_comments(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_comments ENABLE ROW LEVEL SECURITY;

-- News posts policies
CREATE POLICY "members_can_view_published_news" ON news_posts
  FOR SELECT USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = news_posts.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
    )
  );

CREATE POLICY "admins_can_manage_news" ON news_posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships ucm
      WHERE ucm.club_id = news_posts.club_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- News comments policies
CREATE POLICY "members_can_view_comments" ON news_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM news_posts np
      JOIN user_club_memberships ucm ON ucm.club_id = np.club_id
      WHERE np.id = news_comments.news_post_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND np.status = 'published'
    )
  );

CREATE POLICY "members_can_create_comments" ON news_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM news_posts np
      JOIN user_club_memberships ucm ON ucm.club_id = np.club_id
      WHERE np.id = news_comments.news_post_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND np.status = 'published'
    )
  );

CREATE POLICY "users_can_update_own_comments" ON news_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "users_can_delete_own_comments" ON news_comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM news_posts np
      JOIN user_club_memberships ucm ON ucm.club_id = np.club_id
      WHERE np.id = news_comments.news_post_id
      AND ucm.user_id = auth.uid()
      AND ucm.is_active = true
      AND ucm.role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_news_posts_updated_at BEFORE UPDATE ON news_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_comments_updated_at BEFORE UPDATE ON news_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION generate_slug(p_title text, p_club_id uuid)
RETURNS text AS $$
DECLARE
  v_slug text;
  v_counter integer := 0;
  v_final_slug text;
BEGIN
  -- Convert to lowercase and replace spaces with hyphens
  v_slug := lower(regexp_replace(p_title, '[^a-zA-Z0-9äöüÄÖÜß ]+', '', 'g'));
  v_slug := regexp_replace(v_slug, '\s+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  
  -- Ensure uniqueness
  v_final_slug := v_slug;
  WHILE EXISTS (SELECT 1 FROM news_posts WHERE slug = v_final_slug) LOOP
    v_counter := v_counter + 1;
    v_final_slug := v_slug || '-' || v_counter;
  END LOOP;
  
  RETURN v_final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_news_view_count(p_post_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE news_posts
  SET view_count = view_count + 1
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE news_posts IS 'News posts and announcements for clubs';
COMMENT ON TABLE news_comments IS 'Comments on news posts';

COMMENT ON COLUMN news_posts.status IS 'draft, published, or archived';
COMMENT ON COLUMN news_posts.category IS 'general, event, announcement, tournament, training, maintenance';
COMMENT ON COLUMN news_posts.is_pinned IS 'Pinned posts appear at the top';
COMMENT ON COLUMN news_posts.slug IS 'URL-friendly identifier';
