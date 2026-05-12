import { useCallback, useMemo, useRef, useState } from "react";
import type { Appointment, IntakeAvailability } from "../lib/models";
import { availabilityOverlayRectsForDay } from "../lib/calendarClientAvailability";
import {
  bestSegmentConstrainedDragStart,
  businessHoursSegmentsForDay,
  complementGridSegments,
  effectiveStudioBookingSegmentsForDay,
  segmentListOverlayRects,
  slotBlockFitsEffectiveBookingSegments
} from "../lib/calendarBusinessHours";
import { businessHoursPolicyActive, useBusinessHoursWeek } from "../lib/businessHours";

const WEEK_GRID_FIRST_HOUR = 7;
const WEEK_GRID_LAST_HOUR = 21;
const WEEK_PX_PER_HOUR = 48;
const WEEK_GRID_SPAN_MIN = (WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR + 1) * 60;
const WEEK_SLOT_MINUTES = 15;

const WEEK_HOUR_ROWS = Array.from(
  { length: WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR + 1 },
  (_, i) => WEEK_GRID_FIRST_HOUR + i
);

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

function calendarDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startMinFromOffsetY(offsetY: number) {
  const rawMin = (offsetY / WEEK_PX_PER_HOUR) * 60;
  const snapped = Math.round(rawMin / WEEK_SLOT_MINUTES) * WEEK_SLOT_MINUTES;
  return Math.max(0, Math.min(snapped, WEEK_GRID_SPAN_MIN));
}

/** Snap a block of `durationMins` that contains the pointer’s Y position. */
function weekSlotFromOffsetY(offsetY: number, durationMins: number) {
  const rawMin = (offsetY / WEEK_PX_PER_HOUR) * 60;
  const snapped = Math.round(rawMin / WEEK_SLOT_MINUTES) * WEEK_SLOT_MINUTES;
  const maxStart = Math.max(0, WEEK_GRID_SPAN_MIN - durationMins);
  const startMinFromGrid = Math.max(0, Math.min(snapped, maxStart));
  const top = (startMinFromGrid / 60) * WEEK_PX_PER_HOUR;
  const height = (durationMins / 60) * WEEK_PX_PER_HOUR;
  return { top, height, startMinFromGrid };
}

function slotStartISOForDay(day: Date, startMinFromGrid: number): string {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  const totalMins = WEEK_GRID_FIRST_HOUR * 60 + startMinFromGrid;
  d.setHours(Math.floor(totalMins / 60), totalMins % 60, 0, 0);
  return d.toISOString();
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function slotConflicts(iso: string, durationMins: number, appointments: Appointment[], extraRanges: { start: Date; end: Date }[]) {
  const s = new Date(iso);
  if (Number.isNaN(s.getTime())) return "Invalid time.";
  const e = new Date(s.getTime() + durationMins * 60 * 1000);
  for (const a of appointments) {
    const as = new Date(a.startISO);
    const ae = new Date(a.endISO);
    if (rangesOverlap(s, e, as, ae)) return "That time overlaps another event on your calendar.";
  }
  for (const r of extraRanges) {
    if (rangesOverlap(s, e, r.start, r.end)) return "That overlaps another selected offer time.";
  }
  return null;
}

const weekColumnGuideStyle = {
  backgroundImage:
    "repeating-linear-gradient(to bottom, transparent 0px, transparent 103px, rgba(0, 0, 0, 0.045) 103px, rgba(0, 0, 0, 0.045) 104px)"
} as const;

type SlotDrag = { dayKey: string; pointerId: number };

export type OfferWeekTimePickerProps = {
  durationMins: number;
  selectedSlotISOs: string[];
  maxSlots?: number;
  appointments: Appointment[];
  onChange: (next: string[]) => void;
  /** When set, shaded regions match client intake preferences and new slots must fall inside them (Tue–Sat). */
  clientAvailabilitySelections?: IntakeAvailability | null;
};

export default function OfferWeekTimePicker({
  durationMins,
  selectedSlotISOs,
  maxSlots = 5,
  appointments,
  onChange,
  clientAvailabilitySelections = null
}: OfferWeekTimePickerProps) {
  const businessWeek = useBusinessHoursWeek();
  const businessPolicyActive = businessHoursPolicyActive(businessWeek);

  const [weekAnchor, setWeekAnchor] = useState(() => calendarDate(new Date()));
  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekGridHeight = (WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR + 1) * WEEK_PX_PER_HOUR;

  const [hover, setHover] = useState<{ dayKey: string; top: number; height: number } | null>(null);
  const dragRef = useRef<SlotDrag | null>(null);

  const dowLetters = ["S", "M", "T", "W", "T", "F", "S"];

  const slotVisualForPointer = useCallback(
    (d: Date, offsetY: number, dm: number) => {
      const segs = effectiveStudioBookingSegmentsForDay(
        d,
        clientAvailabilitySelections ?? null,
        businessWeek,
        WEEK_GRID_FIRST_HOUR,
        WEEK_GRID_LAST_HOUR
      );
      if (segs === null) {
        return weekSlotFromOffsetY(offsetY, dm);
      }
      if (segs.length === 0) {
        return { top: 0, height: 0, startMinFromGrid: -1 };
      }
      const start = bestSegmentConstrainedDragStart(
        segs,
        offsetY,
        WEEK_GRID_FIRST_HOUR,
        WEEK_GRID_LAST_HOUR,
        WEEK_SLOT_MINUTES,
        dm,
        startMinFromOffsetY
      );
      if (start === null) {
        return { top: 0, height: 0, startMinFromGrid: -1 };
      }
      return {
        top: (start / 60) * WEEK_PX_PER_HOUR,
        height: (dm / 60) * WEEK_PX_PER_HOUR,
        startMinFromGrid: start
      };
    },
    [businessWeek, clientAvailabilitySelections]
  );

  const extraRanges = useMemo(() => {
    return selectedSlotISOs.map((iso) => {
      const s = new Date(iso);
      return { start: s, end: new Date(s.getTime() + durationMins * 60 * 1000) };
    });
  }, [selectedSlotISOs, durationMins]);

  const removeSlot = useCallback(
    (iso: string) => {
      onChange(selectedSlotISOs.filter((x) => x !== iso));
    },
    [onChange, selectedSlotISOs]
  );

  const tryAdd = useCallback(
    (iso: string) => {
      if (selectedSlotISOs.length >= maxSlots) return;
      const uniq = new Set(selectedSlotISOs);
      if (uniq.has(iso)) return;
      const others = selectedSlotISOs.map((s) => {
        const st = new Date(s);
        return { start: st, end: new Date(st.getTime() + durationMins * 60 * 1000) };
      });
      const err = slotConflicts(iso, durationMins, appointments, others);
      if (err) {
        window.alert(err);
        return;
      }
      if (
        !slotBlockFitsEffectiveBookingSegments(
          iso,
          durationMins,
          effectiveStudioBookingSegmentsForDay(
            new Date(iso),
            clientAvailabilitySelections ?? null,
            businessWeek,
            WEEK_GRID_FIRST_HOUR,
            WEEK_GRID_LAST_HOUR
          ),
          WEEK_GRID_FIRST_HOUR
        )
      ) {
        window.alert(
          "That time is outside this client’s preferred availability (shaded areas)."
        );
        return;
      }
      onChange([...selectedSlotISOs, iso].sort((a, b) => a.localeCompare(b)));
    },
    [appointments, businessWeek, clientAvailabilitySelections, durationMins, maxSlots, onChange, selectedSlotISOs]
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-display text-[11px] uppercase tracking-pepla text-slateGrey/80">Select times</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-slateGrey/20 px-2 py-1 font-display text-[10px] uppercase tracking-pepla text-slateGrey/80 hover:bg-white/60"
            onClick={() => setWeekAnchor((w) => addDays(w, -7))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-lg border border-slateGrey/20 px-2 py-1 font-display text-[10px] uppercase tracking-pepla text-slateGrey/80 hover:bg-white/60"
            onClick={() => setWeekAnchor((w) => addDays(w, 7))}
          >
            Next
          </button>
        </div>
      </div>
      <p className="font-body text-xs text-slateGrey/65">
        Drag on a day to place a {durationMins}-minute block (up to {maxSlots} options). Release to add the snapped start
        time.
        {clientAvailabilitySelections || businessPolicyActive ? (
          <span className="mt-1 block text-slateGrey/55">
            {businessPolicyActive ? (
              <>
                Your usual business hours appear as a clear column (shaded is outside that window) as a guide only —
                you can still place offer slots there.{" "}
                {clientAvailabilitySelections
                  ? "Blue bands are this client’s preferred mornings (9–12) and afternoons (12–5) on Tue–Sat; slots must fall inside those where shown."
                  : ""}
              </>
            ) : (
              <>
                Shaded bands match this client’s preferred mornings (9–12) and afternoons (12–5) on Tue–Sat; new slots
                must fall inside them on those days.
              </>
            )}
          </span>
        ) : null}
      </p>

      <div className="max-h-[min(22rem,55vh)] overflow-auto rounded-xl border border-slateGrey/15 bg-chalk/80">
        <div className="min-w-[36rem]">
          <div className="sticky top-0 z-10 flex border-b border-slateGrey/10 bg-chalk/95 pb-2 backdrop-blur">
            <div className="min-w-[2.5rem] shrink-0 sm:min-w-10" aria-hidden />
            <div className="grid min-w-0 flex-1 grid-cols-7">
              {weekDays.map((d) => {
                const dk = isoDate(d);
                const isToday = calendarDate(d).getTime() === calendarDate(new Date()).getTime();
                return (
                  <div key={dk} className="flex min-w-0 flex-col items-center gap-0.5 pt-2 text-center">
                    <span className="font-display text-[8px] uppercase tracking-[0.2em] text-slateGrey/45">
                      {dowLetters[d.getDay()]}
                    </span>
                    <span className={`font-body text-[11px] tabular-nums ${isToday ? "font-semibold text-slateGrey" : "text-slateGrey/80"}`}>
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-stretch">
            <div className="sticky left-0 z-10 flex shrink-0 flex-col bg-chalk/95 pb-1">
              {WEEK_HOUR_ROWS.map((h) => (
                <div
                  key={h}
                  className="flex min-w-[2.5rem] max-w-[2.5rem] shrink-0 justify-center pt-0.5 sm:min-w-10 sm:max-w-10"
                  style={{ height: WEEK_PX_PER_HOUR }}
                >
                  <span className="font-display text-[8px] tabular-nums text-slateGrey/40">
                    {new Date(2000, 0, 1, h, 0).toLocaleTimeString([], { hour: "numeric" })}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-7">
              {weekDays.map((d) => {
                const k = isoDate(d);
                const isPastCol = calendarDate(d) < calendarDate(new Date());
                const dm = Math.max(15, durationMins);
                return (
                  <div
                    key={k}
                    className={["relative min-w-0 border-l border-slateGrey/10 first:border-l-0", isPastCol ? "bg-slateGrey/[0.04]" : ""].join(
                      " "
                    )}
                    style={{ ...weekColumnGuideStyle, minHeight: weekGridHeight }}
                  >
                    {businessPolicyActive && (
                      <div className="pointer-events-none absolute inset-0 z-0 mx-0.5" aria-hidden>
                        {segmentListOverlayRects(
                          complementGridSegments(
                            businessHoursSegmentsForDay(d, businessWeek, WEEK_GRID_FIRST_HOUR, WEEK_GRID_LAST_HOUR),
                            WEEK_GRID_FIRST_HOUR,
                            WEEK_GRID_LAST_HOUR
                          ),
                          WEEK_PX_PER_HOUR
                        ).map((rect, idx) => (
                          <div
                            key={`biz-${idx}`}
                            className="absolute inset-x-0 rounded-sm bg-slateGrey/[0.09]"
                            style={{ top: rect.top, height: Math.max(rect.height, 6) }}
                          />
                        ))}
                      </div>
                    )}
                    {clientAvailabilitySelections && (
                      <div className="pointer-events-none absolute inset-0 z-[1] mx-0.5" aria-hidden>
                        {availabilityOverlayRectsForDay(
                          d,
                          clientAvailabilitySelections,
                          WEEK_GRID_FIRST_HOUR,
                          WEEK_GRID_LAST_HOUR,
                          WEEK_PX_PER_HOUR
                        ).map((rect, idx) => (
                          <div
                            key={idx}
                            className="absolute inset-x-0 rounded-sm bg-sky/35 ring-1 ring-sky/45"
                            style={{ top: rect.top, height: Math.max(rect.height, 6) }}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`Drag to add ${dm} minutes on ${d.toDateString()}`}
                      className="absolute inset-0 z-[1] w-full cursor-crosshair border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slateGrey/25"
                      onPointerMove={(e) => {
                        if (dragRef.current?.dayKey === k && dragRef.current.pointerId === e.pointerId) {
                          const { top, height } = slotVisualForPointer(d, e.nativeEvent.offsetY, dm);
                          setHover({ dayKey: k, top, height });
                          return;
                        }
                        if (dragRef.current) return;
                        const { top, height } = slotVisualForPointer(d, e.nativeEvent.offsetY, dm);
                        setHover({ dayKey: k, top, height });
                      }}
                      onPointerLeave={() => {
                        if (!dragRef.current) setHover(null);
                      }}
                      onPointerDown={(e) => {
                        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                        dragRef.current = { dayKey: k, pointerId: e.pointerId };
                        const { top, height } = slotVisualForPointer(d, e.nativeEvent.offsetY, dm);
                        setHover({ dayKey: k, top, height });
                      }}
                      onPointerUp={(e) => {
                        const cur = dragRef.current;
                        if (!cur || cur.pointerId !== e.pointerId || cur.dayKey !== k) return;
                        dragRef.current = null;
                        setHover(null);
                        const { startMinFromGrid } = slotVisualForPointer(d, e.nativeEvent.offsetY, dm);
                        if (startMinFromGrid < 0) return;
                        const iso = slotStartISOForDay(d, startMinFromGrid);
                        tryAdd(iso);
                      }}
                      onPointerCancel={() => {
                        dragRef.current = null;
                        setHover(null);
                      }}
                    />
                    {hover?.dayKey === k && (
                      <div
                        className="pointer-events-none absolute inset-x-0.5 z-[2] rounded-md border-2 border-dashed border-[#7C1618]/60 bg-[#7C1618]/10"
                        style={{ top: hover.top, height: hover.height }}
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedSlotISOs.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selectedSlotISOs.map((iso) => {
            const dt = new Date(iso);
            const label = `${dt.toLocaleDateString([], { weekday: "short" })} ${dt.getMonth() + 1}.${dt.getDate()} · ${dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
            return (
              <li
                key={iso}
                className="flex items-center gap-1 rounded-lg border border-slateGrey/20 bg-white/70 px-2 py-1 font-body text-xs text-slateGrey"
              >
                <span>{label}</span>
                <button
                  type="button"
                  className="rounded px-1 font-display text-[10px] uppercase text-slateGrey/60 hover:bg-slateGrey/10"
                  aria-label="Remove time"
                  onClick={() => removeSlot(iso)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
