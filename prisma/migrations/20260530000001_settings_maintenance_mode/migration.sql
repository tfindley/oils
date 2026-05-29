-- v1.4.x — Maintenance mode operator switch.
--
-- When true, proxy.ts rewrites all non-admin, non-asset, non-/api/auth,
-- non-/api/cron requests to /maintenance. The admin panel stays reachable
-- via /admin/login so the operator can flip it back off. API requests get
-- a 503 JSON response instead of the HTML page.
--
-- Pairs naturally with `legacyAdminEnabled` — both are operator escape
-- hatches that live on the Settings singleton row.

ALTER TABLE "Settings"
  ADD COLUMN "maintenanceMode" BOOLEAN NOT NULL DEFAULT false;
