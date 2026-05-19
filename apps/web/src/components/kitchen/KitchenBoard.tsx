"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Check, ChefHat } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

interface KitchenItem {
  id: string;
  name: string;
  quantity: number;
  modifiers: { name: string }[];
}

interface KitchenOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  kitchenQueuedAt: string | null;
  kitchenStartedAt: string | null;
  items: KitchenItem[];
}

const LOCATION_ID = "loc_01";

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins} min ago`;
}

export function KitchenBoard() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/kitchen/orders?locationId=${LOCATION_ID}`);
      setOrders(res.data.orders);
    } catch {
      toast.error("Failed to load kitchen tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const start = async (orderId: string) => {
    await api.patch(`/kitchen/orders/${orderId}/start`);
    load();
  };

  const complete = async (orderId: string) => {
    await api.patch(`/kitchen/orders/${orderId}/complete`);
    load();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading tickets…</div>;
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <ChefHat size={48} className="opacity-30" />
        <p className="text-sm">No active orders — new paid orders appear here</p>
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto h-full">
      {orders.map((order) => {
        const started = !!order.kitchenStartedAt;
        const queuedAt = order.kitchenQueuedAt || order.createdAt;
        return (
          <div
            key={order.id}
            className={clsx(
              "rounded-xl border-2 p-4 flex flex-col",
              started ? "border-amber-400 bg-amber-50" : "border-brand-500 bg-white"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-lg font-semibold">{order.orderNumber}</div>
                <div className="text-xs text-gray-500">{timeAgo(queuedAt)}</div>
              </div>
              <span className={clsx(
                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                started ? "bg-amber-200 text-amber-900" : "bg-brand-100 text-brand-800"
              )}>
                {started ? "Preparing" : "New"}
              </span>
            </div>

            <ul className="flex-1 space-y-2 mb-4">
              {order.items.map((item) => (
                <li key={item.id} className="text-sm">
                  <span className="font-medium">{item.quantity}×</span> {item.name}
                  {item.modifiers.length > 0 && (
                    <div className="text-xs text-gray-600 ml-4 mt-0.5">
                      {item.modifiers.map((m) => m.name).join(" · ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              {!started && (
                <button
                  type="button"
                  onClick={() => start(order.id)}
                  className="btn-ghost flex-1 justify-center text-xs py-2"
                >
                  Start
                </button>
              )}
              <button
                type="button"
                onClick={() => complete(order.id)}
                className="btn-primary flex-1 justify-center text-xs py-2"
              >
                <Check size={14} /> Done
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
