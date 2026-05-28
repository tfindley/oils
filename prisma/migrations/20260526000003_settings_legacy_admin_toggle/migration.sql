-- v1.2.1: Toggle to disable the legacy ADMIN_SECRET cookie path once a
-- user-based ADMIN account exists and is verified working.
-- Defaults to TRUE so existing deployments don't lock themselves out.

ALTER TABLE "Settings" ADD COLUMN "legacyAdminEnabled" BOOLEAN NOT NULL DEFAULT true;
