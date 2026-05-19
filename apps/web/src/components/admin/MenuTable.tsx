// apps/web/src/components/admin/MenuTable.tsx
"use client";
import { Edit2, Eye, EyeOff, Trash2 } from "lucide-react";
import { formatVatPercent, vatRateToPercent } from "@/lib/format";
import type { Product } from "@/types";

interface Props {
  products: Product[];
  loading: boolean;
  onEdit: (p: Product) => void;
  onToggle: (p: Product) => void;
  onDelete: (p: Product) => void;
}

export function MenuTable({ products, loading, onEdit, onToggle, onDelete }: Props) {
  if (loading) return <div className="card p-8 text-center text-sm text-gray-400">Loading menu…</div>;

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["", "Name", "Category", "Price", "VAT", "Status", ""].map((h, i) => (
              <th key={i} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3 text-xl leading-none">{p.emoji}</td>
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3 text-gray-500">{p.category?.name}</td>
              <td className="px-4 py-3">€{(p.priceCents / 100).toFixed(2)}</td>
              <td className="px-4 py-3">
                <span className={p.taxRate && vatRateToPercent(p.taxRate.rate) < 10 ? "badge-7" : "badge-19"}>
                  {p.taxRate ? formatVatPercent(p.taxRate.rate, "MwSt") : "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={p.isActive ? "badge-active" : "badge-hidden"}>
                  {p.isActive ? "Active" : "Hidden"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button onClick={() => onEdit(p)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => onToggle(p)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    {p.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => onDelete(p)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No items yet — add your first product</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
