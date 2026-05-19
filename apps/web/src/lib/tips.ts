/** Tip amount from post-discount gross subtotal and preset percentage (0 = no tip). */
export function computeTipCents(subtotalAfterDiscountCents: number, tipPct: number): number {
  if (tipPct <= 0 || subtotalAfterDiscountCents <= 0) return 0;
  return Math.round(subtotalAfterDiscountCents * (tipPct / 100));
}
