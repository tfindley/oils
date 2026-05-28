-- v1.2.0: Blend ownership + share toggle + anon-saves admin toggle.
-- All additive. Existing blends keep userId NULL (treated as anonymous —
-- reachable by URL forever, no owner, claimable by any authenticated user
-- who has the URL).

ALTER TABLE "Blend" ADD COLUMN "userId"   TEXT;
ALTER TABLE "Blend" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Blend_userId_idx" ON "Blend"("userId");

ALTER TABLE "Blend"
  ADD CONSTRAINT "Blend_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Admin toggle for anonymous saves; defaults on to preserve current behaviour.
ALTER TABLE "Settings" ADD COLUMN "allowAnonymousSaves" BOOLEAN NOT NULL DEFAULT true;
