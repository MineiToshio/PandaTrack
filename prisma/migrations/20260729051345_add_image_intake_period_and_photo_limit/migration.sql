-- AlterTable
ALTER TABLE "user" ADD COLUMN     "aiMonthlyPhotoLimit" INTEGER;

-- CreateTable
CREATE TABLE "image_intake_period" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "usedPhotos" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_intake_period_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_intake_period_userId_periodKey_key" ON "image_intake_period"("userId", "periodKey");

-- CreateIndex
CREATE INDEX "image_intake_usage_userId_dayKey_idx" ON "image_intake_usage"("userId", "dayKey");

-- AddForeignKey
ALTER TABLE "image_intake_period" ADD CONSTRAINT "image_intake_period_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
