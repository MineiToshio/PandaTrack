-- CreateEnum
CREATE TYPE "ImageIntakeEntrySource" AS ENUM ('IN_APP', 'SHARE');

-- CreateEnum
CREATE TYPE "ImageIntakeUsageStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "image_intake_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "entrySource" "ImageIntakeEntrySource" NOT NULL,
    "status" "ImageIntakeUsageStatus" NOT NULL,
    "imageCount" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costMicroUsd" INTEGER NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_intake_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "image_intake_usage_userId_periodKey_idx" ON "image_intake_usage"("userId", "periodKey");

-- CreateIndex
CREATE INDEX "image_intake_usage_periodKey_idx" ON "image_intake_usage"("periodKey");

-- AddForeignKey
ALTER TABLE "image_intake_usage" ADD CONSTRAINT "image_intake_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
