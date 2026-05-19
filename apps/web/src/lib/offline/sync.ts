import { api } from "@/lib/api";
import type { PaymentMethod } from "@/types";
import {
  deletePendingOrder,
  getAllPendingOrders,
  putPendingOrder,
} from "./db";
import type { PendingOrder } from "./types";

async function capturePayment(orderId: string, method: PaymentMethod): Promise<void> {
  const idempotencyKey = `offline-pay-${orderId}`;
  const headers = { "Idempotency-Key": idempotencyKey };

  if (method === "cash") {
    await api.post("/payments/cash", { orderId }, { headers });
  } else if (method === "paypal") {
    await api.post("/payments/paypal/create", { orderId }, { headers });
    // Demo: auto-capture after create (production would poll customer approval)
    await new Promise((r) => setTimeout(r, 500));
  } else {
    await api.post(
      "/payments/stripe/intent",
      { orderId, readerId: "tmr_simulated" },
      { headers }
    );
  }
}

async function syncOne(pending: PendingOrder): Promise<void> {
  await putPendingOrder({ ...pending, status: "syncing", error: undefined });

  const orderRes = await api.post("/orders", {
    locationId: pending.locationId,
    channel: pending.channel,
    clientOrderId: pending.id,
    items: pending.items,
  });

  const orderId = orderRes.data.id;
  await capturePayment(orderId, pending.paymentMethod);
  await deletePendingOrder(pending.id);
}

export async function flushPendingOrders(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const pending = await getAllPendingOrders();
  const toSync = pending.filter((o) => o.status === "pending" || o.status === "failed");

  let synced = 0;
  let failed = 0;

  for (const order of toSync) {
    try {
      await syncOne(order);
      synced++;
    } catch (err: unknown) {
      failed++;
      const message =
        err && typeof err === "object" && "response" in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error)
          : "Sync failed";
      await putPendingOrder({
        ...order,
        status: "failed",
        error: message || "Sync failed",
      });
    }
  }

  return { synced, failed };
}

export function isOfflineCapable(method: PaymentMethod): boolean {
  return method === "cash" || method === "paypal";
}
