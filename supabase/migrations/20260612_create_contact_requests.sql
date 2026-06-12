-- Contact Requests table for Early Access form submissions
CREATE TABLE IF NOT EXISTS contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  club_name TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created ON contact_requests(created_at DESC);

-- RLS
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public form, no auth required)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contact_requests_insert_public' AND tablename = 'contact_requests') THEN
    CREATE POLICY contact_requests_insert_public
      ON contact_requests FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Service role can read all (admin dashboard)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contact_requests_service_read' AND tablename = 'contact_requests') THEN
    CREATE POLICY contact_requests_service_read
      ON contact_requests FOR SELECT
      USING (true);
  END IF;
END $$;
