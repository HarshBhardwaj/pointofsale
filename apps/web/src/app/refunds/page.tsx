// apps/web/src/app/refunds/page.tsx
"use client";
import { useState } from "react";
import { Shell } from "@/components/shared/Shell";
import { useOrders } from "@/hooks/useOrders";
import { fmt } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

export default function RefundsPage() {
  const { orders, loading, refund } = useOrders(undefined, 50);
  const [processing, setProcessing] = useState<string | null>(null);

  const paidOrders = orders.filter((o) => ["PAID", "PARTIALLY_REFUNDED"].includes(o.status));

  const handleRefund = async (orderId: string, totalCents: number) => {
    if (!confirm(`Refund full amount of ${fmt(totalCents)}?`)) return;
    setProcessing(orderId);
    try {
      await refund(orderId, totalCents, "requested_by_customer");
      toast.success("Refund initiated — customer will receive funds within 5–10 business days");
    } catch (e: any) {
      toast.error(e.message || "Refund failed");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Shell activeTab="dashboard">
      <div className="p-5 max-w-3xl mx-auto">
        <h1 className="text-xl font-medium mb-5">Refunds</h1>
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 bg-gray-50">
            Paid orders eligible for refund
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : paidOrders.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No refundable orders</div>
          ) : paidOrders.map((o) => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex-1">
                <div className="text-sm font-medium">{o.orderNumber}</div>
                <div className="text-xs text-gray-400">
                  {o.items?.slice(0, 2).map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                  {(o.items?.length || 0) > 2 && ` +${o.items.length - 2} more`}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                o.status === "PARTIALLY_REFUNDED" ? "bg-amber-50 text-amber-800" : "badge-active"
              }`}>{o.status}</span>
              <span className="font-medium text-sm">{fmt(o.totalCents)}</span>
              <button
                onClick={() => handleRefund(o.id, o.totalCents)}
                disabled={processing === o.id}
                className="btn-ghost text-xs py-1.5 px-3">
                {processing === o.id ? "Processing…" : <><RotateCcw size={12} /> Refund</>}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          ⚠️ Refunds are processed via Stripe or PayPal and typically take 5–10 business days to reach the customer.
        </p>
      </div>
    </Shell>
  );
}
