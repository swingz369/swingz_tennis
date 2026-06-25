-- Rename legacy plan names to new 4-tier scheme
-- solo_s / solo_l  = Einzelverein (admin-managed, by member count)
-- school_s / school_l = Tennisschule (superadmin-managed, by club count)

UPDATE users SET subscription_tier = 'solo_s' WHERE subscription_tier = 'starter';
UPDATE users SET subscription_tier = 'solo_l' WHERE subscription_tier = 'professional';
-- 'free' stays 'free'
