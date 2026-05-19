// apps/api/src/services/paypal.ts
import axios from "axios";
import { logger } from "../lib/logger";

const BASE = process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

// ── Get OAuth token ──────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const { data } = await axios.post(
    `${BASE}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return data.access_token;
}

// ── Create a PayPal order (for QR flow) ──────────────────────────────────
export async function createPayPalOrder({
  amountCents,
  currency = "EUR",
  orderId,
  returnUrl,
  cancelUrl,
}: {
  amountCents: number;
  currency?: string;
  orderId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const token = await getAccessToken();
  const amount = (amountCents / 100).toFixed(2);

  const { data } = await axios.post(
    `${BASE}/v2/checkout/orders`,
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId,
          amount: { currency_code: currency, value: amount },
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: "PAY_NOW",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": orderId, // idempotency
      },
    }
  );

  logger.info("PayPal order created", { paypalOrderId: data.id, orderId });
  return data;
}

// ── Capture a PayPal order after customer approves ───────────────────────
export async function capturePayPalOrder(paypalOrderId: string) {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE}/v2/checkout/orders/${paypalOrderId}/capture`,
    {},
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  logger.info("PayPal order captured", { paypalOrderId, status: data.status });
  return data;
}

// ── Refund a PayPal capture ──────────────────────────────────────────────
export async function refundPayPalCapture({
  captureId,
  amountCents,
  currency = "EUR",
}: {
  captureId: string;
  amountCents?: number;
  currency?: string;
}) {
  const token = await getAccessToken();
  const body = amountCents
    ? { amount: { currency_code: currency, value: (amountCents / 100).toFixed(2) } }
    : {};
  const { data } = await axios.post(
    `${BASE}/v2/payments/captures/${captureId}/refund`,
    body,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  logger.info("PayPal refund created", { captureId, refundId: data.id });
  return data;
}
