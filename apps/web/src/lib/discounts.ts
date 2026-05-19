import type { Discount } from "@/types";

export function computeDiscountCents(grossTotal: number, discount: Discount): number {
  if (grossTotal <= 0) return 0;
  const cents =
    discount.type === "PERCENT"
      ? Math.round(grossTotal * (discount.value / 10000))
      : discount.value;
  return Math.min(cents, grossTotal);
}

export function grossAfterDiscount(grossTotal: number, discount: Discount | null): number {
  if (!discount) return grossTotal;
  return grossTotal - computeDiscountCents(grossTotal, discount);
}
