-- Originally: ALTER TYPE planning_status ADD VALUE IF NOT EXISTS 'invoices_generated' AFTER 'manual_review';
--
-- Confirmed live (2026-07-04): seasons.planning_status is already varchar(30),
-- not the enum type this expected — it was widened by
-- 20260630120000_widen_planning_status_varchar.sql, which reached
-- production ahead of this file. `ALTER TYPE ... ADD VALUE` also cannot run
-- inside a transaction/DO block, so this is left as a documented no-op
-- rather than wrapped in a guard.
SELECT 1;
