-- Migration: Add extended profile fields to users table
-- Adds columns for address, emergency contact, bio, and date of birth

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS emergency_phone text;

COMMENT ON COLUMN public.users.address IS 'Straße und Hausnummer';
COMMENT ON COLUMN public.users.city IS 'Stadt';
COMMENT ON COLUMN public.users.postal_code IS 'Postleitzahl';
COMMENT ON COLUMN public.users.date_of_birth IS 'Geburtsdatum';
COMMENT ON COLUMN public.users.bio IS 'Kurzbeschreibung / Bio';
COMMENT ON COLUMN public.users.emergency_contact IS 'Name des Notfallkontakts';
COMMENT ON COLUMN public.users.emergency_phone IS 'Telefonnummer des Notfallkontakts';
