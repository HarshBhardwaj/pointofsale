// apps/web/src/app/pos/page.tsx
"use client";
import { useState, useEffect } from "react";
import { Shell } from "@/components/shared/Shell";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { Cart } from "@/components/pos/Cart";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { OfflineBanner } from "@/components/pos/OfflineBanner";
import { ModifierPicker } from "@/components/pos/ModifierPicker";
import { api } from "@/lib/api";
import { enqueueOrder } from "@/lib/offline/queue";
import { isOfflineCapable } from "@/lib/offline/sync";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { modifierKey } from "@/lib/cartTotals";
import type { Product, CartItem, PaymentMethod, SelectedModifier, Discount } from "@/types";
import toast from "react-hot-toast";

const LOCATION_ID = "loc_01";

function hasModifierGroups(product: Product): boolean {
  return (product.modifierGroups ?? []).some((l) => l.modifierGroup.modifiers.length > 0);
}

function cartToOrderItems(cart: CartItem[]) {
  return cart.map((i) => ({
    productId: i.product.id,
    quantity: i.qty,
    modifiers: i.modifiers.map((m) => ({ modifierId: m.modifierId })),
  }));
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<PaymentMethod | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [orderTotalCents, setOrderTotalCents] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState(1);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);

  const { isOnline, pendingCount, syncing, refresh, sync } = useOfflineSync();

  useEffect(() => {
    Promise.all([
      api.get("/products?active=true"),
      api.get("/discounts"),
    ])
      .then(([productsRes, discountsRes]) => {
        setProducts(productsRes.data);
        setDiscounts(discountsRes.data);
      })
      .catch(() => toast.error("Failed to load menu"))
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (product: Product, modifiers: SelectedModifier[]) => {
    const key = modifierKey(modifiers);
    setCart((c) => {
      const existing = c.find(
        (i) => i.product.id === product.id && modifierKey(i.modifiers) === key
      );
      if (existing) {
        return c.map((i) =>
          i.lineId === existing.lineId ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [
        ...c,
        { lineId: crypto.randomUUID(), product, qty: 1, modifiers },
      ];
    });
  };

  const handleProductTap = (product: Product) => {
    if (hasModifierGroups(product)) {
      setPickerProduct(product);
    } else {
      addToCart(product, []);
    }
  };

  const updateQty = (lineId: string, qty: number) => {
    setCart((c) =>
      qty <= 0 ? c.filter((i) => i.lineId !== lineId) : c.map((i) => (i.lineId === lineId ? { ...i, qty } : i))
    );
  };

  const clearCart = () => {
    setCart([]);
    setSelectedDiscount(null);
  };

  const handleCharge = async (method: PaymentMethod) => {
    if (!cart.length) return;

    const items = cartToOrderItems(cart);

    if (!isOnline) {
      if (!isOfflineCapable(method)) {
        toast.error("Card payments need internet — use cash or PayPal QR offline");
        return;
      }
      try {
        await enqueueOrder({
          locationId: LOCATION_ID,
          items: items.map(({ productId, quantity }) => ({ productId, quantity })),
          paymentMethod: method,
        });
        await refresh();
        clearCart();
        setOrderCount((n) => n + 1);
        toast.success("Order saved offline — will sync when connected");
      } catch {
        toast.error("Failed to save order offline");
      }
      return;
    }

    try {
      const order = await api.post("/orders", {
        locationId: LOCATION_ID,
        channel: "POS",
        items,
        ...(selectedDiscount && { discountId: selectedDiscount.id }),
      });
      setCurrentOrderId(order.data.id);
      setOrderTotalCents(order.data.totalCents);
      setPayModal(method);
    } catch {
      toast.error("Failed to create order");
    }
  };

  const handlePaymentSuccess = () => {
    setPayModal(null);
    setCurrentOrderId(null);
    setOrderTotalCents(null);
    clearCart();
    setOrderCount((n) => n + 1);
    toast.success("Payment successful — receipt ready");
  };

  return (
    <Shell activeTab="pos">
      <OfflineBanner
        isOnline={isOnline}
        pendingCount={pendingCount}
        syncing={syncing}
        onSync={sync}
      />
      <div className="flex h-[calc(100vh-50px)]">
        <div className="flex-1 overflow-hidden flex flex-col">
          <ProductGrid products={products} loading={loading} onAdd={handleProductTap} />
        </div>
        <Cart
          items={cart}
          orderNumber={orderCount}
          isOnline={isOnline}
          discounts={discounts}
          selectedDiscount={selectedDiscount}
          onSelectDiscount={setSelectedDiscount}
          onUpdateQty={updateQty}
          onClear={clearCart}
          onCharge={handleCharge}
        />
      </div>
      {pickerProduct && (
        <ModifierPicker
          product={pickerProduct}
          onConfirm={(mods) => {
            addToCart(pickerProduct, mods);
            setPickerProduct(null);
          }}
          onClose={() => setPickerProduct(null)}
        />
      )}
      {payModal && currentOrderId && orderTotalCents !== null && (
        <PaymentModal
          method={payModal}
          orderId={currentOrderId}
          totalCents={orderTotalCents}
          onClose={() => {
            setPayModal(null);
            setCurrentOrderId(null);
            setOrderTotalCents(null);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </Shell>
  );
}
