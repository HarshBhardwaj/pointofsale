"use client";
import { WifiOff, CloudOff, RefreshCw } from "lucide-react";
import clsx from "clsx";

interface Props {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  onSync: () => void;
}

export function OfflineBanner({ isOnline, pendingCount, syncing, onSync }: Props) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-2 px-3 py-2 text-xs border-b",
        isOnline ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-red-50 border-red-200 text-red-900"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isOnline ? <CloudOff size={14} className="flex-shrink-0" /> : <WifiOff size={14} className="flex-shrink-0" />}
        <span className="truncate">
          {!isOnline
            ? "Offline — cash & PayPal QR orders are saved locally and sync when back online"
            : `${pendingCount} order${pendingCount !== 1 ? "s" : ""} waiting to sync`}
        </span>
      </div>
      {isOnline && pendingCount > 0 && (
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-amber-300 hover:bg-amber-100 disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
          Sync now
        </button>
      )}
    </div>
  );
}
