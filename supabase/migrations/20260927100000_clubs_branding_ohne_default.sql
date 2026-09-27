-- Vereinsfarben: NULL heißt „kein eigenes Branding, App-Palette gilt" (ADR-007).
-- Bisher schrieb der Spalten-Default das alte Logo-Blau in jeden Verein, und
-- app/(protected)/layout.tsx legte es als :root-Override über die Theme-Token —
-- in beiden Themes gleich. Werte, die exakt dem alten Default entsprechen, hat
-- niemand gewählt; sie werden zurückgesetzt.
ALTER TABLE public.clubs ALTER COLUMN primary_color DROP DEFAULT;
ALTER TABLE public.clubs ALTER COLUMN secondary_color DROP DEFAULT;
ALTER TABLE public.clubs ALTER COLUMN accent_color DROP DEFAULT;

UPDATE public.clubs SET primary_color = NULL WHERE upper(primary_color) = '#00599F';
UPDATE public.clubs SET secondary_color = NULL WHERE upper(secondary_color) = '#22334F';
UPDATE public.clubs SET accent_color = NULL WHERE upper(accent_color) = '#94C121';
