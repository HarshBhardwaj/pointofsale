// apps/web/src/components/shared/Shell.tsx
"use client";
import Link from "next/link";
import { ShoppingCart, Settings, BarChart2, Truck, MapPin, RotateCcw, ChefHat } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { UserButton } from "@clerk/nextjs";
import clsx from "clsx";

type Tab = "pos" | "kitchen" | "admin" | "dashboard" | "locations" | "refunds";
interface Props { children: React.ReactNode; activeTab: Tab; }

const tabs = [
  { id: "pos",       label: "POS",       href: "/pos",       Icon: ShoppingCart },
  { id: "kitchen",   label: "Kitchen",   href: "/kitchen",   Icon: ChefHat },
  { id: "admin",     label: "Menu",      href: "/admin",     Icon: Settings },
  { id: "dashboard", label: "Dashboard", href: "/dashboard", Icon: BarChart2 },
  { id: "locations", label: "Locations", href: "/locations", Icon: MapPin },
  { id: "refunds",   label: "Refunds",   href: "/refunds",   Icon: RotateCcw },
] as const;

export function Shell({ children, activeTab }: Props) {
  return (
    <div className="flex flex-col h-screen">
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <nav className="h-[50px] bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0 z-10">
        <div className="flex items-center gap-2 font-medium text-[15px] mr-4">
          <Truck size={18} className="text-brand-600" />
          <span className="hidden sm:inline">Truck POS</span>
        </div>
        <div className="flex gap-0.5 flex-1">
          {tabs.map(({ id, label, href, Icon }) => (
            <Link key={id} href={href} className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap",
              activeTab === id ? "bg-brand-50 text-brand-800 font-medium" : "text-gray-500 hover:bg-gray-100"
            )}>
              <Icon size={13} /><span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className="hidden md:flex text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-300 items-center gap-1">
            <MapPin size={10} /> Mauerpark
          </span>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </nav>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
