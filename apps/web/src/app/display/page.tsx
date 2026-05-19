"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const LOCATION_ID = "loc_01";

interface DisplayLine {
  name: string;
  qty: number;
  modifiers: string;
  lineCents: number;
}

interface DisplayState {
  lines: DisplayLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  updatedAt: string;
}

export default function CustomerDisplayPage() {
  const [state, setState] = useState<DisplayState | null>(null);

  useEffect(() => {
    const load = () =>
      api.get(`/display?locationId=${LOCATION_ID}`).then((r) => setState(r.data)).catch(() => {});
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  const fmt = (c: number) => `€${(c / 100).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="px-8 py-6 border-b border-gray-800">
        <h1 className="text-2xl font-light tracking-wide">Your order</h1>
      </header>
      <main className="flex-1 px-8 py-6 overflow-auto">
        {!state || state.lines.length === 0 ? (
          <p className="text-gray-500 text-xl text-center mt-24">Welcome — your items will appear here</p>
        ) : (
          <ul className="space-y-4 mb-8">
            {state.lines.map((line, i) => (
              <li key={i} className="flex justify-between items-start gap-4 text-lg">
                <div>
                  <span className="font-medium">{line.qty}× {line.name}</span>
                  {line.modifiers && (
                    <p className="text-sm text-gray-400 mt-0.5">{line.modifiers}</p>
                  )}
                </div>
                <span className="tabular-nums">{fmt(line.lineCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
      {state && state.lines.length > 0 && (
        <footer className="px-8 py-8 border-t border-gray-800 bg-gray-900">
          {state.discountCents > 0 && (
            <div className="flex justify-between text-gray-400 mb-2 text-lg">
              <span>Discount</span>
              <span>−{fmt(state.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline">
            <span className="text-xl text-gray-300">Total</span>
            <span className="text-5xl font-semibold tabular-nums">{fmt(state.totalCents)}</span>
          </div>
        </footer>
      )}
    </div>
  );
}
