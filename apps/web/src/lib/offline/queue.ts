import { putPendingOrder } from "./db";
import type { PendingOrder, PendingOrderItem } from "./types";
import type { PaymentMethod } from "@/types";

export async function enqueueOrder(params: {
  locationId: string;
  items: PendingOrderItem[];
  paymentMethod: PaymentMethod;
}): Promise<PendingOrder> {
  const order: PendingOrder = {
    id: crypto.randomUUID(),
    locationId: params.locationId,
    channel: "POS",
    items: params.items,
    paymentMethod: params.paymentMethod,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await putPendingOrder(order);
  return order;
}
