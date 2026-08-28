-- CreateEnum
CREATE TYPE "PointLedgerSource" AS ENUM ('LIVE', 'BACKFILL');

-- CreateTable
CREATE TABLE "point_ledger_entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "source" "PointLedgerSource" NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedReason" TEXT,
    "voidedByUserId" TEXT,

    CONSTRAINT "point_ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progress" (
    "userId" TEXT NOT NULL,
    "maturedPoints" INTEGER NOT NULL DEFAULT 0,
    "rankIndex" INTEGER NOT NULL DEFAULT 1,
    "highestRankIndex" INTEGER NOT NULL DEFAULT 1,
    "lastRecomputedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_progress_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "medal_unlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medalKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL,
    "seenAt" TIMESTAMP(3),
    "series" TEXT NOT NULL,
    "numbered" BOOLEAN NOT NULL DEFAULT false,
    "rarity" TEXT NOT NULL,
    "serialNumber" INTEGER,
    "source" "PointLedgerSource" NOT NULL DEFAULT 'LIVE',

    CONSTRAINT "medal_unlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progression_settings" (
    "userId" TEXT NOT NULL,
    "hideProgression" BOOLEAN NOT NULL DEFAULT false,
    "lastCelebratedRankIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "progression_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "point_ledger_entry_userId_idx" ON "point_ledger_entry"("userId");

-- CreateIndex
CREATE INDEX "point_ledger_entry_voidedAt_idx" ON "point_ledger_entry"("voidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "point_ledger_entry_userId_ruleKey_entityId_key" ON "point_ledger_entry"("userId", "ruleKey", "entityId");

-- CreateIndex
CREATE INDEX "medal_unlock_userId_idx" ON "medal_unlock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "medal_unlock_userId_medalKey_key" ON "medal_unlock"("userId", "medalKey");

-- AddForeignKey
ALTER TABLE "point_ledger_entry" ADD CONSTRAINT "point_ledger_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medal_unlock" ADD CONSTRAINT "medal_unlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progression_settings" ADD CONSTRAINT "progression_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
