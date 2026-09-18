-- pricing_rules: Spalten ergänzen, die Code und Admin-Oberfläche erwarten.
-- Die Baseline-Tabelle hatte nur das Rumpfmodell (name, price_per_hour, time_ranges, ...);
-- Platz-Bezug, Buchungsdauer, Vorlauf, Zielgruppen und Priorität fehlten, jede Abfrage
-- des PricingRuleRepository scheiterte mit "column court_id does not exist".
-- Rein additiv, mit Defaults — bestehende Zeilen bleiben gültig. RLS unverändert
-- (admins_manage_pricing / club_members_see_pricing, beide über club_id).
ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS court_id uuid REFERENCES public.courts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS min_booking_hours numeric(5,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_booking_hours numeric(5,2) DEFAULT 4,
  ADD COLUMN IF NOT EXISTS advance_booking_days integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS applies_to_member_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applies_to_groups jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS pricing_rules_court_idx ON public.pricing_rules (court_id);
CREATE INDEX IF NOT EXISTS pricing_rules_club_priority_idx ON public.pricing_rules (club_id, priority);
