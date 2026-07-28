-- CreateEnum
CREATE TYPE "StoreRemovalReason" AS ENUM ('DUPLICATE', 'CLOSED_OR_INACTIVE', 'FALSE_INFO', 'ABUSE');

-- AlterTable
ALTER TABLE "store" ADD COLUMN     "removalReason" "StoreRemovalReason";
