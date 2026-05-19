// apps/web/src/components/pos/Cart.tsx
"use client";
import { CreditCard, QrCode, Banknote, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { CartItem, PaymentMethod } from "@/types";

interface Props {
  items: CartItem[];
  orderNumber: number;
  onUpdateQty: (productId: string, qty: number) => void;
  onClear: () => void;
  onCharge: (method: PaymentMethod) => void;
}

export function Cart({ items, orderNumber, onUpdateQty, onClear, onCharge }: Props) {
  // Calculate VAT breakdown
  let n7 = 0, v7 = 0, n19 = 0, v19 = 0, totalQty = 0;
  items.forEach(({ product, qty }) => {
    const gross = product.priceCents * qty;
    const rate = Number(product.taxRate?.rate || 0.07);
    totalQty += qty;
    if (rate < 0.1) { const net = gross / 1.07; n7 += net; v7 += gross - net; }
    else { const net = gross / 1.19; n19 += net; v19 += gross - net; }
  });
  const grandTotal = n7 + v7 + n19 + v19;
  const hasItems = items.length > 0;

  const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  return (
    <div className="w-[300px] flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium">
          Order <span className="text-gray-400 font-normal text-xs">#{String(orderNumber).padStart(3, "0")}</span>
        </span>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <Trash2 size={12} /> Clear
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2 min-h-[160px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-300">
            <span className="text-3xl">🛒</span>
            <span className="text-xs">Tap items to add</span>
          </div>
        ) : items.map(({ product, qty }) => (
          <div key={product.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{product.emoji} {product.name}</div>
              <div className="text-[11px] text-gray-400">€{(product.priceCents / 100).toFixed(2)} · VAT {Number(product.taxRate?.rate) * 100}%</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onUpdateQty(product.id, qty - 1)}
                className="w-5 h-5 rounded-full border border-gray-200 text-xs flex items-center justify-center hover:bg-gray-50">−</button>
              <span className="text-xs font-medium w-4 text-center">{qty}</span>
              <button onClick={() => onUpdateQty(product.id, qty + 1)}
                className="w-5 h-5 rounded-full border border-gray-200 text-xs flex items-center justify-center hover:bg-gray-50">+</button>
            </div>
            <div className="text-xs font-medium w-10 text-right">
              {fmt(product.priceCents * qty)}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        {hasItems && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-xs">
            <div className="flex justify-between text-gray-500 mb-1"><span>Net (excl. VAT)</span><span>{fmt(n7 + n19)}</span></div>
            <div className="flex justify-between text-gray-500 mb-1"><span>VAT 7% (food)</span><span>{fmt(v7)}</span></div>
            {v19 > 0 && <div className="flex justify-between text-gray-500"><span>VAT 19% (drinks)</span><span>{fmt(v19)}</span></div>}
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Items</span><span>{totalQty}</span></div>
        <div className="flex justify-between text-base font-medium mb-3 pt-2 border-t border-gray-100">
          <span>Total</span><span>{fmt(grandTotal)}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => onCharge("card")} disabled={!hasItems}
            className="col-span-2 btn-primary justify-center py-2.5">
            <CreditCard size={15} /> Charge card (Stripe)
          </button>
          <button onClick={() => onCharge("paypal")} disabled={!hasItems}
            className={clsx("btn-ghost justify-center py-2 text-xs", !hasItems && "opacity-40 cursor-not-allowed")}>
            <QrCode size={14} /> PayPal QR
          </button>
          <button onClick={() => onCharge("cash")} disabled={!hasItems}
            className={clsx("btn-ghost justify-center py-2 text-xs", !hasItems && "opacity-40 cursor-not-allowed")}>
            <Banknote size={14} /> Cash
          </button>
        </div>
      </div>
    </div>
  );
}
