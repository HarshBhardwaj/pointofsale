"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getAllPendingOrders } from "@/lib/offline/db";
import { flushPendingOrders } from "@/lib/offline/sync";
import type { PendingOrder } from "@/lib/offline/types";
import toast from "react-hot-toast";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    const orders = await getAllPendingOrders();
    const active = orders.filter((o) => o.status !== "syncing");
    setPendingOrders(active);
    setPendingCount(active.filter((o) => o.status === "pending" || o.status === "failed").length);
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const { synced, failed } = await flushPendingOrders();
      await refresh();
      if (synced > 0) toast.success(`Synced ${synced} offline order${synced > 1 ? "s" : ""}`);
      if (failed > 0) toast.error(`${failed} order${failed > 1 ? "s" : ""} failed to sync`);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refresh();

    const goOnline = () => {
      setIsOnline(true);
      sync();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refresh, sync]);

  return { isOnline, pendingCount, pendingOrders, syncing, refresh, sync };
}
