"use client";

import {
  DATE_PRESET_OPTIONS,
  type DateRangePreset,
} from "@/lib/dateRanges";

interface Props {
  preset: DateRangePreset;
  customFrom: string;
  customTo: string;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}

export function DateRangeFilter({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1.5">Period</label>
        <select
          className="input py-2 text-sm min-w-[160px]"
          value={preset}
          onChange={(e) => onPresetChange(e.target.value as DateRangePreset)}
        >
          {DATE_PRESET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {preset === "custom" && (
        <>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1.5">From</label>
            <input
              type="date"
              className="input py-2 text-sm"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1.5">To</label>
            <input
              type="date"
              className="input py-2 text-sm"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
}
