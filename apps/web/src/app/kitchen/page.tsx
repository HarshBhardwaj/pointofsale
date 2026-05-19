"use client";
import { Shell } from "@/components/shared/Shell";
import { KitchenBoard } from "@/components/kitchen/KitchenBoard";

export default function KitchenPage() {
  return (
    <Shell activeTab="kitchen">
      <KitchenBoard />
    </Shell>
  );
}
