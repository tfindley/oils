-- v1.4.x — Per-user currency preference + bottle-size context for cost
--
-- Currency: stored as ISO 4217 code on User. Defaults to GBP for back-compat
-- with the v1.4.0 hardcoded "£". Users in other countries pick their own
-- currency in /account → Profile. UI formats costs via Intl.NumberFormat.
--
-- Bottle size: lets the user record cost + size together ("£12.50 for 30 ml"),
-- which gives a real per-ml unit so future cost-per-blend computations are
-- meaningful. Optional — collections without a bottle size still work, the
-- cost just sits without a unit reference.

ALTER TABLE "User"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GBP';

ALTER TABLE "UserOilCollection"
  ADD COLUMN "bottleSizeMl" DOUBLE PRECISION;
