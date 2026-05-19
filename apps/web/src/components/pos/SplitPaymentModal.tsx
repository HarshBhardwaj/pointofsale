"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { PaymentModal } from "@/components/pos/PaymentModal";
import type { PaymentMethod } from "@/types";

interface Props {
  orderId: string;
  totalCents: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function SplitPaymentModal({ orderId, totalCents, onClose, onSuccess }: Props) {
  const [cashEuros, setCashEuros] = useState("");
  const [cardEuros, setCardEuros] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"split" | "card">("split");
  const [cardAmountCents, setCardAmountCents] = useState(0);

  const fmt = (c: number) => `€${(c / 100).toFixed(2)}`;
  const totalEuros = totalCents / 100;

  const parseEuros = (s: string) => Math.round(parseFloat(s.replace(",", ".")) * 100) || 0;

  const handleApplySplit = async () => {
    setError("");
    const cashCents = parseEuros(cashEuros);
    const cardCents = parseEuros(cardEuros);
    if (cashCents + cardCents !== totalCents) {
      setError(`Cash + card must equal ${fmt(totalCents)}`);
      return;
    }
    if (cashCents < 0 || cardCents < 0) {
      setError("Amounts must be positive");
      return;
    }

    try {
      if (cashCents > 0) {
        await api.post("/payments/cash", { orderId, amountCents: cashCents });
      }
      if (cardCents > 0) {
        setCardAmountCents(cardCents);
        setPhase("card");
        return;
      }
      onSuccess();
    } catch {
      setError("Cash payment failed");
    }
  };

  const fillHalf = () => {
    const half = (totalEuros / 2).toFixed(2);
    setCashEuros(half);
    setCardEuros(half);
  };

  if (phase === "card") {
    return (
      <PaymentModal
        method="card"
        orderId={orderId}
        totalCents={cardAmountCents}
        amountCents={cardAmountCents}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-medium">Split payment</h3>
            <p className="text-xs text-gray-500 mt-0.5">Total {fmt(totalCents)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <label className="block text-xs text-gray-600">
            Cash
            <input
              type="text"
              inputMode="decimal"
              value={cashEuros}
              onChange={(e) => setCashEuros(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Card
            <input
              type="text"
              inputMode="decimal"
              value={cardEuros}
              onChange={(e) => setCardEuros(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <button type="button" onClick={fillHalf} className="text-xs text-brand-600 hover:underline">
            Split 50 / 50
          </button>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <button type="button" onClick={handleApplySplit} className="w-full btn-primary justify-center py-2.5">
          Continue
        </button>
      </div>
    </div>
  );
}
