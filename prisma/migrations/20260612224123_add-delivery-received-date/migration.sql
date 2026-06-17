-- Add nullable received date to delivery (required when status becomes DELIVERED)
ALTER TABLE "delivery" ADD COLUMN "receivedDate" TIMESTAMP(3);
