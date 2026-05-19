-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'OPEN';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "tabName" TEXT;
