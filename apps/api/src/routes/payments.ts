// apps/api/src/routes/payments.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { createTerminalPaymentIntent, collectPaymentOnReader } from "../services/stripe";
import { createPayPalOrder } from "../services/paypal";
import { startFiskalyTransaction } from "../services/fiskaly";
import { logger } from "../lib/logger";
import { markOrderPaid } from "../services/order";

export const paymentsRouter = Router();

// ── POST /api/payments/stripe/intent ── create Terminal PaymentIntent ───
paymentsRouter.post("/stripe/intent", async (req: Request, res: Response) => {
  try {
    const { orderId, readerId } = z.object({
      orderId: z.string(),
      readerId: z.string(),
    }).parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { location: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!["PENDING", "OPEN", "AWAITING_PAYMENT"].includes(order.status)) {
      return res.status(400).json({ error: "Order is not payable" });
    }

    const idempotencyKey = `stripe-intent-${orderId}`;

    const intent = await createTerminalPaymentIntent({
      amountCents: order.totalCents,
      orderId,
      locationId: order.locationId,
      idempotencyKey,
    });

    // Collect on the reader immediately
    const action = await collectPaymentOnReader({
      readerId,
      paymentIntentId: intent.id,
    });

    // Record pending payment
    await prisma.payment.create({
      data: {
        orderId,
        provider: "STRIPE",
        providerPaymentId: intent.id,
        method: "CARD_PRESENT",
        status: "PROCESSING",
        amountCents: order.totalCents,
        stripeReaderId: readerId,
        idempotencyKey,
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "AWAITING_PAYMENT" },
    });

    // Start fiskaly transaction
    if (order.location.fiskalyTssId) {
      await startFiskalyTransaction({
        tssId: order.location.fiskalyTssId,
        clientId: readerId, // device = client in fiskaly
        txId: uuidv4(),
      }).catch((e) => logger.error("fiskaly start failed", { e }));
    }

    logger.info("Stripe Terminal payment initiated", { orderId, intentId: intent.id });
    res.json({ intentId: intent.id, action });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error("Stripe intent failed", { err });
    res.status(500).json({ error: "Failed to initiate card payment" });
  }
});

// ── POST /api/payments/paypal/create ── create PayPal order for QR ──────
paymentsRouter.post("/paypal/create", async (req: Request, res: Response) => {
  try {
    const { orderId } = z.object({ orderId: z.string() }).parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const baseUrl = process.env.API_URL || "http://localhost:3001";
    const paypalOrder = await createPayPalOrder({
      amountCents: order.totalCents,
      orderId,
      returnUrl: `${baseUrl}/api/payments/paypal/capture?token={checkout_session_id}&orderId=${orderId}`,
      cancelUrl: `${baseUrl}/api/payments/paypal/cancel?orderId=${orderId}`,
    });

    // Create QR payment link
    const qrLink = await prisma.qrPaymentLink.create({
      data: {
        orderId,
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      },
    });

    // Record pending payment
    await prisma.payment.create({
      data: {
        orderId,
        provider: "PAYPAL",
        providerPaymentId: paypalOrder.id,
        method: "PAYPAL_QR",
        status: "PENDING",
        amountCents: order.totalCents,
        idempotencyKey: `paypal-${orderId}`,
        metadata: { paypalOrderId: paypalOrder.id },
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "AWAITING_PAYMENT" },
    });

    // Return the PayPal approval URL (customer scans this as QR)
    const approvalUrl = paypalOrder.links?.find((l: any) => l.rel === "approve")?.href;
    logger.info("PayPal QR order created", { orderId, paypalOrderId: paypalOrder.id });
    res.json({ paypalOrderId: paypalOrder.id, approvalUrl, qrToken: qrLink.token });
  } catch (err) {
    logger.error("PayPal create failed", { err });
    res.status(500).json({ error: "Failed to create PayPal payment" });
  }
});

// ── POST /api/payments/cash ── record a cash payment ────────────────────
paymentsRouter.post("/cash", async (req: Request, res: Response) => {
  try {
    const { orderId } = z.object({ orderId: z.string() }).parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });

    await prisma.payment.create({
      data: {
        orderId,
        provider: "CASH",
        method: "CASH",
        status: "SUCCEEDED",
        amountCents: order.totalCents,
        idempotencyKey: `cash-${orderId}-${Date.now()}`,
      },
    });
    await markOrderPaid(orderId);

    logger.info("Cash payment recorded", { orderId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to record cash payment" });
  }
});
