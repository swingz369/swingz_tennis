-- Add require_payment column to booking_rules if missing
ALTER TABLE public.booking_rules
  ADD COLUMN IF NOT EXISTS require_payment boolean NOT NULL DEFAULT false;
