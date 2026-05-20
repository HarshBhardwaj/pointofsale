"use client";

import { useEffect, useRef, useState } from "react";
import {
  clearPosSession,
  hydrateCart,
  loadPosSession,
  savePosSession,
  serializeCart,
  type PosSessionSnapshot,
} from "@/lib/posSession";
import type { CartItem, Discount, Product } from "@/types";

export interface PosSessionState {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  selectedDiscount: Discount | null;
  setSelectedDiscount: React.Dispatch<React.SetStateAction<Discount | null>>;
  tipPct: number;
  setTipPct: React.Dispatch<React.SetStateAction<number>>;
  openOrderId: string | null;
  setOpenOrderId: React.Dispatch<React.SetStateAction<string | null>>;
  openTabLabel: string | null;
  setOpenTabLabel: React.Dispatch<React.SetStateAction<string | null>>;
  currentOrderId: string | null;
  setCurrentOrderId: React.Dispatch<React.SetStateAction<string | null>>;
  orderCount: number;
  setOrderCount: React.Dispatch<React.SetStateAction<number>>;
  clearPersistedSession: () => void;
  sessionReady: boolean;
}

export function usePosSession(products: Product[], discounts: Discount[], catalogReady: boolean): PosSessionState {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [tipPct, setTipPct] = useState(0);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [openTabLabel, setOpenTabLabel] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(1);
  const [sessionReady, setSessionReady] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!catalogReady || hydratedRef.current) return;
    hydratedRef.current = true;

    const saved = loadPosSession();
    if (saved) {
      setCart(hydrateCart(saved.cart, products));
      setSelectedDiscount(
        saved.discountId ? discounts.find((d) => d.id === saved.discountId) ?? null : null
      );
      setTipPct(saved.tipPct);
      setOpenOrderId(saved.openOrderId);
      setOpenTabLabel(saved.openTabLabel);
      setCurrentOrderId(saved.currentOrderId);
      setOrderCount(saved.orderCount);
    }
    setSessionReady(true);
  }, [catalogReady, products, discounts]);

  useEffect(() => {
    if (!sessionReady) return;
    const snapshot: PosSessionSnapshot = {
      cart: serializeCart(cart),
      discountId: selectedDiscount?.id ?? null,
      tipPct,
      openOrderId,
      openTabLabel,
      currentOrderId,
      orderCount,
    };
    savePosSession(snapshot);
  }, [
    cart,
    selectedDiscount,
    tipPct,
    openOrderId,
    openTabLabel,
    currentOrderId,
    orderCount,
    sessionReady,
  ]);

  const clearPersistedSession = () => {
    clearPosSession();
  };

  return {
    cart,
    setCart,
    selectedDiscount,
    setSelectedDiscount,
    tipPct,
    setTipPct,
    openOrderId,
    setOpenOrderId,
    openTabLabel,
    setOpenTabLabel,
    currentOrderId,
    setCurrentOrderId,
    orderCount,
    setOrderCount,
    clearPersistedSession,
    sessionReady,
  };
}
