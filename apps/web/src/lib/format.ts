/** Decimal rate (0.07) → percent rounded to 2 decimal places (7, 19, etc.) */
export function vatRateToPercent(rate: string | number | undefined | null): number {
  return Math.round(Number(rate ?? 0) * 10000) / 100;
}

/** e.g. "7.00%" or "7.00% MwSt" */
export function formatVatPercent(
  rate: string | number | undefined | null,
  suffix?: string
): string {
  const label = `${vatRateToPercent(rate).toFixed(2)}%`;
  return suffix ? `${label} ${suffix}` : label;
}
