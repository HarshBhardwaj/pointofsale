// apps/web/src/components/pos/ProductGrid.tsx
"use client";
import { useState } from "react";
import clsx from "clsx";
import type { Product } from "@/types";

interface Props {
  products: Product[];
  loading: boolean;
  onAdd: (p: Product) => void;
}

export function ProductGrid({ products, loading, onAdd }: Props) {
  const [activeCat, setActiveCat] = useState("All");
  const cats = ["All", ...new Set(products.map((p) => p.category?.name || "Other"))];
  const visible = activeCat === "All" ? products : products.filter((p) => (p.category?.name || "Other") === activeCat);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Category bar */}
      <div className="flex gap-2 px-3 py-2.5 bg-white border-b border-gray-200 overflow-x-auto flex-shrink-0">
        {cats.map((c) => (
          <button key={c} onClick={() => setActiveCat(c)} className={clsx(
            "px-3 py-1.5 rounded-full text-xs border whitespace-nowrap transition-colors",
            activeCat === c ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"
          )}>{c}</button>
        ))}
      </div>

      {/* Products */}
      <div className="grid grid-cols-3 gap-2 p-3 overflow-y-auto flex-1 content-start">
        {loading ? (
          Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl h-24 animate-pulse" />
          ))
        ) : visible.map((p) => (
          <button key={p.id} onClick={() => onAdd(p)}
            className="bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-gray-300 hover:bg-gray-50 active:scale-95 transition-all flex flex-col gap-1">
            <div className="text-2xl leading-none">{p.emoji}</div>
            <div className="text-xs font-medium text-gray-900 leading-snug line-clamp-2">{p.name}</div>
            <div className="text-xs text-gray-500">€{(p.priceCents / 100).toFixed(2)}</div>
            <div className="text-[10px] text-gray-400">VAT {Number(p.taxRate?.rate) * 100}%</div>
          </button>
        ))}
      </div>
    </div>
  );
}
