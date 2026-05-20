import type { CartItem, Product, SelectedModifier } from "@/types";

const STORAGE_KEY = "pos-checkout-session";

export interface PersistedCartLine {
  lineId: string;
  productId: string;
  qty: number;
  modifiers: SelectedModifier[];
}

export interface PosSessionSnapshot {
  cart: PersistedCartLine[];
  discountId: string | null;
  tipPct: number;
  openOrderId: string | null;
  openTabLabel: string | null;
  currentOrderId: string | null;
  orderCount: number;
}

export function serializeCart(cart: CartItem[]): PersistedCartLine[] {
  return cart.map((line) => ({
    lineId: line.lineId,
    productId: line.product.id,
    qty: line.qty,
    modifiers: line.modifiers,
  }));
}

export function hydrateCart(lines: PersistedCartLine[], products: Product[]): CartItem[] {
  return lines.flatMap((line) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product) return [];
    return [{ lineId: line.lineId, product, qty: line.qty, modifiers: line.modifiers }];
  });
}

export function loadPosSession(): PosSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PosSessionSnapshot;
  } catch {
    return null;
  }
}

export function savePosSession(snapshot: PosSessionSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // quota exceeded or private mode — ignore
  }
}

export function clearPosSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
