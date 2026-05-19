"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Bookmark } from "lucide-react";

interface OpenOrder {
  id: string;
  orderNumber: string;
  tabName: string | null;
  totalCents: number;
  createdAt: string;
  items: { quantity: number }[];
}

interface Props {
  onRecall: (orderId: string) => void;
}

const LOCATION_ID = "loc_01";

export function OpenTabsPanel({ onRecall }: Props) {
  const [tabs, setTabs] = useState<OpenOrder[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/orders?locationId=${LOCATION_ID}&status=OPEN`);
      setTabs(res.data.orders);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const itemCount = (o: OpenOrder) => o.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
      >
        <span className="flex items-center gap-1.5">
          <Bookmark size={12} /> Open tabs ({tabs.length})
        </span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && tabs.length > 0 && (
        <div className="max-h-32 overflow-y-auto px-2 pb-2 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onRecall(tab.id)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-brand-50 text-xs border border-gray-100"
            >
              <div className="font-medium">{tab.tabName || tab.orderNumber}</div>
              <div className="text-gray-500">
                {itemCount(tab)} items · €{(tab.totalCents / 100).toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
