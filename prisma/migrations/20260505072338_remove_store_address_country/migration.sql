-- DropForeignKey
ALTER TABLE "store_address" DROP CONSTRAINT "store_address_countryCode_fkey";

-- DropIndex
DROP INDEX "store_address_countryCode_idx";

-- AlterTable
ALTER TABLE "store_address" DROP COLUMN "countryCode";
