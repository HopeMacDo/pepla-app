import { useCallback, useEffect, useState } from "react";

const LS_KEY = "pepla:business-hours-week-v1";

export const BUSINESS_HOURS_CHANGED = "pepla-business-hours-changed";

/** Minutes from local midnight; end is exclusive (e.g. 9:00–17:00 → 540–1020). */
export type BusinessDayConfig = {
  enabled: boolean;
  startMin: number;
  endMin: number;
};

/** Index matches `Date.getDay()` (0 = Sunday … 6 = Saturday). */
export type BusinessHoursWeek = [
  BusinessDayConfig,
  BusinessDayConfig,
  BusinessDayConfig,
  BusinessDayConfig,
  BusinessDayConfig,
  BusinessDayConfig,
  BusinessDayConfig
];

export const DEFAULT_BUSINESS_DAY_OFF: BusinessDayConfig = {
  enabled: false,
  startMin: 9 * 60,
  endMin: 17 * 60
};

export function defaultBusinessHoursWeek(): BusinessHoursWeek {
  return [
    { ...DEFAULT_BUSINESS_DAY_OFF },
    { ...DEFAULT_BUSINESS_DAY_OFF },
    { ...DEFAULT_BUSINESS_DAY_OFF },
    { ...DEFAULT_BUSINESS_DAY_OFF },
    { ...DEFAULT_BUSINESS_DAY_OFF },
    { ...DEFAULT_BUSINESS_DAY_OFF },
    { ...DEFAULT_BUSINESS_DAY_OFF }
  ];
}

export function businessHoursPolicyActive(week: BusinessHoursWeek): boolean {
  return week.some((d) => d.enabled);
}

function clampDay(c: BusinessDayConfig): BusinessDayConfig {
  const startMin = Math.max(0, Math.min(24 * 60 - 1, Math.floor(c.startMin)));
  let endMin = Math.max(0, Math.min(24 * 60, Math.floor(c.endMin)));
  if (endMin <= startMin) endMin = Math.min(24 * 60, startMin + 60);
  return { enabled: c.enabled, startMin, endMin };
}

function parseWeek(raw: unknown): BusinessHoursWeek | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null;
  const next = defaultBusinessHoursWeek();
  for (let i = 0; i < 7; i++) {
    const o = raw[i] as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    next[i] = clampDay({
      enabled: Boolean(o.enabled),
      startMin: Number(o.startMin),
      endMin: Number(o.endMin)
    });
  }
  return next;
}

export function loadBusinessHoursWeek(): BusinessHoursWeek {
  if (typeof localStorage === "undefined") return defaultBusinessHoursWeek();
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) ?? "") as unknown;
    const parsed = parseWeek(v);
    return parsed ?? defaultBusinessHoursWeek();
  } catch {
    return defaultBusinessHoursWeek();
  }
}

export function saveBusinessHoursWeek(week: BusinessHoursWeek): void {
  if (typeof localStorage === "undefined") return;
  const normalized = week.map((d) => clampDay(d)) as BusinessHoursWeek;
  localStorage.setItem(LS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(BUSINESS_HOURS_CHANGED));
}

export function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseHHMMToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function useBusinessHoursWeek(): BusinessHoursWeek {
  const [week, setWeek] = useState<BusinessHoursWeek>(() => loadBusinessHoursWeek());

  const refresh = useCallback(() => {
    setWeek(loadBusinessHoursWeek());
  }, []);

  useEffect(() => {
    window.addEventListener(BUSINESS_HOURS_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(BUSINESS_HOURS_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  return week;
}
