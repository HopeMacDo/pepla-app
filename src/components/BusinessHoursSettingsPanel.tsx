import { useCallback, useEffect, useRef, useState } from "react";
import type { BusinessDayConfig, BusinessHoursWeek } from "../lib/businessHours";
import {
  defaultBusinessHoursWeek,
  loadBusinessHoursWeek,
  minutesToHHMM,
  parseHHMMToMinutes,
  saveBusinessHoursWeek
} from "../lib/businessHours";
import { Input } from "../ui/primitives";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const DEFAULT_OPEN_START = 9 * 60;
const DEFAULT_OPEN_END = 17 * 60;

const CLOSED_DISPLAY = "--:--";

function patchDay(week: BusinessHoursWeek, index: number, patch: Partial<BusinessDayConfig>): BusinessHoursWeek {
  return week.map((d, i) => (i === index ? { ...d, ...patch } : d)) as BusinessHoursWeek;
}

export default function BusinessHoursSettingsPanel() {
  const [week, setWeek] = useState<BusinessHoursWeek>(() => loadBusinessHoursWeek());
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [draftStart, setDraftStart] = useState(minutesToHHMM(DEFAULT_OPEN_START));
  const [draftEnd, setDraftEnd] = useState(minutesToHHMM(DEFAULT_OPEN_END));
  const menuRef = useRef<HTMLDivElement>(null);

  const persist = useCallback((next: BusinessHoursWeek) => {
    saveBusinessHoursWeek(next);
  }, []);

  const openMenu = (index: number) => {
    const row = week[index]!;
    if (row.enabled) {
      setDraftStart(minutesToHHMM(row.startMin));
      setDraftEnd(minutesToHHMM(row.endMin));
    } else {
      setDraftStart(minutesToHHMM(DEFAULT_OPEN_START));
      setDraftEnd(minutesToHHMM(DEFAULT_OPEN_END));
    }
    setMenuIndex(index);
  };

  const closeMenu = () => setMenuIndex(null);

  useEffect(() => {
    if (menuIndex === null) return;
    const onDoc = (e: MouseEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuIndex]);

  const applyClosed = (index: number) => {
    setWeek((w) => {
      const next = patchDay(w, index, { enabled: false });
      persist(next);
      return next;
    });
    closeMenu();
  };

  const applyTimes = (index: number) => {
    const sm = parseHHMMToMinutes(draftStart);
    const em = parseHHMMToMinutes(draftEnd);
    if (sm === null || em === null) return;
    if (em <= sm) return;
    setWeek((w) => {
      const next = patchDay(w, index, { enabled: true, startMin: sm, endMin: em });
      persist(next);
      return next;
    });
    closeMenu();
  };

  const onResetAll = () => {
    const next = defaultBusinessHoursWeek();
    setWeek(next);
    persist(next);
    closeMenu();
  };

  return (
    <div ref={menuRef} className="max-w-md">
      <ul className="divide-y divide-slateGrey/10">
        {DAY_LABELS.map((label, index) => {
          const row = week[index]!;
          const isMenuOpen = menuIndex === index;
          const summary =
            row.enabled && row.endMin > row.startMin
              ? `${minutesToHHMM(row.startMin)} – ${minutesToHHMM(row.endMin)}`
              : `${CLOSED_DISPLAY} – ${CLOSED_DISPLAY}`;

          return (
            <li key={label} className="relative flex items-center justify-between gap-4 py-4">
              <span className="shrink-0 font-display text-xs uppercase tracking-pepla text-slateGrey">{label}</span>
              <div className="relative min-w-0 text-right">
                <button
                  type="button"
                  aria-expanded={isMenuOpen}
                  aria-haspopup="dialog"
                  aria-label={`${label} hours, ${row.enabled ? "open" : "closed"}`}
                  onClick={() => (isMenuOpen ? closeMenu() : openMenu(index))}
                  className="font-body text-sm tabular-nums text-slateGrey transition hover:text-slateGrey/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/25 focus-visible:ring-offset-2 focus-visible:ring-offset-chalk"
                >
                  {summary}
                </button>

                {isMenuOpen ? (
                  <div
                    role="dialog"
                    aria-label={`Edit ${label}`}
                    className="absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-slateGrey/15 bg-chalk/98 py-3 shadow-lg backdrop-blur-sm"
                  >
                    <div className="border-b border-slateGrey/10 px-3 pb-2">
                      <button
                        type="button"
                        className="w-full rounded-lg py-2 text-left font-body text-sm text-slateGrey hover:bg-slateGrey/5"
                        onClick={() => applyClosed(index)}
                      >
                        Closed
                      </button>
                    </div>
                    <div className="grid gap-3 px-3 pt-3">
                      <p className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/50">Custom hours</p>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-1">
                          <span className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/55">
                            Start
                          </span>
                          <Input
                            type="time"
                            value={draftStart}
                            onChange={(e) => setDraftStart(e.target.value)}
                            className="font-body text-sm tabular-nums"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/55">End</span>
                          <Input
                            type="time"
                            value={draftEnd}
                            onChange={(e) => setDraftEnd(e.target.value)}
                            className="font-body text-sm tabular-nums"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg bg-slateGrey/10 py-2 font-display text-[11px] uppercase tracking-pepla text-slateGrey transition hover:bg-slateGrey/15"
                        onClick={() => applyTimes(index)}
                      >
                        Apply hours
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onResetAll}
        className="mt-6 font-body text-sm text-slateGrey/55 underline decoration-slateGrey/25 underline-offset-2 transition hover:text-slateGrey/80"
      >
        Reset all to closed
      </button>
    </div>
  );
}
