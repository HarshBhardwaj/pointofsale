import { prisma } from "../lib/prisma";
import { deductInventoryForOrder } from "./inventory";

/** Mark order paid and queue for kitchen display. */
export async function markOrderPaid(orderId: string) {
  await deductInventoryForOrder(orderId);
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: "PAID",
      completedAt: new Date(),
      kitchenQueuedAt: new Date(),
      kitchenCompletedAt: null,
    },
  });
}
