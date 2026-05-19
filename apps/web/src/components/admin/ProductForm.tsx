// apps/web/src/components/admin/ProductForm.tsx
"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { vatRateToPercent } from "@/lib/format";
import type { Category, Product } from "@/types";

const EMOJIS = ["🍔","🌮","🌯","🥗","🍟","🧅","🥦","🍕","🥩","🍺","🍶","💧","🧃","🍫","🍦","🧁","🥐","🌭","🧆","🫔"];

interface Props {
  product?: Product;
  onSave: (data: any) => void;
  onCancel: () => void;
}

export function ProductForm({ product, onSave, onCancel }: Props) {
  const [name, setName] = useState(product?.name || "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(product?.category?.id || "");
  const [price, setPrice] = useState(product ? (product.priceCents / 100).toFixed(2) : "");
  const [vat, setVat] = useState(
    product ? String(Math.round(vatRateToPercent(product.taxRate?.rate))) : "7"
  );
  const [emoji, setEmoji] = useState(product?.emoji || "🍔");
  const [stockQty, setStockQty] = useState(
    product?.stockQty != null ? String(product.stockQty) : ""
  );
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setTaxRates([
      { id: "tax_7", name: "MwSt. 7% (Speisen)", rate: 0.07 },
      { id: "tax_19", name: "MwSt. 19% (Getränke)", rate: 0.19 },
    ]);
    api.get("/products/categories")
      .then((r) => {
        const cats: Category[] = r.data;
        setCategories(cats);
        setCategoryId((prev) => {
          if (product?.category?.id && cats.some((c) => c.id === product.category!.id)) {
            return product.category.id;
          }
          if (prev && cats.some((c) => c.id === prev)) return prev;
          return cats[0]?.id ?? "";
        });
      })
      .catch(() => setCategories([]));
  }, [product?.id, product?.category?.id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!categoryId) e.category = "Category is required";
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) e.price = "Valid price required";
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const selectedRate = taxRates.find((r) => String(Math.round(vatRateToPercent(r.rate))) === vat);
    onSave({
      name: name.trim(),
      categoryId,
      priceCents: Math.round(parseFloat(price) * 100),
      taxRateId: selectedRate?.id || "tax_7",
      emoji,
      ...(!product && { isActive: true }),
      imageUrl: imageUrl.trim() || null,
      stockQty: stockQty === "" ? null : parseInt(stockQty, 10),
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
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={categories.length === 0}
          >
            {categories.length === 0 ? (
              <option value="">Loading…</option>
            ) : (
              categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            )}
          </select>
          {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
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
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1.5">Stock qty (blank = unlimited)</label>
          <input className="input" type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="e.g. 50" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 font-medium block mb-1.5">Image URL (optional)</label>
          <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
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
