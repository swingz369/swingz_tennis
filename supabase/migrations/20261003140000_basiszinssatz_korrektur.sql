-- Basiszinssatz nach § 247 BGB korrigieren (Sentry JAVASCRIPT-NEXTJS-R/-S, 03.10.2026).
--
-- Die Zeilen ab 2025 wurden am 29.06.2026 von Hand eingetragen und waren falsch
-- (2,38 % / 1,53 % / 1,19 %), der Satz ab 01.07.2026 fehlte. Werte laut Bekanntgaben
-- der Deutschen Bundesbank:
--   01.01.2025: 2,27 %   01.07.2025: 1,27 %   01.01.2026: 1,27 % (unverändert)
--   01.07.2026: 1,52 %
-- Sie bestimmen die Verzugszinsen im Mahnwesen (§ 288 BGB: Basiszins + 5 bzw. 9 Pp.).
-- Auf leerer DB legt die Migration die Zeilen an, sonst überschreibt sie sie.

INSERT INTO public.base_interest_rates (valid_from, rate, source) VALUES
  ('2025-01-01', 0.0227, 'Deutsche Bundesbank, Bekanntgabe zum 1. Januar 2025'),
  ('2025-07-01', 0.0127, 'Deutsche Bundesbank, Bekanntgabe zum 1. Juli 2025'),
  ('2026-01-01', 0.0127, 'Deutsche Bundesbank, Bekanntgabe zum 1. Januar 2026'),
  ('2026-07-01', 0.0152, 'Deutsche Bundesbank, Bekanntgabe zum 1. Juli 2026')
ON CONFLICT (valid_from) DO UPDATE
  SET rate = EXCLUDED.rate, source = EXCLUDED.source;
