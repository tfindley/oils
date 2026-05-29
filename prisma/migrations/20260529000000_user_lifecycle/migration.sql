-- v1.3.0 — Account lifecycle: inactivity-based purge with warning trail
-- and a per-user purge-exempt flag (admins now; paid tier later).
--
-- Purely additive. lastSignInAt is nullable so the cron treats it as
-- "no sign-in yet, falls back to createdAt" via an OR query.

ALTER TABLE "User"
  ADD COLUMN "lastSignInAt"            TIMESTAMP(3),
  ADD COLUMN "purgeExempt"             BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "purgeWarningSentAt"      TIMESTAMP(3),
  ADD COLUMN "purgeFinalWarningSentAt" TIMESTAMP(3);

-- Existing ADMIN-role users are exempt by default; a global admin shouldn't
-- get auto-purged for not signing in. New ADMINs (created in v1.3.1+) won't
-- get this automatically — admin can flip the exempt toggle in the UI.
UPDATE "User" SET "purgeExempt" = true WHERE "role" = 'ADMIN';

-- Index the cron's main filter column for fast scans.
CREATE INDEX "User_lastSignInAt_idx" ON "User"("lastSignInAt");
