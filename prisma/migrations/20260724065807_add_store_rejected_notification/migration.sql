-- AlterEnum
ALTER TYPE "NotificationSubjectType" ADD VALUE 'STORE';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'STORE_REJECTED';

-- AlterTable
ALTER TABLE "notification_preference" ADD COLUMN     "storeRejectedEnabled" BOOLEAN NOT NULL DEFAULT true;
