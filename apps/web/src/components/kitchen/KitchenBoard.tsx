"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { Check, ChefHat, Pause, Play } from "lucide-react";
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
  kitchenPendingAt: string | null;
  kitchenCompletedAt: string | null;
  items: KitchenItem[];
}

type Lane = "new" | "started" | "pending" | "completed";

const LOCATION_ID = "loc_01";

const LANES: { id: Lane; title: string; hint: string; headerClass: string }[] = [
  { id: "new", title: "New", hint: "Paid, not started", headerClass: "bg-brand-50 border-brand-200 text-brand-900" },
  { id: "started", title: "Start", hint: "Preparing now", headerClass: "bg-amber-50 border-amber-200 text-amber-900" },
  { id: "pending", title: "Pending", hint: "On hold", headerClass: "bg-slate-100 border-slate-200 text-slate-800" },
  { id: "completed", title: "Completed", hint: "Clears at midnight", headerClass: "bg-green-50 border-green-200 text-green-900" },
];

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins} min ago`;
}

function kitchenLane(order: KitchenOrder): Lane {
  if (order.kitchenCompletedAt) return "completed";
  if (order.kitchenPendingAt) return "pending";
  if (order.kitchenStartedAt) return "started";
  return "new";
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

  const byLane = useMemo(() => {
    const buckets: Record<Lane, KitchenOrder[]> = {
      new: [],
      started: [],
      pending: [],
      completed: [],
    };
    for (const order of orders) {
      buckets[kitchenLane(order)].push(order);
    }
    return buckets;
  }, [orders]);

  const patch = async (path: string, successMsg: string) => {
    try {
      await api.patch(path);
      toast.success(successMsg);
      load();
    } catch {
      toast.error("Failed to update ticket");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading tickets…</div>;
  }

  const totalActive = byLane.new.length + byLane.started.length + byLane.pending.length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
        <span className="text-xs text-gray-500">
          {totalActive} active · {byLane.completed.length} completed today
        </span>
      </div>

      {totalActive === 0 && byLane.completed.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
          <ChefHat size={48} className="opacity-30" />
          <p className="text-sm">No tickets — paid orders appear in New</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-4 gap-3 p-3 overflow-hidden">
          {LANES.map((lane) => (
            <KitchenLaneColumn
              key={lane.id}
              lane={lane}
              orders={byLane[lane.id]}
              onStart={(id) => patch(`/kitchen/orders/${id}/start`, "Started")}
              onPending={(id) => patch(`/kitchen/orders/${id}/pending`, "Moved to pending")}
              onComplete={(id) => patch(`/kitchen/orders/${id}/complete`, "Completed")}
              onResume={(id) => patch(`/kitchen/orders/${id}/start`, "Back to start")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KitchenLaneColumn({
  lane,
  orders,
  onStart,
  onPending,
  onComplete,
  onResume,
}: {
  lane: (typeof LANES)[number];
  orders: KitchenOrder[];
  onStart: (id: string) => void;
  onPending: (id: string) => void;
  onComplete: (id: string) => void;
  onResume: (id: string) => void;
}) {
  return (
    <div className="flex flex-col min-h-0 rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden">
      <div className={clsx("px-3 py-2 border-b", lane.headerClass)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{lane.title}</span>
          <span className="text-xs font-medium opacity-80">{orders.length}</span>
        </div>
        <p className="text-[10px] opacity-70 mt-0.5">{lane.hint}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        {orders.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-6">No tickets</p>
        ) : (
          orders.map((order) => (
            <KitchenCard
              key={order.id}
              order={order}
              lane={lane.id}
              onStart={onStart}
              onPending={onPending}
              onComplete={onComplete}
              onResume={onResume}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KitchenCard({
  order,
  lane,
  onStart,
  onPending,
  onComplete,
  onResume,
}: {
  order: KitchenOrder;
  lane: Lane;
  onStart: (id: string) => void;
  onPending: (id: string) => void;
  onComplete: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const queuedAt = order.kitchenQueuedAt || order.createdAt;

  const borderClass = {
    new: "border-brand-400",
    started: "border-amber-400",
    pending: "border-slate-400",
    completed: "border-green-400",
  }[lane];

  return (
    <div className={clsx("rounded-lg border-2 bg-white p-3 flex flex-col shadow-sm", borderClass)}>
      <div className="mb-2">
        <div className="text-sm font-semibold leading-tight">{order.orderNumber}</div>
        <div className="text-[10px] text-gray-500">{timeAgo(queuedAt)}</div>
      </div>

      <ul className="flex-1 space-y-1.5 mb-3">
        {order.items.map((item) => (
          <li key={item.id} className="text-xs">
            <span className="font-medium">{item.quantity}×</span> {item.name}
            {item.modifiers.length > 0 && (
              <div className="text-[10px] text-gray-600 ml-3 mt-0.5">
                {item.modifiers.map((m) => m.name).join(" · ")}
              </div>
            )}
          </li>
        ))}
      </ul>

      {lane !== "completed" && (
        <div className="flex flex-wrap gap-1.5">
          {lane === "new" && (
            <>
              <button type="button" onClick={() => onStart(order.id)} className="btn-primary flex-1 justify-center text-[10px] py-1.5 min-w-[4rem]">
                <Play size={12} /> Start
              </button>
              <button type="button" onClick={() => onPending(order.id)} className="btn-ghost flex-1 justify-center text-[10px] py-1.5 min-w-[4rem]">
                <Pause size={12} /> Hold
              </button>
            </>
          )}
          {lane === "started" && (
            <>
              <button type="button" onClick={() => onPending(order.id)} className="btn-ghost flex-1 justify-center text-[10px] py-1.5">
                <Pause size={12} /> Pending
              </button>
              <button type="button" onClick={() => onComplete(order.id)} className="btn-primary flex-1 justify-center text-[10px] py-1.5">
                <Check size={12} /> Done
              </button>
            </>
          )}
          {lane === "pending" && (
            <>
              <button type="button" onClick={() => onResume(order.id)} className="btn-ghost flex-1 justify-center text-[10px] py-1.5">
                <Play size={12} /> Resume
              </button>
              <button type="button" onClick={() => onComplete(order.id)} className="btn-primary flex-1 justify-center text-[10px] py-1.5">
                <Check size={12} /> Done
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
