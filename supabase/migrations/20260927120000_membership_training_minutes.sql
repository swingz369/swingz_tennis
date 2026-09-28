-- Individuelle Trainingsdauer je Spieler.
-- Die Saisonplanung leitete die Dauer bisher nur aus der Vereinseinstellung
-- (slot_duration_minutes) und dem Niveau ab (Leistungsgruppen: Doppelstunde).
-- In der Realität bekommen einzelne Spieler oder Gruppen mehr Zeit, ohne dass
-- sich das aus Niveau oder Alter ergibt. NULL = Vereinsstandard.
-- Wer denselben Wert hat, wird gemeinsam eingeplant — so entsteht auch eine
-- „lange Gruppe": alle ihre Mitglieder bekommen denselben Wert.
alter table public.user_club_memberships
  add column if not exists training_minutes integer
  check (training_minutes between 30 and 240);

comment on column public.user_club_memberships.training_minutes is
  'Trainingsdauer je Einheit in Minuten für die Saisonplanung; NULL = Vereinsstandard';
