// apps/web/src/app/pos/page.tsx
"use client";
import { useState, useEffect } from "react";
import { Shell } from "@/components/shared/Shell";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { Cart } from "@/components/pos/Cart";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { api } from "@/lib/api";
import type { Product, CartItem, PaymentMethod } from "@/types";
import toast from "react-hot-toast";

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<PaymentMethod | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(1);

  useEffect(() => {
    api.get("/products?active=true")
      .then((r) => setProducts(r.data))
      .catch(() => toast.error("Failed to load menu"))
      .finally(() => setLoading(false));
  }, []);

  const addItem = (product: Product) => {
    setCart((c) => {
      const existing = c.find((i) => i.product.id === product.id);
      if (existing) return c.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { product, qty: 1 }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    setCart((c) => qty <= 0 ? c.filter((i) => i.product.id !== productId) : c.map((i) => i.product.id === productId ? { ...i, qty } : i));
  };

  const clearCart = () => setCart([]);

  const handleCharge = async (method: PaymentMethod) => {
    if (!cart.length) return;
    try {
      const order = await api.post("/orders", {
        locationId: "loc_01",
        channel: "POS",
        items: cart.map((i) => ({ productId: i.product.id, quantity: i.qty })),
      });
      setCurrentOrderId(order.data.id);
      setPayModal(method);
    } catch {
      toast.error("Failed to create order");
    }
  };

  const handlePaymentSuccess = () => {
    setPayModal(null);
    setCurrentOrderId(null);
    clearCart();
    setOrderCount((n) => n + 1);
    toast.success("Payment successful — receipt ready");
  };

  return (
    <Shell activeTab="pos">
      <div className="flex h-[calc(100vh-50px)]">
        <div className="flex-1 overflow-hidden">
          <ProductGrid products={products} loading={loading} onAdd={addItem} />
        </div>
        <Cart
          items={cart}
          orderNumber={orderCount}
          onUpdateQty={updateQty}
          onClear={clearCart}
          onCharge={handleCharge}
        />
      </div>
      {payModal && currentOrderId && (
        <PaymentModal
          method={payModal}
          orderId={currentOrderId}
          cart={cart}
          onClose={() => { setPayModal(null); setCurrentOrderId(null); }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </Shell>
  );
}
