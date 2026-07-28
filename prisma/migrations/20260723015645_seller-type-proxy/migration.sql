-- Rename StoreType -> SellerType, BUSINESS -> RETAILER, add PROXY, rename Store.storeType -> Store.sellerType.
-- Hand-written because Prisma cannot detect enum value/type renames and would otherwise DROP+CREATE,
-- losing existing rows. These ALTERs preserve data: existing BUSINESS rows become RETAILER.
ALTER TYPE "StoreType" RENAME VALUE 'BUSINESS' TO 'RETAILER';
ALTER TYPE "StoreType" ADD VALUE 'PROXY';
ALTER TYPE "StoreType" RENAME TO "SellerType";
ALTER TABLE "store" RENAME COLUMN "storeType" TO "sellerType";
