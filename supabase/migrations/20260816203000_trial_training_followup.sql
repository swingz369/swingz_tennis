-- Probetraining Nurture-Flow: Nach einem abgeschlossenen Probetraining
-- verschickt ein Cron automatisierte Follow-up-Mails (Danke → Erinnerung →
-- letzter Anstoß). Dafür braucht `trial_trainings` den Abschlusszeitpunkt
-- und eine Stufenmarke, damit jede Mail genau einmal rausgeht.
ALTER TABLE public.trial_trainings
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_stage integer NOT NULL DEFAULT 0;
