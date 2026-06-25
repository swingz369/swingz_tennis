-- Special Events: Sommercamp, Intensivkurs, Schnupperkurs, etc.
-- Events außerhalb des regulären Saisonbetriebs

CREATE TYPE special_event_type AS ENUM (
  'sommercamp', 'intensivkurs', 'schnupperkurs', 'turnier', 'social', 'sonstiges'
);

CREATE TYPE special_event_status AS ENUM (
  'draft', 'open', 'full', 'cancelled', 'completed'
);

CREATE TABLE special_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by        uuid REFERENCES users(id),
  name              varchar(200) NOT NULL,
  event_type        special_event_type NOT NULL DEFAULT 'sommercamp',
  description       text,
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  start_time        time,
  end_time          time,
  location          varchar(200),
  max_participants  integer NOT NULL DEFAULT 12,
  price_per_person  numeric(10,2) NOT NULL DEFAULT 0,
  trainer_id        uuid REFERENCES trainers(id),
  status            special_event_status NOT NULL DEFAULT 'draft',
  age_groups        text[] DEFAULT '{}',
  skill_levels      text[] DEFAULT '{}',
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

CREATE TABLE special_event_registrations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES special_events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     varchar(20) NOT NULL DEFAULT 'registered',
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_staff_manage_events" ON special_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = special_events.club_id
        AND user_id = auth.uid()
        AND role IN ('admin','superadmin','owner')
        AND is_active = true
    )
  );

CREATE POLICY "club_members_read_events" ON special_events
  FOR SELECT USING (
    status != 'draft' AND
    EXISTS (
      SELECT 1 FROM user_club_memberships
      WHERE club_id = special_events.club_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "own_registrations" ON special_event_registrations
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "admin_see_registrations" ON special_event_registrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM special_events se
      JOIN user_club_memberships ucm ON ucm.club_id = se.club_id
      WHERE se.id = special_event_registrations.event_id
        AND ucm.user_id = auth.uid()
        AND ucm.role IN ('admin','superadmin','owner')
    )
  );

CREATE INDEX ON special_events(club_id, start_date);
CREATE INDEX ON special_event_registrations(event_id);
CREATE INDEX ON special_event_registrations(user_id);
