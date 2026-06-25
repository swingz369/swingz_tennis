-- =============================================================================
-- Migration: Mahnwesen Verzugszins (§288 BGB) + Beschlussdatenbank (Vereinsrecht)
-- =============================================================================
-- Datum:        2026-06-24
-- Beschreibung:
--   1. Erweitert dunning_records um Verzugszins-Spalten (interest_amount,
--      interest_days, is_b2b, base_rate_applied).
--   2. Erstellt Tabelle base_interest_rates (Bundesbank-Basiszinssatz,
--      halbjährliche Updates).
--   3. Erstellt board_decisions (Mitgliederversammlungs- & Vorstandsbeschlüsse),
--      meeting_invitations (digitale Einladungen) und decision_votes
--      (Abstimmungs-Protokolle) inkl. RLS.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. dunning_records erweitern (additive, kein Bruch)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.dunning_records
  ADD COLUMN IF NOT EXISTS interest_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_days       INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_b2b              BOOLEAN        NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS base_rate_applied   NUMERIC(5, 4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_due           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legal_basis         VARCHAR(255);

-- Index für Performance bei automatischen Mahnlauf-Suchen
CREATE INDEX IF NOT EXISTS dunning_records_overdue_idx
  ON public.dunning_records (invoice_id, level, status)
  WHERE status IN ('sent', 'escalated');

COMMENT ON COLUMN public.dunning_records.interest_amount IS
  'Berechnete Verzugszinsen nach §288 BGB (B2C: Basis+5PP, B2B: Basis+9PP), ACT/360.';
COMMENT ON COLUMN public.dunning_records.is_b2b IS
  'TRUE für Unternehmen (§288 Abs. 2 BGB), FALSE für Verbraucher (§288 Abs. 1 BGB).';
COMMENT ON COLUMN public.dunning_records.total_due IS
  'principal + fee_amount + interest_amount — Anzeigewert im Mahnbrief.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. base_interest_rates (Bundesbank-Basiszinssatz §247 BGB)
-- ─────────────────────────────────────────────────────────────────────────────
-- Halbjährliche Änderung: 1. Januar und 1. Juli.
-- Quelle: https://www.bundesbank.de/de/statistiken/zinssaetze-und-renditen/
--         basiszinssatz/basiszinssatz-rede-der-bundesbank-607330

CREATE TABLE IF NOT EXISTS public.base_interest_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valid_from  DATE NOT NULL UNIQUE,           -- z.B. 2026-01-01, 2026-07-01
  rate        NUMERIC(5, 4) NOT NULL,         -- z.B. 0.0227 für 2,27 %
  source      VARCHAR(255),                   -- 'Bundesbank Q1/2026'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indizes für zeitscheibengenaue Lookups im Verzugszins-Rechner
CREATE INDEX IF NOT EXISTS base_interest_rates_valid_from_idx
  ON public.base_interest_rates (valid_from DESC);

COMMENT ON TABLE public.base_interest_rates IS
  'Halbjährliche Basiszinssätze gem. §247 BGB. Manuell/Cronjob pflegen.';

-- Seed mit aktuellen + historischen Werten (Stand Q1 2026)
INSERT INTO public.base_interest_rates (valid_from, rate, source) VALUES
  ('2024-07-01', 0.0337, 'Bundesbank H2/2024'),
  ('2025-01-01', 0.0238, 'Bundesbank H1/2025'),
  ('2025-07-01', 0.0153, 'Bundesbank H2/2025'),
  ('2026-01-01', 0.0119, 'Bundesbank H1/2026')
ON CONFLICT (valid_from) DO NOTHING;

-- RLS: Nur Owner/Superadmin lesen (technische Stammdaten)
ALTER TABLE public.base_interest_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY base_interest_rates_owner_all ON public.base_interest_rates
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'owner')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. board_decisions — Vereinsrecht-Beschlussdatenbank (BGB §§ 32, 33)
-- ─────────────────────────────────────────────────────────────────────────────
-- Erfasst Vorstands- und Mitgliederversammlungs-Beschlüsse digital mit
-- Abstimmungs-Ergebnis und Anwesenheits-Notiz.

CREATE TYPE public.decision_type AS ENUM (
  'vorstandsbeschluss',      -- §28 BGB (Vorstandsbeschluss)
  'mitgliederversammlung',   -- §32 BGB (Mitgliederversammlung)
  'ausschuss',               -- Sonst. Ausschuss (Jugend, Sport, etc.)
  'sonderbeschluss'          -- Ad-hoc Vereinsbeschluss
);

CREATE TYPE public.decision_status AS ENUM (
  'draft',                   -- Entwurf, noch nicht final
  'scheduled',               -- Geplant, Einladungen versendet
  'in_progress',             -- Versammlung läuft
  'completed',               -- Abgeschlossen
  'cancelled'                -- Abgesagt
);

CREATE TYPE public.decision_outcome AS ENUM (
  'approved',
  'rejected',
  'deferred',
  'withdrawn'
);

CREATE TABLE IF NOT EXISTS public.board_decisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  meeting_date  TIMESTAMPTZ,                   -- Datum der Versammlung (NULL = noch nicht abgehalten)
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  decision_type public.decision_type NOT NULL DEFAULT 'mitgliederversammlung',
  status        public.decision_status NOT NULL DEFAULT 'draft',
  outcome       public.decision_outcome,        -- Nur gesetzt wenn status = completed
  quorum_met    BOOLEAN,                        -- War das Quorum erreicht?
  votes_for     INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  votes_abstain INTEGER NOT NULL DEFAULT 0,
  attachments   JSONB,                          -- Array<{name, url, mimeType}> z.B. PDF der Niederschrift
  next_review   DATE,                          -- Nächste Wiedervorlage (für Vertagungen)
  created_by    UUID NOT NULL REFERENCES public.users(id),
  approved_by   UUID REFERENCES public.users(id), -- Vorstand/Notar (bei Mitgliederversammlung)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS board_decisions_club_idx        ON public.board_decisions (club_id);
CREATE INDEX IF NOT EXISTS board_decisions_status_idx     ON public.board_decisions (club_id, status);
CREATE INDEX IF NOT EXISTS board_decisions_meeting_idx    ON public.board_decisions (club_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS board_decisions_next_review_idx ON public.board_decisions (next_review)
  WHERE status = 'deferred'::public.decision_status;

COMMENT ON TABLE public.board_decisions IS
  'Digitale Beschlussdatenbank für Vereinsrecht-Compliance (BGB §§ 28, 32, 33).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. meeting_invitations — digitale Einladungen
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE public.invitation_status AS ENUM (
  'pending',        -- Versendet, noch keine Antwort
  'accepted',
  'declined',
  'tentative'       -- Vorbehaltlich
);

CREATE TABLE IF NOT EXISTS public.meeting_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.board_decisions(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      public.invitation_status NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  response_note TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminded_at TIMESTAMPTZ,
  UNIQUE(decision_id, member_id)
);

CREATE INDEX IF NOT EXISTS meeting_invitations_member_idx ON public.meeting_invitations (member_id);
CREATE INDEX IF NOT EXISTS meeting_invitations_status_idx ON public.meeting_invitations (decision_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. decision_votes — Abstimmungs-Protokoll (Auditability BGB §32 Abs. 2)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE public.vote_choice AS ENUM ('for', 'against', 'abstain');

CREATE TABLE IF NOT EXISTS public.decision_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.board_decisions(id) ON DELETE CASCADE,
  voter_id    UUID NOT NULL REFERENCES public.users(id),
  choice      public.vote_choice NOT NULL,
  voted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(decision_id, voter_id)
);

CREATE INDEX IF NOT EXISTS decision_votes_decision_idx ON public.decision_votes (decision_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS Policies für board_decisions / meeting_invitations / decision_votes
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.board_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_votes ENABLE ROW LEVEL SECURITY;

-- board_decisions: Admin (manage), Owner/Superadmin (all), Members (read completed)
CREATE POLICY board_decisions_admin_manage ON public.board_decisions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_club_memberships m
      WHERE m.user_id = auth.uid() AND m.club_id = board_decisions.club_id
        AND m.is_active = TRUE AND m.role IN ('owner', 'superadmin', 'admin')
    )
  );

CREATE POLICY board_decisions_member_read_completed ON public.board_decisions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_club_memberships m
      WHERE m.user_id = auth.uid() AND m.club_id = board_decisions.club_id
        AND m.is_active = TRUE
    )
    AND status = 'completed'::public.decision_status
    AND decision_type = 'mitgliederversammlung'::public.decision_type
  );

-- meeting_invitations: Admin can manage, Member sieht eigene Einladungen
CREATE POLICY meeting_invitations_admin_manage ON public.meeting_invitations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.board_decisions d
      JOIN public.user_club_memberships m ON m.user_id = auth.uid()
            AND m.club_id = d.club_id AND m.is_active = TRUE
            AND m.role IN ('owner', 'superadmin', 'admin')
      WHERE d.id = meeting_invitations.decision_id
    )
  );

CREATE POLICY meeting_invitations_member_read_own ON public.meeting_invitations
  FOR SELECT TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY meeting_invitations_member_update_own ON public.meeting_invitations
  FOR UPDATE TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- decision_votes: Voter sieht eigenen Vote, Admin sieht alle
CREATE POLICY decision_votes_voter_read_own ON public.decision_votes
  FOR SELECT TO authenticated
  USING (voter_id = auth.uid());

CREATE POLICY decision_votes_voter_insert_own ON public.decision_votes
  FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid());

CREATE POLICY decision_votes_voter_update_own ON public.decision_votes
  FOR UPDATE TO authenticated
  USING (voter_id = auth.uid());

CREATE POLICY decision_votes_admin_read_all ON public.decision_votes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.board_decisions d
      JOIN public.user_club_memberships m ON m.user_id = auth.uid()
            AND m.club_id = d.club_id AND m.is_active = TRUE
            AND m.role IN ('owner', 'superadmin', 'admin')
      WHERE d.id = decision_votes.decision_id
    )
  );
