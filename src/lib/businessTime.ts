/** Shared 12h business-hour time helpers (calendar booking + form builder). */

export type Meridiem = "AM" | "PM";

export function timeHHMMRoundedNow(stepMins = 15) {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.round(mins / stepMins) * stepMins;
  const hh = Math.floor((rounded % (24 * 60)) / 60);
  const mm = rounded % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function parseHHMM(value: string): { hh: number; mm: number } | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return { hh, mm };
}

export function toHHMM24(hour12: number, minute: number, meridiem: Meridiem): string {
  const h12 = Math.min(12, Math.max(1, Math.trunc(hour12)));
  const mm = Math.min(59, Math.max(0, Math.trunc(minute)));
  const base = h12 % 12;
  const hh24 = meridiem === "PM" ? base + 12 : base;
  return `${String(hh24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 8–11 → AM, 12–7 → PM (business hours). */
export function inferMeridiemFromBusinessHours(hour12: number): Meridiem | null {
  if (hour12 >= 8 && hour12 <= 11) return "AM";
  if (hour12 === 12) return "PM";
  if (hour12 >= 1 && hour12 <= 7) return "PM";
  return null;
}

export function businessHour12Options(): number[] {
  return [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
}
