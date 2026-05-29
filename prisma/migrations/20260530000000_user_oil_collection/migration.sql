-- v1.4.0 — Personal oil collection
--
-- Tracks which oils a user owns plus inventory metadata: remaining quantity,
-- opened-at (drives expiry warnings via Oil.shelfLifeMonths for carriers),
-- explicit expiry date, supplier, cost, batch number, freeform notes.
--
-- Cascade: deleting a user wipes their collection.
-- Restrict: an oil cannot be deleted from the public library while any user
-- has it in their collection (admin must rebuild or migrate first).

CREATE TABLE "UserOilCollection" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "oilId"     TEXT NOT NULL,
  "quantity"  DOUBLE PRECISION,
  "openedAt"  TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "supplier"  TEXT,
  "cost"      DOUBLE PRECISION,
  "batchNo"   TEXT,
  "notes"     TEXT,
  "addedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserOilCollection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserOilCollection_userId_oilId_key"
  ON "UserOilCollection"("userId", "oilId");

CREATE INDEX "UserOilCollection_userId_idx"
  ON "UserOilCollection"("userId");

ALTER TABLE "UserOilCollection"
  ADD CONSTRAINT "UserOilCollection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserOilCollection"
  ADD CONSTRAINT "UserOilCollection_oilId_fkey"
  FOREIGN KEY ("oilId") REFERENCES "Oil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
