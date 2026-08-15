-- Migration: Fix 22 FK constraints that incorrectly reference auth.users instead of public.users
-- All referenced user_ids were verified to exist in public.users (migration safety check passed).
--
-- These constraints were likely created by Supabase's default schema or manual SQL
-- that referenced auth.users(id) instead of public.users(id).
-- The Drizzle ORM schema already correctly references users.id (= public.users).

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. bookings.member_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_member_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 2. invoices.member_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_member_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 3. invoices.trainer_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_trainer_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_trainer_id_fkey
  FOREIGN KEY (trainer_id) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 4. news_comments.user_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.news_comments DROP CONSTRAINT IF EXISTS news_comments_user_id_fkey;
ALTER TABLE public.news_comments ADD CONSTRAINT news_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 5. news_posts.author_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.news_posts DROP CONSTRAINT IF EXISTS news_posts_author_id_fkey;
ALTER TABLE public.news_posts ADD CONSTRAINT news_posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 6. notifications.user_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 7. system_settings.updated_by → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;
ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 8. tournament_matches.player1_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_player1_id_fkey;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_player1_id_fkey
  FOREIGN KEY (player1_id) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 9. tournament_matches.player2_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_player2_id_fkey;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_player2_id_fkey
  FOREIGN KEY (player2_id) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 10. tournament_matches.winner_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_winner_id_fkey;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_winner_id_fkey
  FOREIGN KEY (winner_id) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 11. tournament_registrations.partner_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.tournament_registrations DROP CONSTRAINT IF EXISTS tournament_registrations_partner_id_fkey;
ALTER TABLE public.tournament_registrations ADD CONSTRAINT tournament_registrations_partner_id_fkey
  FOREIGN KEY (partner_id) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 12. tournament_registrations.user_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.tournament_registrations DROP CONSTRAINT IF EXISTS tournament_registrations_user_id_fkey;
ALTER TABLE public.tournament_registrations ADD CONSTRAINT tournament_registrations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 13. tournaments.organizer_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_organizer_id_fkey;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_organizer_id_fkey
  FOREIGN KEY (organizer_id) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 14. trainer_absences.approved_by → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.trainer_absences DROP CONSTRAINT IF EXISTS trainer_absences_approved_by_fkey;
ALTER TABLE public.trainer_absences ADD CONSTRAINT trainer_absences_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES public.users(id);

-- 15. trainer_availability (singular) was dropped as legacy/dead in
--     20260605020000_drop_legacy_trainer_tables.sql — no FK to fix here.

-- ═══════════════════════════════════════════════════════════════
-- 16. trainer_feedback.member_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.trainer_feedback DROP CONSTRAINT IF EXISTS trainer_feedback_member_id_fkey;
ALTER TABLE public.trainer_feedback ADD CONSTRAINT trainer_feedback_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 17. trainer_feedback.trainer_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.trainer_feedback DROP CONSTRAINT IF EXISTS trainer_feedback_trainer_id_fkey;
ALTER TABLE public.trainer_feedback ADD CONSTRAINT trainer_feedback_trainer_id_fkey
  FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 18. trainer_feedback.moderated_by → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.trainer_feedback DROP CONSTRAINT IF EXISTS trainer_feedback_moderated_by_fkey;
ALTER TABLE public.trainer_feedback ADD CONSTRAINT trainer_feedback_moderated_by_fkey
  FOREIGN KEY (moderated_by) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 19. trainer_rating_summary.trainer_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.trainer_rating_summary DROP CONSTRAINT IF EXISTS trainer_rating_summary_trainer_id_fkey;
ALTER TABLE public.trainer_rating_summary ADD CONSTRAINT trainer_rating_summary_trainer_id_fkey
  FOREIGN KEY (trainer_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 20. trainers.user_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.trainers DROP CONSTRAINT IF EXISTS trainers_user_id_fkey;
ALTER TABLE public.trainers ADD CONSTRAINT trainers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 21. user_club_memberships.deactivated_by → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.user_club_memberships DROP CONSTRAINT IF EXISTS user_club_memberships_deactivated_by_fkey;
ALTER TABLE public.user_club_memberships ADD CONSTRAINT user_club_memberships_deactivated_by_fkey
  FOREIGN KEY (deactivated_by) REFERENCES public.users(id);

-- ═══════════════════════════════════════════════════════════════
-- 22. waitlist_entries.user_id → public.users(id)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.waitlist_entries DROP CONSTRAINT IF EXISTS waitlist_entries_user_id_fkey;
ALTER TABLE public.waitlist_entries ADD CONSTRAINT waitlist_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

COMMIT;
