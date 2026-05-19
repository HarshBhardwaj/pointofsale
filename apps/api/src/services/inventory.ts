import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

/** Deduct sold quantities from product stock when an order is paid. */
export async function deductInventoryForOrder(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { productId: true, quantity: true },
  });

  for (const item of items) {
    const productId = item.productId;
    if (productId == null) continue;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stockQty: true, name: true, lowStockAt: true },
    });
    if (!product || product.stockQty === null) continue;

    const next = product.stockQty - item.quantity;
    await prisma.product.update({
      where: { id: productId },
      data: { stockQty: Math.max(0, next) },
    });

    const threshold = product.lowStockAt ?? 5;
    if (next <= threshold) {
      logger.warn("Low stock", { product: product.name, stockQty: Math.max(0, next) });
    }
  }
}
