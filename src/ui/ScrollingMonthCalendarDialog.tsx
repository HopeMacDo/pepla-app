import { useEffect, useMemo, useRef } from "react";

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function calendarDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isoMonthLabel(d: Date) {
  return d.toLocaleDateString([], { month: "long", year: "numeric" });
}

/** Single-month grid for picker: leading/trailing empty slots, no adjacent-month dates. */
function buildPickerMonthCells(monthAnchor: Date): (number | null)[] {
  const first = startOfMonth(monthAnchor);
  const lastDay = endOfMonth(monthAnchor).getDate();
  const lead = first.getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  const trail = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trail; i++) cells.push(null);
  return cells;
}

const MONTH_PICKER_PAST = 48;
const MONTH_PICKER_FUTURE = 72;

const PICKER_DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const iconBtnBase =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-0 bg-transparent text-slateGrey shadow-none outline-none transition hover:bg-slateGrey/5 hover:shadow-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-slateGrey/20";

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export type ScrollingMonthCalendarDialogProps = {
  open: boolean;
  /** Local calendar date for selection highlight and scroll-into-view */
  selectedDate: Date;
  onClose: () => void;
  /** Local calendar date (midnight) when user picks a day or Today */
  onSelectDay: (d: Date) => void;
};

/**
 * Same scrolling multi-month picker as the Calendar page (“Select a Day” sheet).
 */
export function ScrollingMonthCalendarDialog({
  open,
  selectedDate,
  onClose,
  onSelectDay
}: ScrollingMonthCalendarDialogProps) {
  const activePickerMonthRef = useRef<HTMLDivElement | null>(null);

  const pickerMonths = useMemo(() => {
    const start = startOfMonth(new Date());
    const list: Date[] = [];
    for (let i = -MONTH_PICKER_PAST; i <= MONTH_PICKER_FUTURE; i++) {
      list.push(addMonths(start, i));
    }
    return list;
  }, []);

  const selectedKey = isoDate(calendarDate(selectedDate));

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      activePickerMonthRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [open, selectedKey]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slateGrey/30 p-4 sm:items-center sm:p-8"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[min(36rem,90vh)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slateGrey/15 bg-chalk/95 shadow-xl backdrop-blur"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scrolling-month-picker-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="grid shrink-0 grid-cols-3 items-center gap-1 border-b border-slateGrey/10 px-2 py-3 sm:px-3">
          <div className="flex justify-start">
            <button type="button" className={iconBtnBase} aria-label="Close" onClick={onClose}>
              <IconClose className="h-5 w-5" />
            </button>
          </div>
          <h2
            id="scrolling-month-picker-title"
            className="min-w-0 truncate text-center font-body text-sm font-semibold text-slateGrey sm:text-base"
          >
            Select a Day
          </h2>
          <div className="flex justify-end">
            <button
              type="button"
              className="font-body text-sm font-semibold text-slateGrey underline decoration-slateGrey/50 underline-offset-4 transition hover:decoration-slateGrey"
              onClick={() => onSelectDay(calendarDate(new Date()))}
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-7 border-b border-slateGrey/10 px-2 py-2 sm:px-3">
          {PICKER_DOW_LABELS.map((label, i) => (
            <div
              key={`${label}-${i}`}
              className="text-center font-display text-[8px] font-normal uppercase tracking-[0.2em] text-slateGrey/45 sm:text-[9px]"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4">
          {pickerMonths.map((m) => {
            const monthKey = `${m.getFullYear()}-${m.getMonth()}`;
            const cells = buildPickerMonthCells(m);
            const scrollHere = sameMonth(m, calendarDate(selectedDate));
            return (
              <section
                key={monthKey}
                ref={scrollHere ? activePickerMonthRef : undefined}
                className="pb-8 last:pb-4"
                aria-label={isoMonthLabel(m)}
              >
                <h3 className="py-4 text-center font-body text-base font-semibold text-slateGrey sm:text-[17px]">
                  {isoMonthLabel(m)}
                </h3>
                <div className="grid grid-cols-7 gap-y-2 sm:gap-y-3">
                  {cells.map((dayNum, idx) => {
                    if (dayNum == null) {
                      return <div key={`${monthKey}-e-${idx}`} className="aspect-square min-h-[2.25rem]" />;
                    }
                    const cellDate = calendarDate(new Date(m.getFullYear(), m.getMonth(), dayNum));
                    const k = isoDate(cellDate);
                    const isSelected = k === selectedKey;
                    const isTodayCell = sameDay(cellDate, new Date());
                    return (
                      <div
                        key={`${monthKey}-${dayNum}`}
                        className="flex aspect-square min-h-[2.25rem] items-start justify-center pt-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectDay(cellDate)}
                          className="flex h-8 w-8 items-center justify-center rounded-full font-body text-[13px] font-normal tabular-nums text-slateGrey transition hover:bg-slateGrey/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/25 sm:h-9 sm:w-9 sm:text-sm"
                        >
                          {isSelected ? (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#7C1618] text-[13px] leading-none text-white sm:h-9 sm:w-9 sm:text-sm">
                              {dayNum}
                            </span>
                          ) : isTodayCell ? (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2b2b2b] text-[13px] leading-none text-white sm:h-9 sm:w-9 sm:text-sm">
                              {dayNum}
                            </span>
                          ) : (
                            dayNum
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
