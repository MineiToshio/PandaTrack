-- AlterTable
ALTER TABLE "store" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "store_isPrivate_idx" ON "store"("isPrivate");
