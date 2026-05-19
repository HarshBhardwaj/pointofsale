// apps/web/src/types/index.ts
export type PaymentMethod = "card" | "paypal" | "cash";

export interface TaxRate {
  id: string;
  name: string;
  rate: string | number;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  priceCents: number;
  emoji: string;
  isActive: boolean;
  category?: Category;
  taxRate?: TaxRate;
  sortOrder: number;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  channel: string;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  priceCents: number;
  totalCents: number;
  taxRateSnapshot: number;
}

export interface Payment {
  id: string;
  provider: string;
  method: string;
  status: string;
  amountCents: number;
}
