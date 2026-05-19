-- AlterTable
ALTER TABLE "Order" ADD COLUMN "clientOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientOrderId_key" ON "Order"("clientOrderId");
