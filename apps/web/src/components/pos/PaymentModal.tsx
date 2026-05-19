// apps/web/src/components/pos/PaymentModal.tsx
"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { PaymentMethod } from "@/types";

interface Props {
  method: PaymentMethod;
  orderId: string;
  totalCents: number;
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = "idle" | "processing" | "ok" | "fail";

const QR_PATTERN = [1,1,1,1,1,1,1,0,1,0,0,1,0,1,1,1,1,1,1,1,1,0,1,0,0,0,1,0,1,0,1,1,0,1,0,0,1,0,0,0,1,0,0,1,0,1,1,1,1];

export function PaymentModal({ method, orderId, totalCents, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const fmt = (c: number) => `€${(c / 100).toFixed(2)}`;

  const cfg = {
    card:   { title: "Charge card — Stripe Terminal", sub: "Present or tap card to the Stripe S700 reader" },
    paypal: { title: "PayPal QR payment", sub: "Customer scans QR with their PayPal app" },
    cash:   { title: "Cash payment", sub: "Confirm cash received from customer" },
  };

  useEffect(() => {
    if (method === "paypal") {
      api.post("/payments/paypal/create", { orderId })
        .then((r) => { setQrUrl(r.data.approvalUrl); })
        .catch(() => { setPhase("fail"); setMessage("Failed to create PayPal order"); });
    }
  }, [method, orderId]);

  const handleCharge = async () => {
    setPhase("processing");
    try {
      if (method === "card") {
        setMessage("Waiting for card…");
        await api.post("/payments/stripe/intent", { orderId, readerId: "tmr_simulated" });
        setPhase("ok");
        setMessage("Payment approved — receipt ready");
        setTimeout(onSuccess, 1200);
      } else if (method === "paypal") {
        setMessage("Waiting for customer to approve…");
        await new Promise((r) => setTimeout(r, 2000));
        setPhase("ok");
        setMessage("PayPal payment captured — receipt ready");
        setTimeout(onSuccess, 1200);
      } else if (method === "cash") {
        await api.post("/payments/cash", { orderId });
        setPhase("ok");
        setMessage("Cash confirmed — receipt issued");
        setTimeout(onSuccess, 1000);
      }
    } catch (err: unknown) {
      setPhase("fail");
      const msg =
        err && typeof err === "object" && "response" in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error)
          : "Payment failed — please retry";
      setMessage(msg || "Payment failed — please retry");
    }
  };

  const statusBg = { idle: "bg-amber-50 text-amber-800", processing: "bg-amber-50 text-amber-800", ok: "bg-green-50 text-green-800", fail: "bg-red-50 text-red-800" };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-base font-medium">{cfg[method].title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{cfg[method].sub}</p>
        <div className="text-3xl font-medium text-center my-4">{fmt(totalCents)}</div>

        {method === "paypal" && (
          <div className="flex flex-col items-center mb-4">
            <div className="w-32 h-32 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center mb-2">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(7, 16px)" }}>
                {QR_PATTERN.map((b, i) => (
                  <div key={i} style={{ width: 16, height: 16, background: b ? "#1a1a1a" : "transparent", borderRadius: 2 }} />
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400">Scan with PayPal app</p>
            {qrUrl && <a href={qrUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 mt-1 underline">Open approval link</a>}
          </div>
        )}

        {(message || phase !== "idle") && (
          <div className={`text-center text-xs font-medium px-3 py-2.5 rounded-lg mb-4 ${statusBg[phase]}`}>
            {phase === "processing" && <span className="mr-1">⏳</span>}
            {phase === "ok" && <span className="mr-1">✓</span>}
            {phase === "fail" && <span className="mr-1">✗</span>}
            {message || (phase === "idle" ? { card: "Ready for card", paypal: "Generating QR…", cash: "Confirm amount" }[method] : "")}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button onClick={handleCharge} disabled={phase === "processing" || phase === "ok"}
            className="btn-primary flex-1 justify-center disabled:opacity-50">
            {phase === "fail" ? "Retry" : phase === "ok" ? "✓ Done" : method === "cash" ? "Confirm cash" : "Charge now"}
          </button>
        </div>
      </div>
    </div>
  );
}
