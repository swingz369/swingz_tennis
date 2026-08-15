-- Feature-Keys aufgeräumt: `ai_matchmaking` hieß nach KI, war aber nie welche —
-- app/api/partner-finder/route.ts ist ein deterministischer Scorer (Spielniveau,
-- gemeinsame Gruppen, gemeinsame Trainingseinheiten). Neuer Key: `partner_finder`.
--
-- `smart_court` und `zapier_integration` entfallen ersatzlos: die Smart-Court-
-- Adapter haben nie ein Gerät angesprochen (nur ENV-Prüfung, Rückgabe true), die
-- Zapier-Route hatte keine Oberfläche. Beide Module sind aus dem Code entfernt;
-- der Restschlüssel in clubs.features würde sonst als toter Schalter weiterleben.

UPDATE clubs
SET features =
  CASE
    WHEN features ? 'ai_matchmaking'
      THEN jsonb_set(features, '{partner_finder}', features -> 'ai_matchmaking')
    ELSE features
  END
WHERE features ? 'ai_matchmaking';

UPDATE clubs
SET features = features - 'ai_matchmaking' - 'smart_court' - 'zapier_integration' - 'hardware_vendor'
WHERE features ?| ARRAY['ai_matchmaking', 'smart_court', 'zapier_integration', 'hardware_vendor'];
