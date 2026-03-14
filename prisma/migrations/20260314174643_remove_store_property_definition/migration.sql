/*
  Warnings:

  - You are about to drop the `store_property_definition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `store_property_definition_category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `store_property_value` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "store_property_definition_category" DROP CONSTRAINT "store_property_definition_category_categoryKey_fkey";

-- DropForeignKey
ALTER TABLE "store_property_definition_category" DROP CONSTRAINT "store_property_definition_category_propertyDefinitionId_fkey";

-- DropForeignKey
ALTER TABLE "store_property_value" DROP CONSTRAINT "store_property_value_propertyDefinitionId_fkey";

-- DropForeignKey
ALTER TABLE "store_property_value" DROP CONSTRAINT "store_property_value_storeId_fkey";

-- DropTable
DROP TABLE "store_property_definition";

-- DropTable
DROP TABLE "store_property_definition_category";

-- DropTable
DROP TABLE "store_property_value";

-- DropEnum
DROP TYPE "StorePropertyValueType";
