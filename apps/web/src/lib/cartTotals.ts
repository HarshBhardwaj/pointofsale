import type { CartItem } from "@/types";

export function lineUnitGross(item: CartItem): number {
  const modCents = item.modifiers.reduce((s, m) => s + m.priceCents, 0);
  return item.product.priceCents + modCents;
}

export function lineGross(item: CartItem): number {
  return lineUnitGross(item) * item.qty;
}

export function cartGrossTotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + lineGross(i), 0);
}

export function cartVatBreakdown(items: CartItem[]) {
  let n7 = 0, v7 = 0, n19 = 0, v19 = 0, totalQty = 0;
  items.forEach((item) => {
    const gross = lineGross(item);
    const rate = Number(item.product.taxRate?.rate || 0.07);
    totalQty += item.qty;
    if (rate < 0.1) {
      const net = gross / 1.07;
      n7 += net;
      v7 += gross - net;
    } else {
      const net = gross / 1.19;
      n19 += net;
      v19 += gross - net;
    }
  });
  return { n7, v7, n19, v19, totalQty, grandTotal: n7 + v7 + n19 + v19 };
}

export function modifierKey(modifiers: CartItem["modifiers"]): string {
  return modifiers.map((m) => m.modifierId).sort().join(",");
}
