// apps/api/src/routes/refunds.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createRefund as stripeRefund } from "../services/stripe";
import { refundPayPalCapture } from "../services/paypal";
import { logger } from "../lib/logger";

export const refundsRouter = Router();

refundsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { orderId, amountCents, reason } = z.object({
      orderId: z.string(),
      amountCents: z.number().int().positive().optional(),
      reason: z.string().optional(),
    }).parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) {
      return res.status(400).json({ error: "Order is not refundable" });
    }

    const payment = order.payments.find((p) => p.status === "SUCCEEDED");
    if (!payment) return res.status(400).json({ error: "No successful payment found" });

    const refundAmount = amountCents || order.totalCents;
    const idempotencyKey = `refund-${orderId}-${Date.now()}`;

    let providerRefundId: string | undefined;

    if (payment.provider === "STRIPE" && payment.providerChargeId) {
      const r = await stripeRefund({
        chargeId: payment.providerChargeId,
        amountCents: refundAmount,
        idempotencyKey,
      });
      providerRefundId = r.id;
    } else if (payment.provider === "PAYPAL" && payment.providerChargeId) {
      const r = await refundPayPalCapture({
        captureId: payment.providerChargeId,
        amountCents: refundAmount,
      });
      providerRefundId = r.id;
    }

    const refund = await prisma.refund.create({
      data: {
        orderId,
        paymentId: payment.id,
        providerRefundId,
        amountCents: refundAmount,
        reason,
        status: payment.provider === "CASH" ? "SUCCEEDED" : "PENDING",
        initiatedBy: "owner", // In production: from Clerk auth
      },
    });

    const isFullRefund = refundAmount >= order.totalCents;
    await prisma.order.update({
      where: { id: orderId },
      data: { status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });

    await prisma.auditLog.create({
      data: {
        merchantId: order.merchantId,
        action: "refund.initiated",
        entityType: "Refund",
        entityId: refund.id,
        after: { orderId, amountCents: refundAmount, reason },
      },
    });

    logger.info("Refund initiated", { orderId, refundId: refund.id, amountCents: refundAmount });
    res.status(201).json(refund);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error("Refund failed", { err });
    res.status(500).json({ error: "Failed to process refund" });
  }
});
