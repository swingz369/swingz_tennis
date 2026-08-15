-- Fix: trainer_profiles.user_id FK referenced auth.users instead of public.users
-- This prevented creating trainer profiles for users that exist in public.users
-- but not in auth.users (e.g., users created via admin onboarding or imports).

-- Drop the incorrect FK referencing auth.users
ALTER TABLE trainer_profiles DROP CONSTRAINT IF EXISTS trainer_profiles_user_id_fkey;

-- Re-create FK referencing public.users
ALTER TABLE trainer_profiles
  ADD CONSTRAINT trainer_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
