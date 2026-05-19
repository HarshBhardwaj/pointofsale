// apps/web/src/hooks/useProducts.ts
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/types";

export function useProducts(activeOnly = false) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/products${activeOnly ? "?active=true" : ""}`)
      .then((r) => { setProducts(r.data); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeOnly]);

  useEffect(() => { load(); }, [load]);

  const create = (data: Partial<Product>) => api.post("/products", data).then(() => load());
  const update = (id: string, data: Partial<Product>) => api.patch(`/products/${id}`, data).then(() => load());
  const remove = (id: string) => api.delete(`/products/${id}`).then(() => load());

  return { products, loading, error, reload: load, create, update, remove };
}
