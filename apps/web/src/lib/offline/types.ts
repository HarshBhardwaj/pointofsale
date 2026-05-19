import type { PaymentMethod } from "@/types";

export type PendingOrderStatus = "pending" | "syncing" | "failed";

export interface PendingOrderItem {
  productId: string;
  quantity: number;
}

export interface PendingOrder {
  id: string;
  locationId: string;
  channel: "POS";
  items: PendingOrderItem[];
  paymentMethod: PaymentMethod;
  createdAt: string;
  status: PendingOrderStatus;
  error?: string;
  serverOrderId?: string;
}
