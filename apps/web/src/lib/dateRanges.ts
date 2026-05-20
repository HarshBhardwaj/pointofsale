export type DateRangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "past_week"
  | "this_month"
  | "last_month"
  | "custom";

export interface DateRange {
  preset: DateRangePreset;
  from: Date;
  to: Date;
  label: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Monday as week start (common in DE). */
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function getDateRange(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string
): DateRange {
  const now = new Date();

  switch (preset) {
    case "today":
      return {
        preset,
        from: startOfDay(now),
        to: endOfDay(now),
        label: "Today",
      };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return {
        preset,
        from: startOfDay(y),
        to: endOfDay(y),
        label: "Yesterday",
      };
    }
    case "this_week":
      return {
        preset,
        from: startOfWeek(now),
        to: endOfDay(now),
        label: "This week",
      };
    case "past_week": {
      const thisWeekStart = startOfWeek(now);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setMilliseconds(-1);
      const lastWeekStart = startOfWeek(lastWeekEnd);
      return {
        preset,
        from: lastWeekStart,
        to: endOfDay(lastWeekEnd),
        label: "Past week",
      };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        preset,
        from: startOfDay(start),
        to: endOfDay(now),
        label: "This month",
      };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        preset,
        from: startOfDay(start),
        to: endOfDay(end),
        label: "Last month",
      };
    }
    case "custom": {
      const from = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now);
      const to = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
      return {
        preset,
        from,
        to: from > to ? endOfDay(from) : to,
        label: "Custom range",
      };
    }
  }
}

export function toApiIso(d: Date): string {
  return d.toISOString();
}

export const DATE_PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "past_week", label: "Past week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

export function formatRangeSubtitle(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const f = from.toLocaleDateString("de-DE", opts);
  const t = to.toLocaleDateString("de-DE", opts);
  if (f === t) return f;
  return `${f} – ${t}`;
}
