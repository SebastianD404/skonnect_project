-- Concurrent refreshes must run after the source-table transaction commits.
DROP TRIGGER IF EXISTS on_grantee_status_change ON "grantees";
DROP FUNCTION IF EXISTS refresh_inactive_grantees_view();
