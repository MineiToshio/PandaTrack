-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('BUSINESS', 'PERSON');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "StoreVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "StorePresenceType" AS ENUM ('ONLINE', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "StoreContactChannelType" AS ENUM ('INSTAGRAM', 'WHATSAPP', 'EMAIL', 'PHONE', 'WEBSITE', 'FACEBOOK', 'TIKTOK', 'OTHER');

-- CreateEnum
CREATE TYPE "StorePropertyValueType" AS ENUM ('TEXT', 'BOOLEAN', 'NUMBER', 'JSON');

-- CreateEnum
CREATE TYPE "StoreCategoryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StoreReportReason" AS ENUM ('SPAM', 'DUPLICATE', 'INCORRECT_INFO', 'DOES_NOT_EXIST', 'INAPPROPRIATE');

-- CreateEnum
CREATE TYPE "StoreReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "StoreChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "country" (
    "code" TEXT NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "store" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "storeType" "StoreType" NOT NULL,
    "status" "StoreStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "StoreVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasStock" BOOLEAN,
    "receivesOrders" BOOLEAN,
    "countryCode" TEXT NOT NULL,
    "averageRating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_presence" (
    "storeId" TEXT NOT NULL,
    "presenceType" "StorePresenceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_presence_pkey" PRIMARY KEY ("storeId","presenceType")
);

-- CreateTable
CREATE TABLE "store_contact_channel" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "StoreContactChannelType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "customTypeLabel" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_contact_channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_address" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "city" TEXT,
    "district" TEXT,
    "addressLine" TEXT NOT NULL,
    "reference" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_import_country" (
    "storeId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_import_country_pkey" PRIMARY KEY ("storeId","countryCode")
);

-- CreateTable
CREATE TABLE "store_category" (
    "key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_category_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "store_category_assignment" (
    "storeId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_category_assignment_pkey" PRIMARY KEY ("storeId","categoryKey")
);

-- CreateTable
CREATE TABLE "store_property_definition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "valueType" "StorePropertyValueType" NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_property_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_property_definition_category" (
    "propertyDefinitionId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,

    CONSTRAINT "store_property_definition_category_pkey" PRIMARY KEY ("propertyDefinitionId","categoryKey")
);

-- CreateTable
CREATE TABLE "store_property_value" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "propertyDefinitionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueBoolean" BOOLEAN,
    "valueNumber" DOUBLE PRECISION,
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_property_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_review" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "communicationRating" INTEGER,
    "packingRating" INTEGER,
    "deliveryReliabilityRating" INTEGER,
    "wouldBuyAgain" BOOLEAN,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_note" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_report" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "reason" "StoreReportReason" NOT NULL,
    "details" TEXT,
    "status" "StoreReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_category_request" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "suggestedKey" TEXT,
    "suggestedName" TEXT NOT NULL,
    "reason" TEXT,
    "status" "StoreCategoryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_category_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_change_request" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "StoreChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "changes" JSONB NOT NULL,
    "comment" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_change_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_order_item" (
    "deliveryId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_order_item_pkey" PRIMARY KEY ("deliveryId","orderItemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_slug_key" ON "store"("slug");

-- CreateIndex
CREATE INDEX "store_countryCode_idx" ON "store"("countryCode");

-- CreateIndex
CREATE INDEX "store_createdByUserId_idx" ON "store"("createdByUserId");

-- CreateIndex
CREATE INDEX "store_approvedByUserId_idx" ON "store"("approvedByUserId");

-- CreateIndex
CREATE INDEX "store_status_idx" ON "store"("status");

-- CreateIndex
CREATE INDEX "store_visibility_idx" ON "store"("visibility");

-- CreateIndex
CREATE INDEX "store_isActive_idx" ON "store"("isActive");

-- CreateIndex
CREATE INDEX "store_status_visibility_isActive_idx" ON "store"("status", "visibility", "isActive");

-- CreateIndex
CREATE INDEX "store_presence_presenceType_idx" ON "store_presence"("presenceType");

-- CreateIndex
CREATE INDEX "store_contact_channel_storeId_idx" ON "store_contact_channel"("storeId");

-- CreateIndex
CREATE INDEX "store_contact_channel_type_idx" ON "store_contact_channel"("type");

-- CreateIndex
CREATE INDEX "store_address_storeId_idx" ON "store_address"("storeId");

-- CreateIndex
CREATE INDEX "store_address_countryCode_idx" ON "store_address"("countryCode");

-- CreateIndex
CREATE INDEX "store_import_country_countryCode_idx" ON "store_import_country"("countryCode");

-- CreateIndex
CREATE INDEX "store_category_assignment_categoryKey_idx" ON "store_category_assignment"("categoryKey");

-- CreateIndex
CREATE UNIQUE INDEX "store_property_definition_key_key" ON "store_property_definition"("key");

-- CreateIndex
CREATE INDEX "store_property_definition_category_categoryKey_idx" ON "store_property_definition_category"("categoryKey");

-- CreateIndex
CREATE INDEX "store_property_value_propertyDefinitionId_idx" ON "store_property_value"("propertyDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "store_property_value_storeId_propertyDefinitionId_key" ON "store_property_value"("storeId", "propertyDefinitionId");

-- CreateIndex
CREATE INDEX "store_review_userId_idx" ON "store_review"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "store_review_storeId_userId_key" ON "store_review"("storeId", "userId");

-- CreateIndex
CREATE INDEX "store_note_storeId_idx" ON "store_note"("storeId");

-- CreateIndex
CREATE INDEX "store_note_userId_idx" ON "store_note"("userId");

-- CreateIndex
CREATE INDEX "store_report_storeId_idx" ON "store_report"("storeId");

-- CreateIndex
CREATE INDEX "store_report_reportedById_idx" ON "store_report"("reportedById");

-- CreateIndex
CREATE INDEX "store_report_status_idx" ON "store_report"("status");

-- CreateIndex
CREATE INDEX "store_category_request_requestedById_idx" ON "store_category_request"("requestedById");

-- CreateIndex
CREATE INDEX "store_category_request_status_idx" ON "store_category_request"("status");

-- CreateIndex
CREATE INDEX "store_change_request_storeId_idx" ON "store_change_request"("storeId");

-- CreateIndex
CREATE INDEX "store_change_request_requestedById_idx" ON "store_change_request"("requestedById");

-- CreateIndex
CREATE INDEX "store_change_request_status_idx" ON "store_change_request"("status");

-- CreateIndex
CREATE INDEX "order_storeId_idx" ON "order"("storeId");

-- CreateIndex
CREATE INDEX "order_userId_idx" ON "order"("userId");

-- CreateIndex
CREATE INDEX "order_item_orderId_idx" ON "order_item"("orderId");

-- CreateIndex
CREATE INDEX "delivery_storeId_idx" ON "delivery"("storeId");

-- CreateIndex
CREATE INDEX "delivery_order_item_orderItemId_idx" ON "delivery_order_item"("orderItemId");

-- AddForeignKey
ALTER TABLE "store" ADD CONSTRAINT "store_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store" ADD CONSTRAINT "store_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store" ADD CONSTRAINT "store_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_presence" ADD CONSTRAINT "store_presence_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_contact_channel" ADD CONSTRAINT "store_contact_channel_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_address" ADD CONSTRAINT "store_address_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_address" ADD CONSTRAINT "store_address_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_import_country" ADD CONSTRAINT "store_import_country_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_import_country" ADD CONSTRAINT "store_import_country_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_category_assignment" ADD CONSTRAINT "store_category_assignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_category_assignment" ADD CONSTRAINT "store_category_assignment_categoryKey_fkey" FOREIGN KEY ("categoryKey") REFERENCES "store_category"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_property_definition_category" ADD CONSTRAINT "store_property_definition_category_propertyDefinitionId_fkey" FOREIGN KEY ("propertyDefinitionId") REFERENCES "store_property_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_property_definition_category" ADD CONSTRAINT "store_property_definition_category_categoryKey_fkey" FOREIGN KEY ("categoryKey") REFERENCES "store_category"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_property_value" ADD CONSTRAINT "store_property_value_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_property_value" ADD CONSTRAINT "store_property_value_propertyDefinitionId_fkey" FOREIGN KEY ("propertyDefinitionId") REFERENCES "store_property_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_review" ADD CONSTRAINT "store_review_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_review" ADD CONSTRAINT "store_review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_note" ADD CONSTRAINT "store_note_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_note" ADD CONSTRAINT "store_note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_report" ADD CONSTRAINT "store_report_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_report" ADD CONSTRAINT "store_report_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_category_request" ADD CONSTRAINT "store_category_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_change_request" ADD CONSTRAINT "store_change_request_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_change_request" ADD CONSTRAINT "store_change_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_change_request" ADD CONSTRAINT "store_change_request_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_order_item" ADD CONSTRAINT "delivery_order_item_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_order_item" ADD CONSTRAINT "delivery_order_item_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
