// apps/api/src/routes/webhooks.ts
// Raw body required — must be registered BEFORE express.json()
import { Router, Request, Response } from "express";
import express from "express";
import { prisma } from "../lib/prisma";
import { constructWebhookEvent } from "../services/stripe";
import { capturePayPalOrder } from "../services/paypal";
import { finishFiskalyTransaction } from "../services/fiskaly";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";

export const webhooksRouter = Router();

// ── Stripe webhook ───────────────────────────────────────────────────────
webhooksRouter.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: any;

    try {
      event = constructWebhookEvent(req.body, sig);
    } catch (err: any) {
      logger.warn("Stripe webhook signature invalid", { err: err.message });
      return res.status(400).json({ error: "Invalid signature" });
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const intent = event.data.object;
          const orderId = intent.metadata?.orderId;
          if (!orderId) break;

          const payment = await prisma.payment.findFirst({
            where: { providerPaymentId: intent.id },
            include: { order: { include: { location: true, items: { include: { taxRate: true } } } } },
          });
          if (!payment) break;

          // Mark payment succeeded
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "SUCCEEDED",
              providerChargeId: intent.latest_charge,
            },
          });

          // Mark order paid
          await prisma.order.update({
            where: { id: orderId },
            data: { status: "PAID", completedAt: new Date() },
          });

          // Finish fiskaly TSE signing
          const order = payment.order;
          if (order.location.fiskalyTssId) {
            const vatBreakdown = buildVatBreakdown(order.items);
            await finishFiskalyTransaction({
              tssId: order.location.fiskalyTssId,
              clientId: payment.stripeReaderId || "default",
              txId: uuidv4(),
              amountCents: order.totalCents,
              vatBreakdown,
              paymentMethod: "NON_CASH",
            }).catch((e) => logger.error("fiskaly finish failed", { e }));
          }

          // Audit log
          await prisma.auditLog.create({
            data: {
              merchantId: order.merchantId,
              action: "payment.succeeded",
              entityType: "Payment",
              entityId: payment.id,
              after: { intentId: intent.id, orderId },
            },
          });

          logger.info("Stripe payment succeeded", { orderId, intentId: intent.id });
          break;
        }

        case "payment_intent.payment_failed": {
          const intent = event.data.object;
          const payment = await prisma.payment.findFirst({
            where: { providerPaymentId: intent.id },
          });
          if (payment) {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: "FAILED",
                failureCode: intent.last_payment_error?.code,
                failureMessage: intent.last_payment_error?.message,
              },
            });
            await prisma.order.update({
              where: { id: payment.orderId },
              data: { status: "FAILED" },
            });
          }
          logger.warn("Stripe payment failed", { intentId: intent.id });
          break;
        }

        case "refund.created": {
          const refund = event.data.object;
          await prisma.refund.updateMany({
            where: { providerRefundId: refund.id },
            data: { status: "SUCCEEDED" },
          });
          logger.info("Refund confirmed", { refundId: refund.id });
          break;
        }

        default:
          logger.debug("Unhandled Stripe webhook", { type: event.type });
      }

      res.json({ received: true });
    } catch (err) {
      logger.error("Webhook processing error", { err });
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

// ── PayPal webhook ───────────────────────────────────────────────────────
webhooksRouter.post("/paypal", express.json(), async (req: Request, res: Response) => {
  // In production: verify PayPal webhook signature
  // https://developer.paypal.com/docs/api-basics/notifications/webhooks/notification-messages/
  const { event_type, resource } = req.body;

  try {
    if (event_type === "CHECKOUT.ORDER.APPROVED") {
      const paypalOrderId = resource.id;
      const capture = await capturePayPalOrder(paypalOrderId);

      if (capture.status === "COMPLETED") {
        const payment = await prisma.payment.findFirst({
          where: { providerPaymentId: paypalOrderId },
        });
        if (payment) {
          const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "SUCCEEDED",
              providerChargeId: captureId,
              metadata: { captureId },
            },
          });
          await prisma.order.update({
            where: { id: payment.orderId },
            data: { status: "PAID", completedAt: new Date() },
          });
          await prisma.qrPaymentLink.updateMany({
            where: { orderId: payment.orderId },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
          logger.info("PayPal payment captured", { paypalOrderId, orderId: payment.orderId });
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("PayPal webhook error", { err });
    res.status(500).json({ error: "PayPal webhook failed" });
  }
});

// ── VAT breakdown helper ─────────────────────────────────────────────────
function buildVatBreakdown(items: any[]) {
  const map: Record<string, { rate: number; netCents: number; vatCents: number; grossCents: number }> = {};
  for (const item of items) {
    const rate = Number(item.taxRateSnapshot || item.taxRate?.rate);
    const key = String(rate);
    if (!map[key]) map[key] = { rate, netCents: 0, vatCents: 0, grossCents: 0 };
    map[key].netCents += item.subtotalCents;
    map[key].vatCents += item.taxCents;
    map[key].grossCents += item.totalCents;
  }
  return Object.values(map);
}
