// apps/web/src/app/pay/[token]/page.tsx
// Public page — customers land here after scanning a QR code
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { fmt } from "@/lib/utils";

interface OrderSummary {
  orderNumber: string;
  totalCents: number;
  items: { name: string; quantity: number; totalCents: number }[];
  approvalUrl: string;
}

export default function PayPage() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/payments/qr/${token}`)
      .then((r) => setOrder(r.data))
      .catch(() => setError("This payment link has expired or is invalid."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading order…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-gray-600 text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🚚</div>
          <h1 className="text-lg font-medium">Your order</h1>
          <p className="text-xs text-gray-400">{order?.orderNumber}</p>
        </div>

        <div className="border-t border-gray-100 py-3 mb-4 space-y-2">
          {order?.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
              <span className="font-medium">{fmt(item.totalCents)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center text-base font-medium border-t border-gray-100 pt-3 mb-5">
          <span>Total</span>
          <span>{fmt(order?.totalCents || 0)}</span>
        </div>

        <a href={order?.approvalUrl} className="block w-full text-center bg-[#003087] text-white py-3 rounded-xl font-medium text-sm hover:bg-[#001f5b] transition-colors">
          Pay with PayPal
        </a>

        <p className="text-center text-xs text-gray-400 mt-3">
          Powered by PayPal · Secure checkout
        </p>
      </div>
    </div>
  );
}
