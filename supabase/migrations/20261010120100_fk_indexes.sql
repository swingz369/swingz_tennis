-- Fehlende Indizes auf Fremdschlüsseln, über die gefiltert wird (club_id in RLS-Policies und
-- Listenabfragen, Eltern-IDs in Detailansichten). Audit-Spalten wie created_by bleiben ohne —
-- die werden nur beim Löschen eines Nutzers abgesucht.
CREATE INDEX IF NOT EXISTS idx_club_documents_club_id ON public.club_documents (club_id);
CREATE INDEX IF NOT EXISTS idx_court_maintenance_club_id ON public.court_maintenance (club_id);
CREATE INDEX IF NOT EXISTS idx_court_maintenance_court_id ON public.court_maintenance (court_id);
CREATE INDEX IF NOT EXISTS idx_match_caterings_club_id ON public.match_caterings (club_id);
CREATE INDEX IF NOT EXISTS idx_member_meetings_club_id ON public.member_meetings (club_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_news_post_id ON public.news_comments (news_post_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_club_id ON public.newsletter_campaigns (club_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_send_logs_campaign_id ON public.newsletter_send_logs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_open_matches_court_id ON public.open_matches (court_id);
CREATE INDEX IF NOT EXISTS idx_season_plan_versions_club_id ON public.season_plan_versions (club_id);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_user_id ON public.tournament_registrations (user_id);
CREATE INDEX IF NOT EXISTS idx_trainer_member_notes_club_id ON public.trainer_member_notes (club_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_reply_to_id ON public.conversation_messages (reply_to_id);
