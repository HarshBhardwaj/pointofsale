// apps/web/src/hooks/useOrders.ts
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Order } from "@/types";

export function useOrders(locationId?: string, limit = 20) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit) });
    if (locationId) params.set("locationId", locationId);
    api.get(`/orders?${params}`)
      .then((r) => setOrders(r.data.orders))
      .finally(() => setLoading(false));
  }, [locationId, limit]);

  useEffect(() => { load(); }, [load]);

  const refund = async (orderId: string, amountCents?: number, reason?: string) => {
    await api.post("/refunds", { orderId, amountCents, reason });
    load();
  };

  return { orders, loading, reload: load, refund };
}
