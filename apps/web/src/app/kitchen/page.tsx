"use client";
import { Shell } from "@/components/shared/Shell";
import { KitchenBoard } from "@/components/kitchen/KitchenBoard";

export default function KitchenPage() {
  return (
    <Shell activeTab="kitchen">
      <div className="h-[calc(100vh-50px)] min-h-0">
        <KitchenBoard />
      </div>
    </Shell>
  );
}
