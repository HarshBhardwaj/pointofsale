// apps/web/src/lib/utils.ts
export const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;
export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
export const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
export const clsx = (...classes: (string | false | undefined | null)[]) =>
  classes.filter(Boolean).join(" ");
