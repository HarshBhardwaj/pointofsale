// apps/web/src/app/admin/page.tsx
"use client";
import { useState, useEffect } from "react";
import { Shell } from "@/components/shared/Shell";
import { MenuTable } from "@/components/admin/MenuTable";
import { ProductForm } from "@/components/admin/ProductForm";
import { api } from "@/lib/api";
import type { Product } from "@/types";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";

const PAGE_SIZE = 15;

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [editingProduct, setEditingProduct] = useState<Product | null | "new">(null);

  const load = () => {
    setLoading(true);
    api.get("/products")
      .then((r) => setProducts(r.data))
      .catch(() => toast.error("Failed to load menu"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [products.length, page]);

  const paginatedProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSave = async (data: Partial<Product>) => {
    try {
      if (editingProduct === "new") {
        await api.post("/products", data);
        toast.success("Item added");
      } else if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, data);
        toast.success("Item updated");
      }
      setEditingProduct(null);
      load();
    } catch {
      toast.error("Failed to save item");
    }
  };

  const handleToggle = async (product: Product) => {
    try {
      await api.patch(`/products/${product.id}`, { isActive: !product.isActive });
      toast.success(`${product.name} ${product.isActive ? "hidden" : "shown"}`);
      load();
    } catch {
      toast.error("Failed to update item");
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"?`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      toast.success("Item removed");
      load();
    } catch {
      toast.error("Failed to delete item");
    }
  };

  return (
    <Shell activeTab="admin">
      <div className="h-full overflow-y-auto">
      <div className="p-5 max-w-5xl mx-auto pb-10">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-xl font-medium">Menu admin</h1>
          <button className="btn-primary" onClick={() => setEditingProduct("new")}>
            <Plus size={16} /> Add item
          </button>
        </div>

        {editingProduct !== null && (
          <ProductForm
            product={editingProduct === "new" ? undefined : editingProduct}
            onSave={handleSave}
            onCancel={() => setEditingProduct(null)}
          />
        )}

        <MenuTable
          products={paginatedProducts}
          loading={loading}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={products.length}
          onPageChange={setPage}
          onEdit={setEditingProduct}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      </div>
      </div>
    </Shell>
  );
}
