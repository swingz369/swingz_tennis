-- Sprint C: Add 45 missing foreign-key indexes
-- These indexes dramatically improve JOIN performance on wachsende Tabellen.
-- All are IF NOT EXISTS so re-running is safe.

-- background_jobs
CREATE INDEX IF NOT EXISTS idx_background_jobs_created_by ON public.background_jobs (created_by);

-- booking_rules
CREATE INDEX IF NOT EXISTS idx_booking_rules_club_id ON public.booking_rules (club_id);

-- bookings
CREATE INDEX IF NOT EXISTS idx_bookings_court_id ON public.bookings (court_id);
CREATE INDEX IF NOT EXISTS idx_bookings_schedule_id ON public.bookings (schedule_id);

-- coupons
CREATE INDEX IF NOT EXISTS idx_coupons_created_by ON public.coupons (created_by);

-- court_availability
CREATE INDEX IF NOT EXISTS idx_court_availability_court_id ON public.court_availability (court_id);

-- court_types
CREATE INDEX IF NOT EXISTS idx_court_types_club_id ON public.court_types (club_id);

-- courts
CREATE INDEX IF NOT EXISTS idx_courts_court_type_id ON public.courts (court_type_id);

-- email_campaigns / email_queue
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_by ON public.email_campaigns (created_by);
CREATE INDEX IF NOT EXISTS idx_email_queue_club_id ON public.email_queue (club_id);

-- family_invites
CREATE INDEX IF NOT EXISTS idx_family_invites_created_by ON public.family_invites (created_by);
CREATE INDEX IF NOT EXISTS idx_family_invites_used_by ON public.family_invites (used_by);

-- invoice_installments / invoices
CREATE INDEX IF NOT EXISTS idx_invoice_installments_payment_id ON public.invoice_installments (payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_season_id ON public.invoices (season_id);
CREATE INDEX IF NOT EXISTS idx_invoices_trainer_id ON public.invoices (trainer_id);

-- news_comments / news_posts
CREATE INDEX IF NOT EXISTS idx_news_comments_post_id ON public.news_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_user_id ON public.news_comments (user_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_author_id ON public.news_posts (author_id);

-- notifications / payments
CREATE INDEX IF NOT EXISTS idx_notifications_club_id ON public.notifications (club_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments (invoice_id);

-- planning_conflicts / pricing_rules
CREATE INDEX IF NOT EXISTS idx_planning_conflicts_resolved_by ON public.planning_conflicts (resolved_by);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_club_id ON public.pricing_rules (club_id);

-- qr_checkins / registration_requests
CREATE INDEX IF NOT EXISTS idx_qr_checkins_booking_id ON public.qr_checkins (booking_id);
CREATE INDEX IF NOT EXISTS idx_registration_requests_reviewed_by ON public.registration_requests (reviewed_by);

-- season_waitlists / seasons / system_settings
CREATE INDEX IF NOT EXISTS idx_season_waitlists_alternative_group_id ON public.season_waitlists (alternative_group_id);
CREATE INDEX IF NOT EXISTS idx_seasons_created_by ON public.seasons (created_by);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by ON public.system_settings (updated_by);

-- tournament_matches
CREATE INDEX IF NOT EXISTS idx_tournament_matches_court_id ON public.tournament_matches (court_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player1_id ON public.tournament_matches (player1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player2_id ON public.tournament_matches (player2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON public.tournament_matches (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_winner_id ON public.tournament_matches (winner_id);

-- tournament_registrations / tournaments
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_partner_id ON public.tournament_registrations (partner_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_club_id ON public.tournaments (club_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer_id ON public.tournaments (organizer_id);

-- trainer_absences / trainer_availability / trainer_feedback / trainers
CREATE INDEX IF NOT EXISTS idx_trainer_absences_approved_by ON public.trainer_absences (approved_by);
-- trainer_availability (singular) dropped as legacy — index skipped.
CREATE INDEX IF NOT EXISTS idx_trainer_feedback_group_id ON public.trainer_feedback (group_id);
CREATE INDEX IF NOT EXISTS idx_trainer_feedback_moderated_by ON public.trainer_feedback (moderated_by);
CREATE INDEX IF NOT EXISTS idx_trainers_user_id ON public.trainers (user_id);

-- training_groups / user_club_memberships / waitlist_entries
CREATE INDEX IF NOT EXISTS idx_training_groups_schedule_id ON public.training_groups (schedule_id);
CREATE INDEX IF NOT EXISTS idx_user_club_memberships_deactivated_by ON public.user_club_memberships (deactivated_by);
CREATE INDEX IF NOT EXISTS idx_user_club_memberships_fee_configuration_id ON public.user_club_memberships (fee_configuration_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_club_id ON public.waitlist_entries (club_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_court_id ON public.waitlist_entries (court_id);
