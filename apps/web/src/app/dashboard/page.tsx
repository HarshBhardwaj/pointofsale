// apps/web/src/app/dashboard/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { Shell } from "@/components/shared/Shell";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { api } from "@/lib/api";
import { fmt } from "@/lib/utils";
import {
  getDateRange,
  toApiIso,
  formatRangeSubtitle,
  type DateRangePreset,
} from "@/lib/dateRanges";
import toast from "react-hot-toast";

const LOCATION_ID = "loc_01";

interface Summary {
  totalRevenueCents: number;
  orderCount: number;
  avgOrderCents: number;
  failedPaymentCount: number;
  byMethod: Record<string, number>;
}

interface PaymentActivity {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  provider: string;
  method: string;
  status: string;
  amountCents: number;
  failureCode?: string | null;
  failureMessage?: string | null;
  createdAt: string;
  items: { name: string; quantity: number }[];
  orderTotalCents: number;
}

interface Order {
  id: string;
  orderNumber: string;
  totalCents: number;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  payments: { provider: string; amountCents: number }[];
  items: { name: string; quantity: number }[];
}

function todayInputValue(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<DateRangePreset>("today");
  const [customFrom, setCustomFrom] = useState(todayInputValue());
  const [customTo, setCustomTo] = useState(todayInputValue());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<PaymentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(
    () => getDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      locationId: LOCATION_ID,
      from: toApiIso(range.from),
      to: toApiIso(range.to),
      limit: "50",
    });

    Promise.all([
      api.get(`/analytics/summary?${params}`),
      api.get(`/orders?${params}`),
      api.get(`/payments/activity?${params}`),
    ])
      .then(([s, o, p]) => {
        setSummary(s.data);
        const visible = (o.data.orders as Order[]).filter(
          (order) => !["PENDING", "AWAITING_PAYMENT", "CANCELLED"].includes(order.status)
        );
        setOrders(visible);
        setPayments(p.data.payments as PaymentActivity[]);
      })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [range.from.getTime(), range.to.getTime()]);

  const methodColor: Record<string, string> = {
    STRIPE: "bg-blue-50 text-blue-800",
    PAYPAL: "bg-indigo-50 text-indigo-800",
    CASH: "bg-green-50 text-green-800",
  };

  const formatPaymentMethods = (payments: Order["payments"]) => {
    const providers = [...new Set(payments.map((p) => p.provider))];
    if (providers.length === 0) return "—";
    return providers.join(" + ");
  };

  const revenueLabel =
    preset === "today" ? "Revenue today" : `Revenue (${range.label.toLowerCase()})`;

  const statTiles = [
    {
      label: revenueLabel,
      val: summary ? fmt(summary.totalRevenueCents) : "—",
      sub: `${summary?.orderCount ?? 0} paid orders`,
    },
    {
      label: "Card (Stripe)",
      val: summary ? fmt(summary.byMethod?.STRIPE ?? 0) : "—",
      sub: "Stripe Terminal",
    },
    {
      label: "PayPal QR",
      val: summary ? fmt(summary.byMethod?.PAYPAL ?? 0) : "—",
      sub: "PayPal checkout",
    },
    {
      label: "Cash",
      val: summary ? fmt(summary.byMethod?.CASH ?? 0) : "—",
      sub: "Cash payments",
    },
    {
      label: "Failed attempts",
      val: summary ? String(summary.failedPaymentCount ?? 0) : "—",
      sub: "declined or errored",
    },
    {
      label: "Avg order",
      val: summary ? fmt(summary.avgOrderCents) : "—",
      sub: "per paid order",
    },
  ];

  return (
    <Shell activeTab="dashboard">
      <div className="p-5 max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-start gap-3 mb-2">
          <h1 className="text-xl font-medium">Dashboard</h1>
          <span className="text-xs text-gray-400">
            {formatRangeSubtitle(range.from, range.to)}
          </span>
        </div>

        <DateRangeFilter
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPresetChange={setPreset}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {statTiles.map((s) => (
            <div key={s.label} className="card p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {s.label}
              </div>
              <div className="text-2xl font-medium">{loading ? "…" : s.val}</div>
              <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium">Orders in period</h2>
            <span className="text-xs text-gray-400">{orders.length} orders</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No paid orders in this period
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Order", "Items", "Method", "Status", "Time", "Total"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const when = o.completedAt || o.createdAt;
                  return (
                    <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-xs text-gray-500">
                        {o.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {o.items?.slice(0, 2).map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                        {(o.items?.length ?? 0) > 2 && ` +${o.items!.length - 2} more`}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            methodColor[o.payments?.[0]?.provider] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {formatPaymentMethods(o.payments ?? [])}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            o.status === "PAID"
                              ? "bg-green-50 text-green-800"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(when).toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-right">{fmt(o.totalCents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="card overflow-hidden mt-5">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium">Payment activity</h2>
            <span className="text-xs text-gray-400">{payments.length} attempts</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No payment attempts in this period
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Order", "Method", "Status", "Amount", "Reason", "Time"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-xs text-gray-500">
                      {p.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          methodColor[p.provider] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === "SUCCEEDED"
                            ? "bg-green-50 text-green-800"
                            : "bg-red-50 text-red-800"
                        }`}
                      >
                        {p.status === "SUCCEEDED" ? "Paid" : "Failed"}
                      </span>
                      {p.status === "SUCCEEDED" && p.orderStatus === "PAID" && (
                        <span className="block text-[10px] text-gray-400 mt-0.5">Order complete</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{fmt(p.amountCents)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px]">
                      {p.status === "FAILED" ? (
                        <span className="text-red-700" title={p.failureMessage ?? undefined}>
                          {p.failureMessage || p.failureCode || "Payment failed"}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
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
