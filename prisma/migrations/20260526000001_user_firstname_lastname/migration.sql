-- Add firstName + lastName as required columns to User.
-- Default '' covers any users created during v1.1.0 dev testing; new signups
-- always supply non-empty values (enforced via Zod in the signup action).
-- Existing users with empty names will be prompted to complete their profile
-- on the /account page.

ALTER TABLE "User" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
