// apps/web/src/components/admin/ProductForm.tsx
"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/types";

const EMOJIS = ["🍔","🌮","🌯","🥗","🍟","🧅","🥦","🍕","🥩","🍺","🍶","💧","🧃","🍫","🍦","🧁","🥐","🌭","🧆","🫔"];
const CATS = ["Burgers", "Sides", "Drinks", "Desserts", "Specials"];

interface Props {
  product?: Product;
  onSave: (data: any) => void;
  onCancel: () => void;
}

export function ProductForm({ product, onSave, onCancel }: Props) {
  const [name, setName] = useState(product?.name || "");
  const [cat, setCat] = useState(product?.category?.name || "Burgers");
  const [price, setPrice] = useState(product ? (product.priceCents / 100).toFixed(2) : "");
  const [vat, setVat] = useState(product ? String(Number(product.taxRate?.rate) * 100) : "7");
  const [emoji, setEmoji] = useState(product?.emoji || "🍔");
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // In production: fetch tax rates from API
    setTaxRates([
      { id: "tax_7", name: "MwSt. 7% (Speisen)", rate: 0.07 },
      { id: "tax_19", name: "MwSt. 19% (Getränke)", rate: 0.19 },
    ]);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) e.price = "Valid price required";
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const selectedRate = taxRates.find((r) => String(r.rate * 100) === vat);
    onSave({
      name: name.trim(),
      priceCents: Math.round(parseFloat(price) * 100),
      taxRateId: selectedRate?.id || "tax_7",
      emoji,
      isActive: true,
    });
  };

  return (
    <div className="card p-5 mb-4">
      <h3 className="text-sm font-medium mb-4">{product ? "Edit item" : "Add new item"}</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1.5">Item name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spicy burger" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1.5">Category</label>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1.5">Price (€)</label>
          <input className="input" type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1.5">VAT rate</label>
          <select className="input" value={vat} onChange={(e) => setVat(e.target.value)}>
            <option value="7">7% — food (Lebensmittel)</option>
            <option value="19">19% — drinks / alcohol</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-gray-500 font-medium block mb-2">Emoji icon</label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setEmoji(e)} className={`text-xl p-1.5 rounded-lg border-2 transition-colors ${e === emoji ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-gray-50"}`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" onClick={handleSave}>{product ? "Save changes" : "Add to menu"}</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
