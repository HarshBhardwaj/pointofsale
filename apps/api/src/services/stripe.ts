// apps/api/src/services/stripe.ts
import Stripe from "stripe";
import { logger } from "../lib/logger";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
  typescript: true,
});

// ── Create a PaymentIntent for Terminal ──────────────────────────────────
export async function createTerminalPaymentIntent({
  amountCents,
  currency = "eur",
  orderId,
  locationId,
  idempotencyKey,
}: {
  amountCents: number;
  currency?: string;
  orderId: string;
  locationId: string;
  idempotencyKey: string;
}) {
  const intent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency,
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      metadata: { orderId, locationId },
    },
    { idempotencyKey }
  );
  logger.info("Stripe PaymentIntent created", { intentId: intent.id, orderId });
  return intent;
}

// ── Collect payment on a specific reader ────────────────────────────────
export async function collectPaymentOnReader({
  readerId,
  paymentIntentId,
}: {
  readerId: string;
  paymentIntentId: string;
}) {
  const action = await stripe.terminal.readers.processPaymentIntent(readerId, {
    payment_intent: paymentIntentId,
  });
  logger.info("Reader processing payment", { readerId, paymentIntentId });
  return action;
}

// ── Refund a charge ─────────────────────────────────────────────────────
export async function createRefund({
  chargeId,
  amountCents,
  reason,
  idempotencyKey,
}: {
  chargeId: string;
  amountCents?: number;
  reason?: string;
  idempotencyKey: string;
}) {
  const refund = await stripe.refunds.create(
    {
      charge: chargeId,
      ...(amountCents && { amount: amountCents }),
      ...(reason && { reason: reason as Stripe.RefundCreateParams.Reason }),
    },
    { idempotencyKey }
  );
  logger.info("Stripe refund created", { refundId: refund.id, chargeId });
  return refund;
}

// ── Verify webhook signature ─────────────────────────────────────────────
export function constructWebhookEvent(payload: Buffer, signature: string) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
