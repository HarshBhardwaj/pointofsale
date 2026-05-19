-- AlterTable
ALTER TABLE "Order" ADD COLUMN "kitchenQueuedAt" TIMESTAMP(3),
ADD COLUMN "kitchenStartedAt" TIMESTAMP(3),
ADD COLUMN "kitchenCompletedAt" TIMESTAMP(3);
