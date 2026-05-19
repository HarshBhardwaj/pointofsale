"use client";
import { useState, useMemo } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import type { Product, ModifierGroup, SelectedModifier } from "@/types";

interface Props {
  product: Product;
  onConfirm: (modifiers: SelectedModifier[]) => void;
  onClose: () => void;
}

function getGroups(product: Product): ModifierGroup[] {
  return (product.modifierGroups ?? [])
    .map((l) => l.modifierGroup)
    .filter((g) => g.modifiers.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function ModifierPicker({ product, onConfirm, onClose }: Props) {
  const groups = useMemo(() => getGroups(product), [product]);
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of groups) {
      if (g.isRequired && g.modifiers.length === 1) {
        init[g.id] = [g.modifiers[0].id];
      } else {
        init[g.id] = [];
      }
    }
    return init;
  });

  const toggle = (group: ModifierGroup, modifierId: string) => {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      const isOn = current.includes(modifierId);
      if (isOn) {
        return { ...prev, [group.id]: current.filter((id) => id !== modifierId) };
      }
      const max = group.maxSelections === 0 ? Infinity : group.maxSelections;
      if (max === 1) return { ...prev, [group.id]: [modifierId] };
      if (current.length >= max) return prev;
      return { ...prev, [group.id]: [...current, modifierId] };
    });
  };

  const validationError = useMemo(() => {
    for (const g of groups) {
      const count = (selected[g.id] ?? []).length;
      if (g.isRequired && count < Math.max(1, g.minSelections)) {
        return `Select an option for ${g.name}`;
      }
      if (g.minSelections > 0 && count < g.minSelections) {
        return `Pick at least ${g.minSelections} for ${g.name}`;
      }
    }
    return null;
  }, [groups, selected]);

  const handleConfirm = () => {
    if (validationError) return;
    const mods: SelectedModifier[] = [];
    for (const g of groups) {
      for (const modId of selected[g.id] ?? []) {
        const mod = g.modifiers.find((m) => m.id === modId);
        if (mod) {
          mods.push({
            modifierId: mod.id,
            name: mod.name,
            priceCents: mod.priceCents,
            groupId: g.id,
            groupName: g.name,
          });
        }
      }
    }
    onConfirm(mods);
  };

  const fmt = (cents: number) => (cents > 0 ? `+€${(cents / 100).toFixed(2)}` : "");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-medium">{product.emoji} {product.name}</h3>
            <p className="text-xs text-gray-500">Customize your order</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-medium">{group.name}</span>
                <span className="text-[10px] text-gray-400">
                  {group.isRequired ? "Required" : "Optional"}
                  {group.maxSelections === 1 ? " · pick one" : group.maxSelections > 1 ? ` · up to ${group.maxSelections}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.modifiers.map((mod) => {
                  const isOn = (selected[group.id] ?? []).includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => toggle(group, mod.id)}
                      className={clsx(
                        "px-3 py-2 rounded-lg text-xs border transition-colors",
                        isOn
                          ? "bg-brand-600 text-white border-brand-600"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      {mod.name}
                      {mod.priceCents > 0 && (
                        <span className={clsx("ml-1", isOn ? "text-brand-100" : "text-gray-400")}>
                          {fmt(mod.priceCents)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100">
          {validationError && (
            <p className="text-xs text-red-600 mb-2">{validationError}</p>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!!validationError}
            className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
