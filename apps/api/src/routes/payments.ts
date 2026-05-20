// apps/api/src/routes/payments.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { createTerminalPaymentIntent, collectPaymentOnReader } from "../services/stripe";
import { createPayPalOrder } from "../services/paypal";
import { startFiskalyTransaction } from "../services/fiskaly";
import { logger } from "../lib/logger";
import { getOrderBalance, finalizeOrderIfFullyPaid } from "../lib/orderBalance";
import { errorMessage, recordFailedPayment, resetOrderForRetry } from "../lib/paymentFailure";
import { stripe } from "../services/stripe";

export const paymentsRouter = Router();

const MERCHANT_ID = "merchant_01";

// ── GET /api/payments/activity ── succeeded + failed payment attempts ───
paymentsRouter.get("/activity", async (req: Request, res: Response) => {
  try {
    const { locationId, from, to, limit = "100" } = req.query;
    const fromDate = from
      ? new Date(String(from))
      : (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          return d;
        })();
    const toDate = to ? new Date(String(to)) : new Date();

    const payments = await prisma.payment.findMany({
      where: {
        status: { in: ["SUCCEEDED", "FAILED"] },
        createdAt: { gte: fromDate, lte: toDate },
        order: {
          merchantId: MERCHANT_ID,
          ...(locationId && { locationId: String(locationId) }),
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalCents: true,
            status: true,
            items: { select: { name: true, quantity: true }, take: 3 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Number(limit),
    });

    res.json({
      payments: payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        orderNumber: p.order.orderNumber,
        orderStatus: p.order.status,
        provider: p.provider,
        method: p.method,
        status: p.status,
        amountCents: p.amountCents,
        failureCode: p.failureCode,
        failureMessage: p.failureMessage,
        createdAt: p.createdAt,
        items: p.order.items,
        orderTotalCents: p.order.totalCents,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch payment activity" });
  }
});

// ── POST /api/payments/stripe/intent ── create Terminal PaymentIntent ───
paymentsRouter.post("/stripe/intent", async (req: Request, res: Response) => {
  let paymentId: string | undefined;
  let orderId: string | undefined;
  let amountCents = 0;

  try {
    const body = z.object({
      orderId: z.string(),
      readerId: z.string(),
      amountCents: z.number().int().positive().optional(),
    }).parse(req.body);

    orderId = body.orderId;
    const readerId = body.readerId;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { location: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!["PENDING", "OPEN", "AWAITING_PAYMENT", "FAILED"].includes(order.status)) {
      return res.status(400).json({ error: "Order is not payable" });
    }

    const balance = await getOrderBalance(orderId);
    if (!balance) return res.status(404).json({ error: "Order not found" });
    amountCents = body.amountCents ?? balance.dueCents;
    if (amountCents <= 0) {
      return res.status(400).json({ error: "Nothing left to pay on this order" });
    }
    if (amountCents > balance.dueCents) {
      return res.status(400).json({ error: "Amount exceeds balance due" });
    }

    const idempotencyKey = `stripe-intent-${orderId}-${uuidv4()}`;

    const intent = await createTerminalPaymentIntent({
      amountCents,
      orderId,
      locationId: order.locationId,
      idempotencyKey,
    });

    const payment = await prisma.payment.create({
      data: {
        orderId,
        provider: "STRIPE",
        providerPaymentId: intent.id,
        method: "CARD_PRESENT",
        status: "PROCESSING",
        amountCents,
        stripeReaderId: readerId,
        idempotencyKey,
      },
    });
    paymentId = payment.id;

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "AWAITING_PAYMENT" },
    });

    if (order.location.fiskalyTssId) {
      await startFiskalyTransaction({
        tssId: order.location.fiskalyTssId,
        clientId: readerId,
        txId: uuidv4(),
      }).catch((e) => logger.error("fiskaly start failed", { e }));
    }

    try {
      const action = await collectPaymentOnReader({
        readerId,
        paymentIntentId: intent.id,
      });

      const refreshed = await stripe.paymentIntents.retrieve(intent.id);
      if (refreshed.status === "succeeded") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCEEDED",
            providerChargeId:
              typeof refreshed.latest_charge === "string"
                ? refreshed.latest_charge
                : refreshed.latest_charge?.id,
          },
        });
        await finalizeOrderIfFullyPaid(orderId);
        logger.info("Stripe payment succeeded (sync)", { orderId, intentId: intent.id });
        return res.json({ status: "succeeded", intentId: intent.id, action });
      }

      if (
        refreshed.status === "requires_payment_method" ||
        refreshed.status === "canceled"
      ) {
        const msg =
          refreshed.last_payment_error?.message || "Card was declined — try another card or method";
        await recordFailedPayment({
          orderId,
          provider: "STRIPE",
          method: "CARD_PRESENT",
          amountCents,
          failureMessage: msg,
          failureCode: refreshed.last_payment_error?.code,
          providerPaymentId: intent.id,
          paymentId: payment.id,
        });
        await resetOrderForRetry(orderId);
        return res.status(402).json({ error: msg });
      }

      logger.info("Stripe Terminal payment processing", { orderId, intentId: intent.id });
      return res.json({ status: "processing", intentId: intent.id, action });
    } catch (readerErr) {
      const msg = errorMessage(readerErr);
      await recordFailedPayment({
        orderId,
        provider: "STRIPE",
        method: "CARD_PRESENT",
        amountCents,
        failureMessage: msg,
        providerPaymentId: intent.id,
        paymentId: payment.id,
      });
      await resetOrderForRetry(orderId);
      logger.warn("Stripe reader collection failed", { orderId, err: msg });
      return res.status(402).json({ error: msg });
    }
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    const msg = errorMessage(err);
    if (orderId && amountCents > 0) {
      await recordFailedPayment({
        orderId,
        provider: "STRIPE",
        method: "CARD_PRESENT",
        amountCents,
        failureMessage: msg,
        paymentId,
      }).catch(() => {});
      await resetOrderForRetry(orderId).catch(() => {});
    }
    logger.error("Stripe intent failed", { err });
    return res.status(402).json({ error: msg || "Failed to initiate card payment" });
  }
});

// ── POST /api/payments/paypal/create ── create PayPal order for QR ──────
paymentsRouter.post("/paypal/create", async (req: Request, res: Response) => {
  try {
    const { orderId, amountCents: requestedAmount } = z.object({
      orderId: z.string(),
      amountCents: z.number().int().positive().optional(),
    }).parse(req.body);

    const balance = await getOrderBalance(orderId);
    if (!balance) return res.status(404).json({ error: "Order not found" });
    const amountCents = requestedAmount ?? balance.dueCents;
    if (amountCents > balance.dueCents) {
      return res.status(400).json({ error: "Amount exceeds balance due" });
    }

    const baseUrl = process.env.API_URL || "http://localhost:3001";
    const paypalOrder = await createPayPalOrder({
      amountCents,
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
        amountCents,
        idempotencyKey: `paypal-${orderId}-${uuidv4()}`,
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
    const msg = errorMessage(err);
    if (req.body?.orderId) {
      const balance = await getOrderBalance(String(req.body.orderId)).catch(() => null);
      const cents = req.body.amountCents ?? balance?.dueCents ?? 0;
      if (cents > 0) {
        await recordFailedPayment({
          orderId: String(req.body.orderId),
          provider: "PAYPAL",
          method: "PAYPAL_QR",
          amountCents: cents,
          failureMessage: msg,
        }).catch(() => {});
        await resetOrderForRetry(String(req.body.orderId)).catch(() => {});
      }
    }
    logger.error("PayPal create failed", { err });
    res.status(402).json({ error: msg || "Failed to create PayPal payment" });
  }
});

// ── POST /api/payments/cash ── record a cash payment ────────────────────
paymentsRouter.post("/cash", async (req: Request, res: Response) => {
  try {
    const { orderId, amountCents: requestedAmount } = z.object({
      orderId: z.string(),
      amountCents: z.number().int().positive().optional(),
    }).parse(req.body);

    const balance = await getOrderBalance(orderId);
    if (!balance) return res.status(404).json({ error: "Order not found" });
    const amountCents = requestedAmount ?? balance.dueCents;
    if (amountCents > balance.dueCents) {
      return res.status(400).json({ error: "Amount exceeds balance due" });
    }

    await prisma.payment.create({
      data: {
        orderId,
        provider: "CASH",
        method: "CASH",
        status: "SUCCEEDED",
        amountCents,
        idempotencyKey: `cash-${orderId}-${uuidv4()}`,
      },
    });

    await finalizeOrderIfFullyPaid(orderId);
    const updated = await getOrderBalance(orderId);
    if (updated && updated.dueCents > 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "AWAITING_PAYMENT" },
      });
    }

    logger.info("Cash payment recorded", { orderId, amountCents });
    res.json({ success: true, ...updated });
  } catch (err) {
    const msg = errorMessage(err);
    if (req.body?.orderId) {
      const balance = await getOrderBalance(String(req.body.orderId)).catch(() => null);
      const cents = req.body.amountCents ?? balance?.dueCents ?? 0;
      if (cents > 0) {
        await recordFailedPayment({
          orderId: String(req.body.orderId),
          provider: "CASH",
          method: "CASH",
          amountCents: cents,
          failureMessage: msg,
        }).catch(() => {});
      }
    }
    res.status(402).json({ error: msg || "Failed to record cash payment" });
  }
});
