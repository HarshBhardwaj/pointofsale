// apps/web/src/app/locations/page.tsx
"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shared/Shell";
import { api } from "@/lib/api";
import { MapPin, Wifi, WifiOff } from "lucide-react";

interface Location {
  id: string;
  name: string;
  address?: string;
  city: string;
  isActive: boolean;
  devices: { id: string; label: string; type: string; status: string }[];
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/locations")
      .then((r) => setLocations(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell activeTab="dashboard">
      <div className="p-5 max-w-3xl mx-auto">
        <h1 className="text-xl font-medium mb-5">Locations & devices</h1>
        {loading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : locations.map((loc) => (
          <div key={loc.id} className="card p-5 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                <MapPin size={16} className="text-brand-600" />
              </div>
              <div>
                <div className="font-medium">{loc.name}</div>
                {loc.address && <div className="text-sm text-gray-500">{loc.address}, {loc.city}</div>}
                <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${loc.isActive ? "badge-active" : "badge-hidden"}`}>
                  {loc.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs font-medium text-gray-500 mb-2">Devices</div>
              {loc.devices.length === 0 ? (
                <p className="text-xs text-gray-400">No devices registered</p>
              ) : loc.devices.map((d) => (
                <div key={d.id} className="flex items-center gap-2 py-1.5 text-sm">
                  {d.status === "ONLINE"
                    ? <Wifi size={13} className="text-green-600" />
                    : <WifiOff size={13} className="text-gray-300" />}
                  <span className="font-medium text-gray-700">{d.label}</span>
                  <span className="text-gray-400 text-xs">{d.type}</span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${d.status === "ONLINE" ? "badge-active" : "badge-hidden"}`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
