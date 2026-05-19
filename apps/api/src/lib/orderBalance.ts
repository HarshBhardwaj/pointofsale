import { prisma } from "./prisma";

export async function getOrderPaidCents(orderId: string): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: { orderId, status: "SUCCEEDED" },
    select: { amountCents: true },
  });
  return payments.reduce((sum, p) => sum + p.amountCents, 0);
}

export async function getOrderBalance(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  const paidCents = await getOrderPaidCents(orderId);
  const dueCents = Math.max(0, order.totalCents - paidCents);
  return { totalCents: order.totalCents, paidCents, dueCents, status: order.status };
}

export async function finalizeOrderIfFullyPaid(orderId: string) {
  const balance = await getOrderBalance(orderId);
  if (!balance || balance.dueCents > 0) return false;
  const { markOrderPaid } = await import("../services/order");
  await markOrderPaid(orderId);
  return true;
}
