// apps/web/src/app/dashboard/page.tsx
"use client";
import { useState, useEffect } from "react";
import { Shell } from "@/components/shared/Shell";
import { api } from "@/lib/api";
import { fmt } from "@/lib/utils";
import toast from "react-hot-toast";

interface Summary {
  totalRevenueCents: number;
  orderCount: number;
  avgOrderCents: number;
  byMethod: Record<string, number>;
}

interface Order {
  id: string;
  orderNumber: string;
  totalCents: number;
  status: string;
  createdAt: string;
  payments: { provider: string }[];
  items: { name: string; quantity: number }[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/analytics/summary"),
      api.get("/orders?limit=20"),
    ])
      .then(([s, o]) => { setSummary(s.data); setOrders(o.data.orders); })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const methodColor: Record<string, string> = {
    STRIPE: "bg-blue-50 text-blue-800",
    PAYPAL: "bg-indigo-50 text-indigo-800",
    CASH: "bg-green-50 text-green-800",
  };

  return (
    <Shell activeTab="dashboard">
      <div className="p-5 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-xl font-medium">Dashboard</h1>
          <span className="text-xs text-gray-400">
            {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: "Revenue today", val: summary ? fmt(summary.totalRevenueCents) : "—", sub: `${summary?.orderCount || 0} orders` },
            { label: "Card (Stripe)", val: summary ? fmt(summary.byMethod?.STRIPE || 0) : "—", sub: "Stripe Terminal" },
            { label: "PayPal QR", val: summary ? fmt(summary.byMethod?.PAYPAL || 0) : "—", sub: "PayPal checkout" },
            { label: "Avg order", val: summary ? fmt(summary.avgOrderCents) : "—", sub: "per transaction" },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{s.label}</div>
              <div className="text-2xl font-medium">{s.val}</div>
              <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Orders */}
        <div className="card overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium">Recent orders</h2>
            <span className="text-xs text-gray-400">{orders.length} orders</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No orders yet today</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Order", "Items", "Method", "Status", "Time", "Total"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-xs text-gray-500">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {o.items?.slice(0,2).map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                      {o.items?.length > 2 && ` +${o.items.length - 2} more`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${methodColor[o.payments?.[0]?.provider] || "bg-gray-100 text-gray-600"}`}>
                        {o.payments?.[0]?.provider || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === "PAID" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(o.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 font-medium text-right">{fmt(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
