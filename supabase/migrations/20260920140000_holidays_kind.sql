-- Gesetzliche Feiertage neben Schulferien in derselben Tabelle.
-- Schulferien gelten wochenweise (Ferienpause), Feiertage nur tagesgenau —
-- deshalb die Unterscheidung. Bestehende Zeilen sind Schulferien.
ALTER TABLE public.school_holidays
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'school';

ALTER TABLE public.school_holidays
  DROP CONSTRAINT IF EXISTS school_holidays_kind_check;
ALTER TABLE public.school_holidays
  ADD CONSTRAINT school_holidays_kind_check CHECK (kind IN ('school', 'public'));

-- Ein Feiertag und ein Ferienblock gleichen Namens dürfen koexistieren.
ALTER TABLE public.school_holidays
  DROP CONSTRAINT IF EXISTS school_holidays_bundesland_name_year_key;
ALTER TABLE public.school_holidays
  ADD CONSTRAINT school_holidays_bundesland_kind_name_start_key
  UNIQUE (bundesland, kind, name, start_date);
