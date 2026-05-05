-- Remove foreign key constraint to allow flexibility
ALTER TABLE user_club_memberships DROP CONSTRAINT IF EXISTS user_club_memberships_user_id_users_id_fk;
