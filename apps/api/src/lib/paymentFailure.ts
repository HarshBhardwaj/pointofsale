import { v4 as uuidv4 } from "uuid";
import { prisma } from "./prisma";
import type { PaymentMethod, PaymentProvider } from "@prisma/client";

export async function recordFailedPayment({
  orderId,
  provider,
  method,
  amountCents,
  failureMessage,
  failureCode,
  providerPaymentId,
  paymentId,
}: {
  orderId: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  amountCents: number;
  failureMessage: string;
  failureCode?: string;
  providerPaymentId?: string;
  paymentId?: string;
}) {
  const data = {
    status: "FAILED" as const,
    failureMessage,
    failureCode: failureCode ?? null,
  };

  if (paymentId) {
    return prisma.payment.update({
      where: { id: paymentId },
      data,
    });
  }

  return prisma.payment.create({
    data: {
      orderId,
      provider,
      method,
      amountCents,
      providerPaymentId,
      idempotencyKey: `fail-${orderId}-${uuidv4()}`,
      ...data,
    },
  });
}

export async function resetOrderForRetry(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  if (["PENDING", "AWAITING_PAYMENT", "FAILED"].includes(order.status)) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "AWAITING_PAYMENT" },
    });
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Payment failed";
}
