-- Vereinsweite Mitgliedsnummer ("Kundennummer").
-- Pro Verein fortlaufend ab 1, eindeutig je Verein, unveränderlich nach Vergabe.
-- Bewusst KEIN globaler Zähler: ein Mitglied in zwei Vereinen hat dort zwei Nummern.

-- Zähler je Verein. Nur der Trigger unten schreibt darauf.
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS next_member_number integer NOT NULL DEFAULT 1;

ALTER TABLE user_club_memberships
  ADD COLUMN IF NOT EXISTS member_number integer;

-- Bestand nachnummerieren: je Verein nach Beitrittsdatum.
WITH numbered AS (
  SELECT id,
         row_number() OVER (PARTITION BY club_id ORDER BY joined_at, created_at, id) AS rn
  FROM user_club_memberships
)
UPDATE user_club_memberships m
SET member_number = n.rn
FROM numbered n
WHERE n.id = m.id
  AND m.member_number IS NULL;

UPDATE clubs c
SET next_member_number = COALESCE(
  (SELECT max(member_number) + 1 FROM user_club_memberships WHERE club_id = c.id),
  1
);

CREATE UNIQUE INDEX IF NOT EXISTS user_club_memberships_club_member_number_uq
  ON user_club_memberships (club_id, member_number);

-- SECURITY DEFINER, weil die RLS auf `clubs` einem Mitglied kein UPDATE erlaubt —
-- ohne das schlüge jeder Membership-INSERT aus User-Kontext (Onboarding, Selbst-
-- registrierung) am Zähler fehl.
CREATE OR REPLACE FUNCTION assign_member_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.member_number IS NULL THEN
    -- UPDATE ... RETURNING sperrt die Club-Zeile: pro Verein serialisiert,
    -- damit keine zwei parallelen INSERTs dieselbe Nummer ziehen.
    UPDATE clubs
    SET next_member_number = next_member_number + 1
    WHERE id = NEW.club_id
    RETURNING next_member_number - 1 INTO NEW.member_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_member_number ON user_club_memberships;
CREATE TRIGGER trg_assign_member_number
  BEFORE INSERT ON user_club_memberships
  FOR EACH ROW
  EXECUTE FUNCTION assign_member_number();

COMMENT ON COLUMN user_club_memberships.member_number IS
  'Vereinsweit fortlaufende Mitgliedsnummer, vergeben durch assign_member_number(). Nicht ändern, nicht wiederverwenden.';
