// apps/web/src/components/pos/Cart.tsx
"use client";
import { CreditCard, QrCode, Banknote, Trash2, Bookmark } from "lucide-react";
import { OpenTabsPanel } from "@/components/pos/OpenTabsPanel";
import clsx from "clsx";
import { DiscountBar } from "@/components/pos/DiscountBar";
import { TipBar } from "@/components/pos/TipBar";
import { cartVatBreakdown, lineGross, lineUnitGross } from "@/lib/cartTotals";
import { formatVatPercent } from "@/lib/format";
import { computeDiscountCents } from "@/lib/discounts";
import type { CartItem, PaymentMethod, Discount } from "@/types";

interface Props {
  items: CartItem[];
  orderNumber: number;
  isOnline?: boolean;
  discounts: Discount[];
  selectedDiscount: Discount | null;
  onSelectDiscount: (discount: Discount | null) => void;
  onUpdateQty: (lineId: string, qty: number) => void;
  onClear: () => void;
  onCharge: (method: PaymentMethod) => void;
  onSplitPay?: () => void;
  onHoldTab?: () => void;
  onRecallTab?: (orderId: string) => void;
  openTabLabel?: string | null;
  tipCents?: number;
  onTipChange?: (cents: number) => void;
}

export function Cart({
  items,
  orderNumber,
  isOnline = true,
  discounts,
  selectedDiscount,
  onSelectDiscount,
  onUpdateQty,
  onClear,
  onCharge,
  onSplitPay,
  onHoldTab,
  onRecallTab,
  openTabLabel,
  tipCents = 0,
  onTipChange,
}: Props) {
  const { n7, v7, n19, v19, totalQty, grandTotal: subtotalGross } = cartVatBreakdown(items);
  const discountCents = selectedDiscount ? computeDiscountCents(subtotalGross, selectedDiscount) : 0;
  const grandTotal = subtotalGross - discountCents + tipCents;
  const hasItems = items.length > 0;
  const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  return (
    <div className="w-[300px] flex flex-col bg-white border-l border-gray-200">
      {onRecallTab && <OpenTabsPanel onRecall={onRecallTab} />}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium">
          {openTabLabel ? (
            <span className="flex items-center gap-1">
              <Bookmark size={12} className="text-brand-600" />
              {openTabLabel}
            </span>
          ) : (
            <>Order <span className="text-gray-400 font-normal text-xs">#{String(orderNumber).padStart(3, "0")}</span></>
          )}
        </span>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <Trash2 size={12} /> Clear
        </button>
      </div>

      {hasItems && onTipChange && (
        <TipBar subtotalCents={subtotalGross - discountCents} tipCents={tipCents} onTipChange={onTipChange} />
      )}
      {hasItems && (
        <DiscountBar
          discounts={discounts}
          selected={selectedDiscount}
          onSelect={onSelectDiscount}
        />
      )}

      <div className="flex-1 overflow-y-auto px-4 py-2 min-h-[160px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-300">
            <span className="text-3xl">🛒</span>
            <span className="text-xs">Tap items to add</span>
          </div>
        ) : items.map((item) => (
          <div key={item.lineId} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{item.product.emoji} {item.product.name}</div>
              {item.modifiers.length > 0 && (
                <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                  {item.modifiers.map((m) => m.name).join(" · ")}
                </div>
              )}
              <div className="text-[11px] text-gray-400">
                {fmt(lineUnitGross(item))} · VAT {formatVatPercent(item.product.taxRate?.rate)}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => onUpdateQty(item.lineId, item.qty - 1)}
                className="w-5 h-5 rounded-full border border-gray-200 text-xs flex items-center justify-center hover:bg-gray-50">−</button>
              <span className="text-xs font-medium w-4 text-center">{item.qty}</span>
              <button onClick={() => onUpdateQty(item.lineId, item.qty + 1)}
                className="w-5 h-5 rounded-full border border-gray-200 text-xs flex items-center justify-center hover:bg-gray-50">+</button>
            </div>
            <div className="text-xs font-medium w-10 text-right flex-shrink-0">
              {fmt(lineGross(item))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        {hasItems && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-xs">
            <div className="flex justify-between text-gray-500 mb-1"><span>Net (excl. VAT)</span><span>{fmt(n7 + n19)}</span></div>
            <div className="flex justify-between text-gray-500 mb-1"><span>VAT 7% (food)</span><span>{fmt(v7)}</span></div>
            {v19 > 0 && <div className="flex justify-between text-gray-500"><span>VAT 19% (drinks)</span><span>{fmt(v19)}</span></div>}
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Items</span><span>{totalQty}</span></div>
        {discountCents > 0 && selectedDiscount && (
          <div className="flex justify-between text-xs text-green-700 mb-1">
            <span>{selectedDiscount.name}</span>
            <span>−{fmt(discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-medium mb-3 pt-2 border-t border-gray-100">
          <span>Total</span><span>{fmt(grandTotal)}</span>
        </div>
        <div className="flex gap-1.5 mb-2">
          {onHoldTab && (
            <button
              type="button"
              onClick={onHoldTab}
              disabled={!hasItems || !isOnline}
              className="flex-1 btn-ghost justify-center py-2 text-xs disabled:opacity-40"
            >
              <Bookmark size={14} /> Hold tab
            </button>
          )}
          {onSplitPay && (
            <button
              type="button"
              onClick={onSplitPay}
              disabled={!hasItems || !isOnline}
              className="flex-1 btn-ghost justify-center py-2 text-xs disabled:opacity-40"
            >
              Split pay
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => onCharge("card")} disabled={!hasItems || !isOnline}
            title={!isOnline ? "Card requires internet" : undefined}
            className="col-span-2 btn-primary justify-center py-2.5 disabled:opacity-40">
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
