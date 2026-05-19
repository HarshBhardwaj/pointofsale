"use client";
import clsx from "clsx";
import type { Discount } from "@/types";

interface Props {
  discounts: Discount[];
  selected: Discount | null;
  onSelect: (discount: Discount | null) => void;
}

export function DiscountBar({ discounts, selected, onSelect }: Props) {
  if (!discounts.length) return null;

  return (
    <div className="px-4 py-2 border-b border-gray-100">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Discount</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={clsx(
            "px-2.5 py-1 rounded-full text-[11px] border transition-colors",
            !selected ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          )}
        >
          None
        </button>
        {discounts.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(selected?.id === d.id ? null : d)}
            className={clsx(
              "px-2.5 py-1 rounded-full text-[11px] border transition-colors",
              selected?.id === d.id
                ? "bg-brand-600 text-white border-brand-600"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            {d.name}
          </button>
        ))}
      </div>
    </div>
  );
}
