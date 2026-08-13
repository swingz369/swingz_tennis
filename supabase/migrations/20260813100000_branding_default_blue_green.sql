-- Branding-Default: Grün/Orange → Blau/Grün (Tennis-Blue/Green Rebrand)
--
-- Die Laufzeit-Tokens in app/globals.css (:root) sind bereits Blau/Grün,
-- aber der DB-Column-Default aus 20260613000000_branding_and_avatar.sql
-- füllt neue Vereine weiterhin mit dem alten Grün (#1B4332) — die
-- register-Route (`app/api/auth/register/route.ts`) legt Clubs ohne
-- Farbwerte an, der DB-Default greift. Damit der Code-Default
-- (lib/branding.ts DEFAULT_BRANDING) greift, werden die Column-Defaults
-- umgestellt und Vereine, die noch exakt auf dem alten Default-Triple
-- stehen (= nie angepasst), auf NULL zurückgesetzt. NULL fällt an allen
-- Lesestellen (`|| '#00599F'` etc.) auf den Blau/Grün-Default zurück.
--
-- Vereine, die mindestens eine Farbe aktiv geändert haben, bleiben unberührt.

ALTER TABLE clubs ALTER COLUMN primary_color SET DEFAULT '#00599F';
ALTER TABLE clubs ALTER COLUMN secondary_color SET DEFAULT '#22334F';
ALTER TABLE clubs ALTER COLUMN accent_color SET DEFAULT '#94C121';

UPDATE clubs
SET
  primary_color = NULL,
  secondary_color = NULL,
  accent_color = NULL
WHERE
  primary_color = '#1B4332'
  AND secondary_color = '#1e3a5f'
  AND accent_color = '#FF6B35';
