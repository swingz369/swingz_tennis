-- Admin muss festlegen können, welche Plätze für die Trainingsplanung (Saisonplanung) nutzbar sind.
-- Default true: bestehende Plätze bleiben wie bisher für die Planung verfügbar.
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS usable_for_training boolean NOT NULL DEFAULT true;
