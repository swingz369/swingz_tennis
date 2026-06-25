-- =============================================================================
-- Migration: decision_changes Audit-Log (BGB §32 Abs. 2 Abstimmungs-Protokoll)
-- =============================================================================
-- Datum:       2026-06-24
-- Beschreibung: Append-only Audit-Tabelle speziell für board_decisions.
--              Erfasst INSERT/UPDATE/FINALIZE/CANCEL-Aktionen mit alten +
--              neuen Werten (jsonb) und Actor.
--
-- GDPR-Hinweis (Art. 17 DSGVO): Audit-Logs sind eine gesetzliche Aufbewah-
-- rungspflicht (BGB §32 Abs. 2 Protokollierungspflicht) und können auch
-- nach Löschung des beschlossenen Mitglieds fortbestehen. Wir speichern
-- daher einen actor_label_snapshot (Anzeigename zum Zeitpunkt der Aktion),
-- damit der Kontext nach User-Löschung erhalten bleibt.
-- =============================================================================

-- Achtung Reihenfolge: muss mit lib/decisions/decision.service.ts
-- ChangeRecord['action'] übereinstimmen. 'attachment_added' wurde entfernt,
-- weil es im aktuellen Service nicht verwendet wird (TODO: Anhänge-Feature).
CREATE TYPE public.decision_change_action AS ENUM (
  'created',             -- Neueintrag
  'updated',             -- Allgemeines Update (Titel, Beschreibung, Datum)
  'status_changed',      -- Statusübergang (draft → scheduled → in_progress → …)
  'finalized',           -- completed + outcome + quorum_met gesetzt
  'cancelled',           -- expliziter Abbruch
  'invitation_sent',     -- meeting_invitations Massen-Insert
  'invitation_response', -- Ein Mitglied hat geantwortet
  'vote_cast'            -- Stimme abgegeben (Upsert)
);

CREATE TABLE IF NOT EXISTS public.decision_changes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id         UUID NOT NULL REFERENCES public.board_decisions(id) ON DELETE CASCADE,
  action              public.decision_change_action NOT NULL,
  -- actor_id NULL-fähig + ON DELETE SET NULL: User-Löschung (DSGVO Art. 17)
  -- blockiert nicht die Audit-Log-Persistenz. Kontext bleibt via actor_label_snapshot.
  actor_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_label_snapshot TEXT,                       -- Anzeigename zum Audit-Zeitpunkt (GDPR-fest)
  old_values          JSONB,                       -- Snapshot VOR der Änderung (NULL bei INSERT)
  new_values          JSONB,                       -- Snapshot NACH der Änderung
  details             JSONB,                       -- Freitext: { notes, ip, user_agent }
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tab-Log Pattern: rasche Nachvollziehbarkeit
CREATE INDEX IF NOT EXISTS decision_changes_decision_idx
  ON public.decision_changes (decision_id, created_at DESC);

CREATE INDEX IF NOT EXISTS decision_changes_actor_idx
  ON public.decision_changes (actor_id);

CREATE INDEX IF NOT EXISTS decision_changes_action_idx
  ON public.decision_changes (action);

COMMENT ON TABLE public.decision_changes IS
  'Append-only Audit-Log für board_decisions. BGB §32 Abs. 2: Protokollierungspflicht.';
COMMENT ON COLUMN public.decision_changes.old_values IS
  'Vollständiger Zustand des Beschlusses VOR der Änderung (NULL bei INSERT).';
COMMENT ON COLUMN public.decision_changes.new_values IS
  'Vollständiger Zustand des Beschlusses NACH der Änderung.';
COMMENT ON COLUMN public.decision_changes.details IS
  'Optionale Kontextdaten: user_agent, ip_address, notes, etc.';
COMMENT ON COLUMN public.decision_changes.actor_id IS
  'Optional: User-UUID. Null = System-/Cronjob-Aktion oder nach DSGVO-Löschung anonymisiert.';
COMMENT ON COLUMN public.decision_changes.actor_label_snapshot IS
  'Anzeigename des Actors zum Audit-Zeitpunkt. Bleibt erhalten, auch wenn User gelöscht wird (DSGVO-konformer Audit-Trail).';

-- RLS
ALTER TABLE public.decision_changes ENABLE ROW LEVEL SECURITY;

-- Lese-Policy: Admin des jeweiligen Clubs + Owner
CREATE POLICY decision_changes_club_read ON public.decision_changes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.board_decisions d
      JOIN public.user_club_memberships m
        ON m.user_id = auth.uid() AND m.club_id = d.club_id
           AND m.is_active = TRUE
           AND m.role IN ('owner', 'superadmin', 'admin')
      WHERE d.id = decision_changes.decision_id
    )
  );

-- Schreib-Policy: authenticated Users mit Admin-Rolle dürfen einfügen
-- (z.B. wenn Beschluss-Detailseite selbst Daten patcht + protokollieren will).
-- Service-Client (Bypass) ist ebenfalls zulässig — Frontend-Routen operieren
-- im Admin-Kontext und sind durch RLS geschützt.
CREATE POLICY decision_changes_admin_insert ON public.decision_changes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.board_decisions d
      JOIN public.user_club_memberships m
        ON m.user_id = auth.uid() AND m.club_id = d.club_id
           AND m.is_active = TRUE
           AND m.role IN ('owner', 'superadmin', 'admin')
      WHERE d.id = decision_changes.decision_id
    )
  );

-- Hardening: actor_id muss aktives Mitglied des Beschluss-Vereins sein
-- (wenn nicht NULL → System-Aktion). Schützt vor Actor-Impersonation.
CREATE OR REPLACE FUNCTION public.decision_changes_validate_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_club_id UUID;
BEGIN
  SELECT d.club_id INTO v_club_id
  FROM public.board_decisions d
  WHERE d.id = NEW.decision_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'decision_changes: Beschluss % existiert nicht', NEW.decision_id;
  END IF;

  -- Wenn actor_id NULL → System-/Cron-/anonymisierte Aktion → erlaubt.
  IF NEW.actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_club_memberships m
    WHERE m.user_id = NEW.actor_id
      AND m.club_id = v_club_id
      AND m.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'decision_changes: actor_id % ist kein aktives Mitglied von Club %',
      NEW.actor_id, v_club_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decision_changes_validate_actor ON public.decision_changes;
CREATE TRIGGER trg_decision_changes_validate_actor
  BEFORE INSERT ON public.decision_changes
  FOR EACH ROW
  EXECUTE FUNCTION public.decision_changes_validate_actor();

-- Kein UPDATE / DELETE Policy definiert (append-only via RLS)
