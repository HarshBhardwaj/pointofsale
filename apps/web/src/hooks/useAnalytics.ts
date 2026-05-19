// apps/web/src/hooks/useAnalytics.ts
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export interface AnalyticsSummary {
  totalRevenueCents: number;
  orderCount: number;
  avgOrderCents: number;
  byMethod: Record<string, number>;
  from: string;
  to: string;
}

export function useAnalytics(locationId?: string) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (from?: string, to?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (locationId) params.set("locationId", locationId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    api.get(`/analytics/summary?${params}`)
      .then((r) => { setData(r.data); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  return { data, loading, error, reload: load };
}
