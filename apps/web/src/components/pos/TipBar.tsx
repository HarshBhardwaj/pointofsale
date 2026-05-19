"use client";

interface Props {
  subtotalCents: number;
  tipCents: number;
  onTipChange: (cents: number) => void;
}

const PRESETS = [
  { label: "No tip", pct: 0 },
  { label: "10%", pct: 10 },
  { label: "15%", pct: 15 },
  { label: "20%", pct: 20 },
];

export function TipBar({ subtotalCents, tipCents, onTipChange }: Props) {
  if (subtotalCents <= 0) return null;

  return (
    <div className="px-4 py-2 border-b border-gray-100">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Tip</p>
      <div className="flex gap-1 flex-wrap">
        {PRESETS.map(({ label, pct }) => {
          const cents = Math.round(subtotalCents * (pct / 100));
          const active = tipCents === cents;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onTipChange(cents)}
              className={`px-2 py-1 rounded-md text-xs border ${
                active
                  ? "border-brand-500 bg-brand-50 text-brand-800"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
