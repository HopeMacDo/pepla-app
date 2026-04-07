import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label, Textarea } from "../ui/primitives";
import { ScrollingMonthCalendarDialog } from "../ui/ScrollingMonthCalendarDialog";
import type { Appointment } from "../lib/models";
import { deleteAppointment, listAppointments, putAppointment } from "../lib/storage";

type CalendarViewMode = "month" | "week" | "day";

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODate(input: string): Date {
  const [y, m, d] = input.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
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

function addDays(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

/** Sunday-start week, local midnight. */
function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function calendarDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Inclusive last hour row label (e.g. 21 → 9 PM block). */
const WEEK_GRID_FIRST_HOUR = 7;
const WEEK_GRID_LAST_HOUR = 21;
const WEEK_PX_PER_HOUR = 52;

/** Horizontal guides every N hours — lighter than a line per hour (matches monthly’s calmer grid). */
const WEEK_GUIDE_EVERY_HOURS = 2;

const WEEK_GRID_SPAN_MIN = (WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR + 1) * 60;
const WEEK_SLOT_MINUTES = 15;
/** Centered hover preview in week/day grid: always one hour tall. */
const HOVER_PREVIEW_DURATION_MINS = 60;

/** Selection grows from locked start; at least one hour, then follows pointer in 15-min steps (clamped to grid). */
function dragSelectionDurationMins(startMin: number, pointerMinSnap: number) {
  const span = Math.max(0, pointerMinSnap - startMin);
  const dur = Math.max(HOVER_PREVIEW_DURATION_MINS, span);
  const maxDur = Math.max(HOVER_PREVIEW_DURATION_MINS, WEEK_GRID_SPAN_MIN - startMin);
  return Math.min(dur, maxDur);
}

function weekSlotFromOffsetY(offsetY: number, durationMins: number) {
  const rawMin = (offsetY / WEEK_PX_PER_HOUR) * 60;
  const snapped = Math.round(rawMin / WEEK_SLOT_MINUTES) * WEEK_SLOT_MINUTES;
  const maxStart = Math.max(0, WEEK_GRID_SPAN_MIN - durationMins);
  const startMinFromGrid = Math.max(0, Math.min(snapped, maxStart));
  const top = (startMinFromGrid / 60) * WEEK_PX_PER_HOUR;
  const height = (durationMins / 60) * WEEK_PX_PER_HOUR;
  return { top, height, startMinFromGrid };
}

function startMinFromOffsetY(offsetY: number) {
  const rawMin = (offsetY / WEEK_PX_PER_HOUR) * 60;
  const snapped = Math.round(rawMin / WEEK_SLOT_MINUTES) * WEEK_SLOT_MINUTES;
  return Math.max(0, Math.min(snapped, WEEK_GRID_SPAN_MIN));
}

function weekHoverSlotFromOffsetY(offsetY: number, durationMins: number) {
  // Hover preview highlights the hour block that contains the cursor.
  const cursorMin = startMinFromOffsetY(offsetY);
  const hourBlockStart = Math.floor(cursorMin / 60) * 60;
  const maxStart = Math.max(0, WEEK_GRID_SPAN_MIN - durationMins);
  const startMinFromGrid = Math.max(0, Math.min(hourBlockStart, maxStart));
  const top = (startMinFromGrid / 60) * WEEK_PX_PER_HOUR;
  const height = (durationMins / 60) * WEEK_PX_PER_HOUR;
  return { top, height, startMinFromGrid };
}

function timeStringFromGridStartMinutes(startMinFromGrid: number) {
  const h = WEEK_GRID_FIRST_HOUR + Math.floor(startMinFromGrid / 60);
  const mm = startMinFromGrid % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const WEEK_HOUR_ROWS = Array.from(
  { length: WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR + 1 },
  (_, i) => WEEK_GRID_FIRST_HOUR + i
);

function layoutApptInWeekGrid(a: Appointment): { top: number; height: number } | null {
  const start = new Date(a.startISO);
  const end = new Date(a.endISO);
  let startMin = start.getHours() * 60 + start.getMinutes() - WEEK_GRID_FIRST_HOUR * 60;
  let endMin = end.getHours() * 60 + end.getMinutes() - WEEK_GRID_FIRST_HOUR * 60;
  const gridMax = (WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR + 1) * 60;
  if (endMin <= 0 || startMin >= gridMax) return null;
  startMin = Math.max(0, startMin);
  endMin = Math.min(gridMax, endMin);
  const top = (startMin / 60) * WEEK_PX_PER_HOUR;
  const height = Math.max(((endMin - startMin) / 60) * WEEK_PX_PER_HOUR, 22);
  return { top, height };
}

function weekApptVariant(id: string) {
  return id.charCodeAt(0) % 2 === 0 ? "solid" : "soft";
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isoMonthLabel(d: Date) {
  return d.toLocaleDateString([], { month: "long", year: "numeric" });
}

function dayKey(d: Date) {
  return isoDate(d);
}

function buildMonthGrid(month: Date) {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // Sunday start

  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));

  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(d);
  }
  return days;
}

/** ISO 8601 week number (1–53) for the local calendar date. */
function isoWeekNumber(dt: Date): number {
  const t = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const dayNr = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dayNr + 3);
  const firstThursday = t.getTime();
  t.setMonth(0, 1);
  if (t.getDay() !== 4) {
    t.setMonth(0, 1 + ((4 - t.getDay() + 7) % 7));
  }
  return 1 + Math.round((firstThursday - t.getTime()) / 604800000);
}

function defaultStartForDay(d: Date) {
  const start = new Date(d);
  start.setHours(11, 0, 0, 0);
  return start;
}

function apptSummaryDots(count: number) {
  const max = 3;
  return Array.from({ length: Math.min(max, count) }, (_, i) => i);
}

const VIEW_OPTIONS: { id: CalendarViewMode; label: string }[] = [
  { id: "month", label: "Monthly" },
  { id: "week", label: "Weekly" },
  { id: "day", label: "Daily" }
];

const iconBtnBase =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-0 bg-transparent text-slateGrey shadow-none outline-none transition hover:bg-slateGrey/5 hover:shadow-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-slateGrey/20";

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconDotsVertical({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

export default function CalendarStep() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("month");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [weekCursor, setWeekCursor] = useState(() => calendarDate(new Date()));
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [slotMenu, setSlotMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    dateISO: string;
    timeHHMM: string;
    durationMins: number;
  } | null>(null);
  type SlotDrag = { k: string; d: Date; startMinFromGrid: number; pointerId: number };
  const slotDragRef = useRef<SlotDrag | null>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const slotMenuRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [customerName, setCustomerName] = useState(() => sp.get("name") ?? "");
  const [phoneNumber, setPhoneNumber] = useState(() => sp.get("phone") ?? "");
  const [notes, setNotes] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newStartTime, setNewStartTime] = useState("11:00");
  const [durationMins, setDurationMins] = useState(60);
  const [hoveredMonthWeekRow, setHoveredMonthWeekRow] = useState<number | null>(null);
  const [hoveredMonthDayKey, setHoveredMonthDayKey] = useState<string | null>(null);
  const [weekSlotHover, setWeekSlotHover] = useState<{ k: string; top: number; height: number } | null>(null);
  const [hoveredWeekHeaderDayKey, setHoveredWeekHeaderDayKey] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const weekScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const existing = await listAppointments();
      if (existing.length === 0) {
        const seedMonth = new Date();
        const mk = (dayOffset: number, hour: number, minute: number, name: string, note?: string) => {
          const base = new Date(seedMonth.getFullYear(), seedMonth.getMonth(), Math.max(1, 5 + dayOffset), hour, minute, 0, 0);
          const end = new Date(base.getTime() + 60 * 60 * 1000);
          return {
            id: crypto.randomUUID(),
            kind: "appointment",
            startISO: base.toISOString(),
            endISO: end.toISOString(),
            customerName: name,
            phoneNumber: "+1 (760) 555-0123",
            notes: note
          } satisfies Appointment;
        };
        const mkOnDay = (day: Date, hour: number, minute: number, durationMins: number, name: string, note?: string) => {
          const base = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
          const end = new Date(base.getTime() + durationMins * 60 * 1000);
          return {
            id: crypto.randomUUID(),
            kind: "appointment",
            startISO: base.toISOString(),
            endISO: end.toISOString(),
            customerName: name,
            phoneNumber: "+1 (760) 555-0123",
            notes: note
          } satisfies Appointment;
        };
        const thisWeekStart = startOfWeek(calendarDate(new Date()));
        const weekDemo: Appointment[] = [
          mkOnDay(addDays(thisWeekStart, 0), 9, 0, 90, "Riley Chen", "Flash sheet · linework"),
          mkOnDay(addDays(thisWeekStart, 0), 14, 0, 60, "Sam Ortiz", "Touch-up"),
          mkOnDay(addDays(thisWeekStart, 1), 10, 30, 60, "Jordan Lee", "Consult · placement"),
          mkOnDay(addDays(thisWeekStart, 1), 15, 0, 60, "Quinn Park", "Deposit block"),
          mkOnDay(addDays(thisWeekStart, 2), 11, 0, 120, "Alex Kim", "Session 2 · sleeve"),
          mkOnDay(addDays(thisWeekStart, 3), 9, 30, 60, "Morgan Wu", "Stencil review"),
          mkOnDay(addDays(thisWeekStart, 3), 15, 0, 60, "Taylor Reed", "Healing check"),
          mkOnDay(addDays(thisWeekStart, 4), 10, 0, 60, "Casey Nova", "Lettering"),
          mkOnDay(addDays(thisWeekStart, 4), 16, 30, 90, "Avery Bloom", "Shading pass"),
          mkOnDay(addDays(thisWeekStart, 5), 12, 0, 90, "Drew Ellis", "Color pack"),
          mkOnDay(addDays(thisWeekStart, 6), 11, 0, 60, "Rowan Tate", "Mini piece"),
          mkOnDay(addDays(thisWeekStart, 6), 14, 0, 60, "Sky Loft", "Walk-in consult")
        ];
        const fake: Appointment[] = [
          mk(0, 11, 0, "Aaliyah H.", "Fine-line florals · forearm"),
          mk(0, 14, 30, "Amber A.", "Touch-up · small script"),
          mk(1, 9, 0, "Jordan K.", "Walk-in flash"),
          mk(2, 12, 0, "Jess M.", "Consult · placement + size"),
          mk(3, 15, 0, "Sam T.", "Lining session"),
          mk(4, 10, 0, "River P.", "Small patch-up"),
          mk(4, 16, 0, "Casey L.", "Second sitting"),
          mk(6, 11, 30, "Mel D.", "Lettering"),
          mk(7, 13, 0, "Carmen", "Color refresh · 90 min (placeholder)"),
          mk(8, 9, 0, "Alex R.", "Stencil review"),
          mk(9, 10, 30, "Rylie H.", "Blackwork · ankle"),
          mk(10, 14, 0, "Noah S.", "Sleeve outline"),
          mk(11, 13, 0, "Taylor B.", "Touch-up"),
          mk(12, 10, 0, "Morgan C.", "Consult"),
          mk(14, 15, 30, "Jamie F.", "Healing check"),
          mk(15, 11, 0, "Riley Q.", "Shading"),
          mk(16, 9, 30, "Drew N.", "Add-on symbol"),
          mk(17, 14, 0, "Skyler V.", "Fine line"),
          mk(19, 12, 0, "Charlie W.", "Full day"),
          mk(20, 10, 30, "Pat S.", "Cover-up consult"),
          mk(22, 15, 0, "Kim J.", "Color pack"),
          mk(23, 11, 0, "Lee H.", "Mini piece"),
          ...weekDemo
        ];
        await Promise.all(fake.map((a) => putAppointment(a)));
        setAppointments(await listAppointments());
      } else {
        setAppointments(existing);
      }
    })();
  }, []);

  useEffect(() => {
    if (!viewMenuOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (viewMenuRef.current && !viewMenuRef.current.contains(t)) setViewMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [viewMenuOpen]);

  useEffect(() => {
    if (!monthPickerOpen && !viewMenuOpen && !plusMenuOpen && !slotMenu?.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMonthPickerOpen(false);
        setViewMenuOpen(false);
        setPlusMenuOpen(false);
        setSlotMenu((s) => (s?.open ? { ...s, open: false } : s));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [monthPickerOpen, viewMenuOpen, plusMenuOpen, slotMenu?.open]);

  useEffect(() => {
    if (!plusMenuOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (plusMenuRef.current && !plusMenuRef.current.contains(t)) setPlusMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [plusMenuOpen]);

  useEffect(() => {
    if (!slotMenu?.open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (slotMenuRef.current && !slotMenuRef.current.contains(t)) setSlotMenu((s) => (s ? { ...s, open: false } : s));
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [slotMenu?.open]);

  const apptsForDay = useMemo(() => {
    const day = parseISODate(selectedDate);
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    return appointments
      .filter((a) => {
        const s = new Date(a.startISO);
        return s >= start && s <= end;
      })
      .sort((a, b) => a.startISO.localeCompare(b.startISO));
  }, [appointments, selectedDate]);

  const weekStart = useMemo(() => startOfWeek(weekCursor), [weekCursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const headerTitle = useMemo(() => {
    if (calendarView === "month") return isoMonthLabel(monthCursor);
    if (calendarView === "week") return isoMonthLabel(addDays(weekStart, 3));
    return isoMonthLabel(parseISODate(selectedDate));
  }, [calendarView, monthCursor, selectedDate, weekStart]);

  const monthDays = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const monthApptCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      const k = isoDate(new Date(a.startISO));
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  const apptsByDayKey = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const k = isoDate(new Date(a.startISO));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startISO.localeCompare(b.startISO));
    }
    return map;
  }, [appointments]);

  const dayViewGrid = useMemo(() => {
    const d = calendarDate(parseISODate(selectedDate));
    const k = selectedDate;
    return {
      d,
      k,
      dayAppts: apptsByDayKey.get(k) ?? [],
      isPastCol: calendarDate(d) < calendarDate(new Date()),
      isTodayCol: sameDay(d, new Date())
    };
  }, [selectedDate, apptsByDayKey]);

  const weekGridHeight = (WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR + 1) * WEEK_PX_PER_HOUR;

  const weekColumnGuideStyle = useMemo(() => {
    const period = WEEK_PX_PER_HOUR * WEEK_GUIDE_EVERY_HOURS;
    return {
      height: weekGridHeight,
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${period - 1}px, rgba(0, 0, 0, 0.045) ${period - 1}px, rgba(0, 0, 0, 0.045) ${period}px)`
    } as const;
  }, [weekGridHeight]);

  const nowLineOffsetPx = useMemo(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes() - WEEK_GRID_FIRST_HOUR * 60;
    const maxMins = (WEEK_GRID_LAST_HOUR - WEEK_GRID_FIRST_HOUR + 1) * 60;
    if (mins < 0 || mins > maxMins) return null;
    if (calendarView === "day") {
      if (!sameDay(parseISODate(selectedDate), now)) return null;
      return (mins / 60) * WEEK_PX_PER_HOUR;
    }
    if (!weekDays.some((d) => sameDay(d, now))) return null;
    return (mins / 60) * WEEK_PX_PER_HOUR;
  }, [calendarView, selectedDate, weekDays, nowTick]);

  useEffect(() => {
    if (calendarView !== "week" && calendarView !== "day") return;
    const el = weekScrollRef.current;
    if (!el) return;
    const first = (11 - WEEK_GRID_FIRST_HOUR) * WEEK_PX_PER_HOUR;
    el.scrollTo({ top: Math.max(0, first - WEEK_PX_PER_HOUR), behavior: "auto" });
  }, [calendarView, weekStart, selectedDate]);

  useEffect(() => {
    setWeekSlotHover(null);
  }, [calendarView, weekStart, selectedDate, durationMins]);

  useEffect(() => {
    if (calendarView !== "week") setHoveredWeekHeaderDayKey(null);
  }, [calendarView]);

  const canCreate = useMemo(() => Boolean(customerName.trim() && !busy), [busy, customerName]);

  async function refresh() {
    setAppointments(await listAppointments());
  }

  async function createAppointment() {
    setError(null);
    setBusy(true);
    try {
      const day = parseISODate(selectedDate);
      const [hh, mm] = newStartTime.split(":").map((x) => Number(x));
      const start = new Date(day);
      start.setHours(hh ?? 11, mm ?? 0, 0, 0);
      const end = new Date(start.getTime() + durationMins * 60 * 1000);

      const conflict = apptsForDay.some((a) => {
        const as = new Date(a.startISO);
        const ae = new Date(a.endISO);
        return start < ae && as < end;
      });
      if (conflict) throw new Error("That time overlaps an existing booking.");

      const appt: Appointment = {
        id: crypto.randomUUID(),
        kind: "appointment",
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        notes: notes.trim() || undefined
      };
      await putAppointment(appt);
      await refresh();
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeAppointment(id: string) {
    setBusy(true);
    try {
      await deleteAppointment(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const dowLetters = ["S", "M", "T", "W", "T", "F", "S"];

  function openWeekDayColumn(d: Date) {
    setSelectedDate(isoDate(d));
    const s = defaultStartForDay(d);
    setNewStartTime(`${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`);
    setDetailOpen(true);
  }

  function openWeekSlotForDay(d: Date, startMinFromGrid: number) {
    // legacy detail modal intentionally not used for empty slots anymore
    setSelectedDate(isoDate(d));
    setNewStartTime(timeStringFromGridStartMinutes(startMinFromGrid));
  }

  function openSlotActionMenu(args: {
    x: number;
    y: number;
    d: Date;
    startMinFromGrid: number;
    durationOverrideMins?: number;
  }) {
    const cd = calendarDate(args.d);
    const dateISO = isoDate(cd);
    const timeHHMM = timeStringFromGridStartMinutes(args.startMinFromGrid);
    setSelectedDate(dateISO);
    setNewStartTime(timeHHMM);
    setMonthPickerOpen(false);
    setViewMenuOpen(false);
    setPlusMenuOpen(false);
    const pickedDuration = args.durationOverrideMins ?? durationMins;
    setSlotMenu({
      open: true,
      x: args.x,
      y: args.y,
      dateISO,
      timeHHMM,
      durationMins: pickedDuration
    });
  }

  function goToDailyFromWeekHeader(d: Date) {
    const cd = calendarDate(d);
    setSelectedDate(isoDate(cd));
    setMonthCursor(startOfMonth(cd));
    setWeekCursor(cd);
    setCalendarView("day");
  }

  function openWeekAppt(a: Appointment) {
    setSelectedDate(isoDate(new Date(a.startISO)));
    const s = new Date(a.startISO);
    setNewStartTime(`${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`);
    setDetailOpen(true);
  }

  /** Jump to today: month grid shows this month, week strip shows this week, day uses today as selected date. */
  function jumpToTodayForView() {
    const today = calendarDate(new Date());
    setMonthPickerOpen(false);
    setViewMenuOpen(false);
    setSelectedDate(isoDate(today));
    setMonthCursor(startOfMonth(today));
    setWeekCursor(today);
  }

  /** Switch to monthly view and align the month grid with the title context. */
  function goToMonthlyFromTitle() {
    setMonthPickerOpen(false);
    setViewMenuOpen(false);
    if (calendarView === "week") {
      setMonthCursor(startOfMonth(addDays(weekStart, 3)));
    } else {
      setMonthCursor(startOfMonth(parseISODate(selectedDate)));
    }
    setCalendarView("month");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5">
      <div className="mb-3 flex items-center gap-2 sm:mb-4">
        <div className="relative shrink-0" ref={viewMenuRef}>
          <button
            type="button"
            className={iconBtnBase}
            aria-expanded={viewMenuOpen}
            aria-haspopup="menu"
            aria-label="Calendar view options"
            onClick={() => {
              setMonthPickerOpen(false);
              setViewMenuOpen((o) => !o);
            }}
          >
            <IconDotsVertical className="h-5 w-5 text-slateGrey/80" />
          </button>
          {viewMenuOpen && (
            <div
              className="absolute left-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-xl border border-slateGrey/15 bg-chalk/95 py-1 shadow-lg backdrop-blur"
              role="menu"
              aria-label="Choose calendar view"
            >
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  className={[
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left font-display text-[11px] uppercase tracking-pepla transition hover:bg-white/50",
                    calendarView === opt.id ? "text-slateGrey" : "text-slateGrey/75"
                  ].join(" ")}
                  onClick={() => {
                    if (opt.id === "week" && calendarView !== "week") {
                      setWeekCursor(calendarDate(parseISODate(selectedDate)));
                    }
                    if (opt.id === "month" && calendarView !== "month") {
                      setMonthCursor(startOfMonth(parseISODate(selectedDate)));
                    }
                    if (opt.id === "day" && calendarView !== "day") {
                      const d = calendarDate(parseISODate(selectedDate));
                      setMonthCursor(startOfMonth(d));
                      setWeekCursor(d);
                    }
                    setCalendarView(opt.id);
                    setViewMenuOpen(false);
                  }}
                >
                  <span className="flex w-4 shrink-0 justify-center text-[#7C1618]" aria-hidden>
                    {calendarView === opt.id ? "✓" : ""}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 sm:gap-1">
          <button
            type="button"
            className={iconBtnBase}
            aria-label={
              calendarView === "week" ? "Previous week" : calendarView === "day" ? "Previous day" : "Previous month"
            }
            disabled={busy}
            onClick={() => {
              setMonthPickerOpen(false);
              setViewMenuOpen(false);
              if (calendarView === "month") setMonthCursor((m) => addMonths(m, -1));
              else if (calendarView === "week") setWeekCursor((w) => addDays(w, -7));
              else if (calendarView === "day") {
                const d = calendarDate(addDays(parseISODate(selectedDate), -1));
                setSelectedDate(isoDate(d));
                setMonthCursor(startOfMonth(d));
                setWeekCursor(d);
              }
            }}
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 max-w-[min(100%,17rem)] items-center gap-0.5">
            <button
              type="button"
              className="min-w-0 max-w-full truncate rounded-xl border-0 bg-transparent px-2 py-2 text-left font-['Times_New_Roman',Times,serif] text-base font-normal italic leading-tight text-slateGrey shadow-none outline-none transition select-text hover:bg-slateGrey/5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-slateGrey/20 sm:px-2.5 sm:text-lg"
              aria-label="Open month calendar for this period"
              disabled={busy}
              onClick={goToMonthlyFromTitle}
            >
              {headerTitle}
            </button>
            <button
              type="button"
              className={iconBtnBase}
              aria-expanded={monthPickerOpen}
              aria-haspopup="dialog"
              aria-label="Scroll calendar to choose a date"
              disabled={busy}
              onClick={() => {
                setViewMenuOpen(false);
                setMonthPickerOpen((v) => !v);
              }}
            >
              <IconChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </button>
          </div>

          <button
            type="button"
            className={iconBtnBase}
            aria-label={
              calendarView === "week" ? "Next week" : calendarView === "day" ? "Next day" : "Next month"
            }
            disabled={busy}
            onClick={() => {
              setMonthPickerOpen(false);
              setViewMenuOpen(false);
              if (calendarView === "month") setMonthCursor((m) => addMonths(m, 1));
              else if (calendarView === "week") setWeekCursor((w) => addDays(w, 7));
              else if (calendarView === "day") {
                const d = calendarDate(addDays(parseISODate(selectedDate), 1));
                setSelectedDate(isoDate(d));
                setMonthCursor(startOfMonth(d));
                setWeekCursor(d);
              }
            }}
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div
          className="inline-flex shrink-0 items-center gap-0.5 sm:gap-1"
          role="group"
          aria-label="Calendar quick actions"
        >
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border-0 bg-transparent px-2 font-body text-xs font-normal text-slateGrey shadow-none outline-none transition hover:bg-slateGrey/5 hover:shadow-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-slateGrey/20 sm:px-2.5 sm:text-sm"
            aria-label={
              calendarView === "month"
                ? "Go to today in month view"
                : calendarView === "week"
                  ? "Go to this week"
                  : "Go to today"
            }
            disabled={busy}
            onClick={jumpToTodayForView}
          >
            Today
          </button>
          <div className="relative" ref={plusMenuRef}>
            <button
              type="button"
              className={iconBtnBase}
              aria-label="Create"
              aria-expanded={plusMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setMonthPickerOpen(false);
                setViewMenuOpen(false);
                setPlusMenuOpen((o) => !o);
              }}
            >
              <IconPlus className="h-5 w-5" />
            </button>
            {plusMenuOpen && (
              <div
                className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border border-slateGrey/15 bg-chalk/95 py-1 shadow-lg backdrop-blur"
                role="menu"
                aria-label="Create menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-display text-[11px] uppercase tracking-pepla text-slateGrey/80 transition hover:bg-white/50"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    const qs = new URLSearchParams();
                    qs.set("date", selectedDate);
                    qs.set("time", newStartTime);
                    qs.set("duration", String(durationMins));
                    navigate(`/calendar/new?${qs.toString()}`);
                  }}
                >
                  Create new appointment
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-display text-[11px] uppercase tracking-pepla text-slateGrey/80 transition hover:bg-white/50"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    const qs = new URLSearchParams();
                    qs.set("date", selectedDate);
                    qs.set("time", newStartTime);
                    qs.set("duration", String(durationMins));
                    navigate(`/calendar/block?${qs.toString()}`);
                  }}
                >
                  Block time
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {slotMenu?.open && (
        <div
          ref={slotMenuRef}
          className="fixed z-50 w-56 overflow-hidden rounded-xl border border-slateGrey/15 bg-chalk/95 py-1 shadow-lg backdrop-blur"
          role="menu"
          aria-label="Slot actions"
          style={{
            left: Math.max(8, Math.min(slotMenu.x, window.innerWidth - 8 - 224)),
            top: Math.max(8, Math.min(slotMenu.y, window.innerHeight - 8 - 96))
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-display text-[11px] uppercase tracking-pepla text-slateGrey/80 transition hover:bg-white/50"
            onClick={() => {
              const qs = new URLSearchParams();
              qs.set("date", slotMenu.dateISO);
              qs.set("time", slotMenu.timeHHMM);
              qs.set("duration", String(slotMenu.durationMins));
              setSlotMenu((s) => (s ? { ...s, open: false } : s));
              navigate(`/calendar/new?${qs.toString()}`);
            }}
          >
            Create new appointment
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-display text-[11px] uppercase tracking-pepla text-slateGrey/80 transition hover:bg-white/50"
            onClick={() => {
              const qs = new URLSearchParams();
              qs.set("date", slotMenu.dateISO);
              qs.set("time", slotMenu.timeHHMM);
              qs.set("duration", String(slotMenu.durationMins));
              setSlotMenu((s) => (s ? { ...s, open: false } : s));
              navigate(`/calendar/block?${qs.toString()}`);
            }}
          >
            Block time
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:gap-4">

            {calendarView === "month" && (
              <div className="-mx-1 sm:-mx-0">
                <div className="flex border-b border-slateGrey/10 pb-2">
                  <div className="min-w-[2.75rem] shrink-0 sm:min-w-12" aria-hidden />
                  <div className="grid min-w-0 flex-1 grid-cols-7">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <div
                        key={`${d}-${i}`}
                        className="text-center font-display text-[8px] font-normal uppercase tracking-[0.2em] text-slateGrey/45 sm:text-[9px]"
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
                {Array.from({ length: monthDays.length / 7 }, (_, weekIdx) => {
                  const rowSunday = monthDays[weekIdx * 7];
                  const wk = isoWeekNumber(rowSunday);
                  const wkRowGlow = hoveredMonthWeekRow === weekIdx;
                  return (
                    <div key={weekIdx} className="flex items-stretch border-b border-slateGrey/10 last:border-b-0">
                      <button
                        type="button"
                        aria-label={`Open week ${wk} in weekly view`}
                        onClick={() => {
                          const anchor = calendarDate(rowSunday);
                          setWeekCursor(anchor);
                          setSelectedDate(isoDate(anchor));
                          setCalendarView("week");
                        }}
                        onMouseEnter={() => setHoveredMonthWeekRow(weekIdx)}
                        onMouseLeave={() => setHoveredMonthWeekRow(null)}
                        className={[
                          "flex min-w-[2.75rem] max-w-[2.75rem] shrink-0 flex-col items-center justify-center self-stretch px-0.5 py-1 font-['Times_New_Roman',Times,serif] text-[10px] italic leading-tight text-slateGrey/60 transition sm:min-w-12 sm:max-w-12 sm:text-[11px]",
                          "border-0 bg-transparent outline-none hover:bg-slateGrey/[0.06] focus-visible:ring-2 focus-visible:ring-slateGrey/25",
                          wkRowGlow ? "bg-slateGrey/[0.07] shadow-[inset_0_0_20px_rgba(0,0,0,0.04)]" : ""
                        ].join(" ")}
                      >
                        <span className="text-center">wk.{wk}</span>
                      </button>
                      <div className="grid min-w-0 flex-1 grid-cols-7 items-start">
                        {monthDays.slice(weekIdx * 7, weekIdx * 7 + 7).map((d) => {
                          const inMonth = d.getMonth() === monthCursor.getMonth();
                          const k = dayKey(d);
                          const count = monthApptCountByDay.get(k) ?? 0;
                          const isToday = sameDay(d, new Date());
                          const isSelected = k === selectedDate;
                          const monthDayHoverShade =
                            wkRowGlow || hoveredMonthDayKey === k
                              ? "bg-slateGrey/[0.07] shadow-[inset_0_0_28px_rgba(0,0,0,0.055)]"
                              : "";
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                const cd = calendarDate(d);
                                setSelectedDate(isoDate(cd));
                                setMonthCursor(startOfMonth(cd));
                                setWeekCursor(cd);
                                setCalendarView("day");
                                setDetailOpen(false);
                              }}
                              onMouseEnter={() => setHoveredMonthDayKey(k)}
                              onMouseLeave={() => setHoveredMonthDayKey((cur) => (cur === k ? null : cur))}
                              className={[
                                "relative flex aspect-square w-full min-w-0 flex-col items-stretch text-left outline-none transition",
                                "border-0 bg-transparent focus-visible:ring-2 focus-visible:ring-slateGrey/20",
                                !inMonth ? "text-slateGrey/[0.35]" : "",
                                monthDayHoverShade
                              ].join(" ")}
                            >
                              <div className="flex h-full min-h-0 w-full flex-col justify-between gap-1 px-1.5 pb-2 pt-2 sm:px-2 sm:pb-2.5 sm:pt-2.5">
                                <div className="min-h-[1.25rem] self-start">
                                  {isSelected ? (
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#7C1618] font-body text-[11px] font-normal tabular-nums leading-none text-white">
                                      {d.getDate()}
                                    </span>
                                  ) : isToday ? (
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#2b2b2b] font-body text-[11px] font-normal tabular-nums leading-none text-white">
                                      {d.getDate()}
                                    </span>
                                  ) : (
                                    <span
                                      className={[
                                        "inline-block font-body text-[11px] font-normal tabular-nums leading-none sm:text-xs",
                                        inMonth ? "text-slateGrey/90" : "text-slateGrey/30"
                                      ].join(" ")}
                                    >
                                      {d.getDate()}
                                    </span>
                                  )}
                                </div>

                                <div className="flex min-h-[0.25rem] shrink-0 items-center gap-0.5">
                                  {apptSummaryDots(count).map((i) => (
                                    <span
                                      key={i}
                                      className={[
                                        "h-[3px] w-[3px] shrink-0 rounded-full",
                                        i === 0 ? "bg-deepRed/50" : i === 1 ? "bg-slateGrey/30" : "bg-skyBlue/50"
                                      ].join(" ")}
                                    />
                                  ))}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {calendarView === "week" && (
              <div
                ref={weekScrollRef}
                className="-mx-1 max-h-[min(32rem,calc(100vh-10rem))] overflow-auto sm:-mx-0 sm:max-h-[min(40rem,calc(100vh-11rem))]"
              >
                <div className="min-w-[34rem] sm:min-w-[42rem]">
                  <div className="sticky top-0 z-30 flex border-b border-slateGrey/10 bg-chalk/95 pb-2 backdrop-blur supports-[backdrop-filter]:bg-chalk/90">
                    <div className="min-w-[2.75rem] shrink-0 sm:min-w-12" aria-hidden />
                    <div className="grid min-w-0 flex-1 grid-cols-7">
                      {weekDays.map((d) => {
                        const dk = isoDate(d);
                        const isToday = sameDay(d, new Date());
                        const letter = dowLetters[d.getDay()];
                        const isPastCol = calendarDate(d) < calendarDate(new Date());
                        const headerHover = hoveredWeekHeaderDayKey === dk;
                        return (
                          <button
                            key={dk}
                            type="button"
                            aria-label={`Open ${d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })} in daily view`}
                            onClick={() => goToDailyFromWeekHeader(d)}
                            onMouseEnter={() => setHoveredWeekHeaderDayKey(dk)}
                            onMouseLeave={() => setHoveredWeekHeaderDayKey((cur) => (cur === dk ? null : cur))}
                            className={[
                              "flex min-w-0 flex-col items-center gap-0.5 pt-2.5 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-slateGrey/20",
                              "border-0 bg-transparent",
                              headerHover ? "bg-slateGrey/[0.07] shadow-[inset_0_0_28px_rgba(0,0,0,0.055)]" : "",
                              !headerHover && isPastCol ? "bg-slateGrey/[0.03]" : "",
                              !headerHover && isToday ? "bg-[#7C1618]/[0.06]" : ""
                            ].join(" ")}
                          >
                            <span className="font-display text-[8px] font-normal uppercase tracking-[0.2em] text-slateGrey/45 sm:text-[9px]">
                              {letter}
                            </span>
                            <span
                              className={[
                                "font-body text-[11px] font-normal tabular-nums leading-none sm:text-xs",
                                isToday ? "font-medium text-slateGrey" : "text-slateGrey/85"
                              ].join(" ")}
                            >
                              {d.getDate()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-stretch">
                    <div className="sticky left-0 z-20 flex shrink-0 flex-col bg-chalk/95 pb-2 backdrop-blur supports-[backdrop-filter]:bg-chalk/90">
                      {WEEK_HOUR_ROWS.map((h) => (
                        <div
                          key={h}
                          className="relative box-border flex min-w-[2.75rem] max-w-[2.75rem] shrink-0 items-start justify-center self-stretch px-0.5 pt-1 sm:min-w-12 sm:max-w-12"
                          style={{ height: WEEK_PX_PER_HOUR }}
                        >
                          <span className="font-display text-[8px] font-normal tabular-nums leading-none text-slateGrey/40 sm:text-[9px]">
                            {new Date(2000, 0, 1, h, 0).toLocaleTimeString([], {
                              hour: "numeric"
                            })}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grid min-w-0 flex-1 grid-cols-7">
                      {weekDays.map((d) => {
                        const k = isoDate(d);
                        const dayAppts = apptsByDayKey.get(k) ?? [];
                        const isPastCol = calendarDate(d) < calendarDate(new Date());
                        const isTodayCol = sameDay(d, new Date());
                        return (
                          <div
                            key={k}
                            className={["relative min-w-0", isPastCol ? "bg-slateGrey/[0.03]" : ""].join(" ")}
                            style={weekColumnGuideStyle}
                          >
                            {nowLineOffsetPx != null && isTodayCol && (
                              <div
                                className="pointer-events-none absolute left-0 right-0 z-[25] flex items-center"
                                style={{ top: nowLineOffsetPx }}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C1618]" aria-hidden />
                                <span className="h-px min-w-0 flex-1 bg-[#7C1618]/75" />
                              </div>
                            )}

                            <button
                              type="button"
                              aria-label={`Choose a time on ${d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}`}
                              className="absolute inset-0 z-[1] w-full cursor-crosshair border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slateGrey/25"
                              onMouseMove={(e) => {
                                if (slotDragRef.current?.k === k) return;
                                const { top, height } = weekHoverSlotFromOffsetY(e.nativeEvent.offsetY, HOVER_PREVIEW_DURATION_MINS);
                                setWeekSlotHover({ k, top, height });
                              }}
                              onMouseLeave={() => setWeekSlotHover((h) => (h?.k === k ? null : h))}
                              onPointerDown={(e) => {
                                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                const { startMinFromGrid, top, height } = weekHoverSlotFromOffsetY(
                                  e.nativeEvent.offsetY,
                                  HOVER_PREVIEW_DURATION_MINS
                                );
                                slotDragRef.current = { k, d, startMinFromGrid, pointerId: e.pointerId };
                                setWeekSlotHover({ k, top, height });
                              }}
                              onPointerMove={(e) => {
                                const cur = slotDragRef.current;
                                if (!cur || cur.pointerId !== e.pointerId || cur.k !== k) return;
                                const pointerSnap = startMinFromOffsetY(e.nativeEvent.offsetY);
                                const dur = dragSelectionDurationMins(cur.startMinFromGrid, pointerSnap);
                                setWeekSlotHover({
                                  k,
                                  top: (cur.startMinFromGrid / 60) * WEEK_PX_PER_HOUR,
                                  height: (dur / 60) * WEEK_PX_PER_HOUR
                                });
                              }}
                              onPointerUp={(e) => {
                                const cur = slotDragRef.current;
                                if (!cur || cur.pointerId !== e.pointerId || cur.k !== k) return;
                                const pointerSnap = startMinFromOffsetY(e.nativeEvent.offsetY);
                                const dur = dragSelectionDurationMins(cur.startMinFromGrid, pointerSnap);
                                slotDragRef.current = null;
                                setWeekSlotHover(null);
                                openSlotActionMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  d,
                                  startMinFromGrid: cur.startMinFromGrid,
                                  durationOverrideMins: dur
                                });
                              }}
                            >
                              {weekSlotHover?.k === k && (
                                <div
                                  className="pointer-events-none absolute inset-x-1 bg-slateGrey/[0.07] shadow-[inset_0_0_28px_rgba(0,0,0,0.055)] sm:inset-x-1.5"
                                  style={{ top: weekSlotHover.top, height: weekSlotHover.height }}
                                  aria-hidden
                                />
                              )}
                            </button>

                            <div className="pointer-events-none absolute inset-0 z-[2] mx-1 sm:mx-1.5">
                              {dayAppts.map((a) => {
                                const layout = layoutApptInWeekGrid(a);
                                if (!layout) return null;
                                const v = weekApptVariant(a.id);
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    style={{ top: layout.top, height: layout.height }}
                                    className={[
                                      "pointer-events-auto absolute left-0 right-0 flex min-h-0 flex-col overflow-hidden rounded-md px-1.5 py-1 text-left shadow-sm transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C1618]/35",
                                      v === "solid"
                                        ? "bg-[#7C1618] text-white"
                                        : "border border-[#7C1618]/25 bg-white/80 text-[#7C1618]"
                                    ].join(" ")}
                                    onMouseEnter={() => setWeekSlotHover((h) => (h?.k === k ? null : h))}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openWeekAppt(a);
                                    }}
                                  >
                                    <span className="truncate font-body text-[10px] font-normal leading-tight sm:text-[11px]">
                                      {a.customerName}
                                    </span>
                                    <span
                                      className={[
                                        "truncate font-body text-[9px] font-normal tabular-nums leading-tight",
                                        v === "solid" ? "text-white/85" : "text-slateGrey/70"
                                      ].join(" ")}
                                    >
                                      {new Date(a.startISO).toLocaleTimeString([], {
                                        hour: "numeric",
                                        minute: "2-digit"
                                      })}
                                    </span>
                                    {a.notes && (
                                      <span
                                        className={[
                                          "mt-0.5 line-clamp-2 font-body text-[8px] font-normal leading-snug sm:text-[9px]",
                                          v === "solid" ? "text-white/75" : "text-slateGrey/60"
                                        ].join(" ")}
                                      >
                                        {a.notes}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {calendarView === "day" && (
                <div
                  ref={weekScrollRef}
                  className="-mx-1 max-h-[min(32rem,calc(100vh-10rem))] overflow-auto sm:-mx-0 sm:max-h-[min(40rem,calc(100vh-11rem))]"
                >
                  <div className="mx-auto min-w-[18rem] max-w-xl">
                    <div className="sticky top-0 z-30 flex border-b border-slateGrey/10 bg-chalk/95 pb-2 backdrop-blur supports-[backdrop-filter]:bg-chalk/90">
                      <button
                        type="button"
                        aria-label={`Return to weekly view (week ${isoWeekNumber(dayViewGrid.d)})`}
                        onClick={() => {
                          const anchor = calendarDate(dayViewGrid.d);
                          setWeekCursor(anchor);
                          setSelectedDate(isoDate(anchor));
                          setCalendarView("week");
                        }}
                        className={[
                          "flex min-w-[2.75rem] max-w-[2.75rem] shrink-0 flex-col items-center justify-center self-stretch px-0.5 py-1 font-['Times_New_Roman',Times,serif] text-[10px] italic leading-tight text-slateGrey/60 transition sm:min-w-12 sm:max-w-12 sm:text-[11px]",
                          "border-0 bg-transparent outline-none hover:bg-slateGrey/[0.06] focus-visible:ring-2 focus-visible:ring-slateGrey/25",
                          dayViewGrid.isPastCol ? "bg-slateGrey/[0.03]" : "",
                          dayViewGrid.isTodayCol ? "bg-[#7C1618]/[0.06]" : ""
                        ].join(" ")}
                      >
                        <span className="text-center">wk.{isoWeekNumber(dayViewGrid.d)}</span>
                      </button>
                      <div className="grid min-w-0 flex-1 grid-cols-1">
                        <button
                          type="button"
                          onClick={() => openWeekDayColumn(dayViewGrid.d)}
                          className={[
                            "flex min-w-0 flex-col items-center gap-0.5 pt-2.5 text-center outline-none transition hover:bg-slateGrey/[0.04] focus-visible:ring-2 focus-visible:ring-slateGrey/20",
                            "border-0 bg-transparent",
                            dayViewGrid.isPastCol ? "bg-slateGrey/[0.03]" : "",
                            dayViewGrid.isTodayCol ? "bg-[#7C1618]/[0.06]" : ""
                          ].join(" ")}
                        >
                          <span className="font-display text-[8px] font-normal uppercase tracking-[0.2em] text-slateGrey/45 sm:text-[9px]">
                            {dayViewGrid.d.toLocaleDateString([], { weekday: "long" })}
                          </span>
                          <span
                            className={[
                              "font-body text-[11px] font-normal tabular-nums leading-none sm:text-xs",
                              dayViewGrid.isTodayCol ? "font-medium text-slateGrey" : "text-slateGrey/85"
                            ].join(" ")}
                          >
                            {dayViewGrid.d.getDate()}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-stretch">
                      <div className="sticky left-0 z-20 flex shrink-0 flex-col bg-chalk/95 pb-2 backdrop-blur supports-[backdrop-filter]:bg-chalk/90">
                        {WEEK_HOUR_ROWS.map((h) => (
                          <div
                            key={h}
                            className="relative box-border flex min-w-[2.75rem] max-w-[2.75rem] shrink-0 items-start justify-center self-stretch px-0.5 pt-1 sm:min-w-12 sm:max-w-12"
                            style={{ height: WEEK_PX_PER_HOUR }}
                          >
                            <span className="font-display text-[8px] font-normal tabular-nums leading-none text-slateGrey/40 sm:text-[9px]">
                              {new Date(2000, 0, 1, h, 0).toLocaleTimeString([], {
                                hour: "numeric"
                              })}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="grid min-w-0 flex-1 grid-cols-1">
                        <div
                          className={["relative min-w-0", dayViewGrid.isPastCol ? "bg-slateGrey/[0.03]" : ""].join(" ")}
                          style={weekColumnGuideStyle}
                        >
                          {nowLineOffsetPx != null && dayViewGrid.isTodayCol && (
                            <div
                              className="pointer-events-none absolute left-0 right-0 z-[25] flex items-center"
                              style={{ top: nowLineOffsetPx }}
                            >
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C1618]" aria-hidden />
                              <span className="h-px min-w-0 flex-1 bg-[#7C1618]/75" />
                            </div>
                          )}

                          <button
                            type="button"
                            aria-label={`Choose a time on ${dayViewGrid.d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}`}
                            className="absolute inset-0 z-[1] w-full cursor-crosshair border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slateGrey/25"
                            onMouseMove={(e) => {
                              if (slotDragRef.current?.k === dayViewGrid.k) return;
                              const { top, height } = weekHoverSlotFromOffsetY(e.nativeEvent.offsetY, HOVER_PREVIEW_DURATION_MINS);
                              setWeekSlotHover({ k: dayViewGrid.k, top, height });
                            }}
                            onMouseLeave={() => setWeekSlotHover((h) => (h?.k === dayViewGrid.k ? null : h))}
                            onPointerDown={(e) => {
                              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                              const { startMinFromGrid, top, height } = weekHoverSlotFromOffsetY(
                                e.nativeEvent.offsetY,
                                HOVER_PREVIEW_DURATION_MINS
                              );
                              slotDragRef.current = {
                                k: dayViewGrid.k,
                                d: dayViewGrid.d,
                                startMinFromGrid,
                                pointerId: e.pointerId
                              };
                              setWeekSlotHover({ k: dayViewGrid.k, top, height });
                            }}
                            onPointerMove={(e) => {
                              const cur = slotDragRef.current;
                              if (!cur || cur.pointerId !== e.pointerId || cur.k !== dayViewGrid.k) return;
                              const pointerSnap = startMinFromOffsetY(e.nativeEvent.offsetY);
                              const dur = dragSelectionDurationMins(cur.startMinFromGrid, pointerSnap);
                              setWeekSlotHover({
                                k: dayViewGrid.k,
                                top: (cur.startMinFromGrid / 60) * WEEK_PX_PER_HOUR,
                                height: (dur / 60) * WEEK_PX_PER_HOUR
                              });
                            }}
                            onPointerUp={(e) => {
                              const cur = slotDragRef.current;
                              if (!cur || cur.pointerId !== e.pointerId || cur.k !== dayViewGrid.k) return;
                              const pointerSnap = startMinFromOffsetY(e.nativeEvent.offsetY);
                              const dur = dragSelectionDurationMins(cur.startMinFromGrid, pointerSnap);
                              slotDragRef.current = null;
                              setWeekSlotHover(null);
                              openSlotActionMenu({
                                x: e.clientX,
                                y: e.clientY,
                                d: dayViewGrid.d,
                                startMinFromGrid: cur.startMinFromGrid,
                                durationOverrideMins: dur
                              });
                            }}
                          >
                            {weekSlotHover?.k === dayViewGrid.k && (
                              <div
                                className="pointer-events-none absolute inset-x-1 bg-slateGrey/[0.07] shadow-[inset_0_0_28px_rgba(0,0,0,0.055)] sm:inset-x-1.5"
                                style={{ top: weekSlotHover.top, height: weekSlotHover.height }}
                                aria-hidden
                              />
                            )}
                          </button>

                          <div className="pointer-events-none absolute inset-0 z-[2] mx-1 sm:mx-1.5">
                            {dayViewGrid.dayAppts.map((a) => {
                              const layout = layoutApptInWeekGrid(a);
                              if (!layout) return null;
                              const v = weekApptVariant(a.id);
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  style={{ top: layout.top, height: layout.height }}
                                  className={[
                                    "pointer-events-auto absolute left-0 right-0 flex min-h-0 flex-col overflow-hidden rounded-md px-1.5 py-1 text-left shadow-sm transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C1618]/35",
                                    v === "solid"
                                      ? "bg-[#7C1618] text-white"
                                      : "border border-[#7C1618]/25 bg-white/80 text-[#7C1618]"
                                  ].join(" ")}
                                  onMouseEnter={() => setWeekSlotHover((h) => (h?.k === dayViewGrid.k ? null : h))}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWeekAppt(a);
                                  }}
                                >
                                  <span className="truncate font-body text-[10px] font-normal leading-tight sm:text-[11px]">
                                    {a.customerName}
                                  </span>
                                  <span
                                    className={[
                                      "truncate font-body text-[9px] font-normal tabular-nums leading-tight",
                                      v === "solid" ? "text-white/85" : "text-slateGrey/70"
                                    ].join(" ")}
                                  >
                                    {new Date(a.startISO).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit"
                                    })}
                                  </span>
                                  {a.notes && (
                                    <span
                                      className={[
                                        "mt-0.5 line-clamp-2 font-body text-[8px] font-normal leading-snug sm:text-[9px]",
                                        v === "solid" ? "text-white/75" : "text-slateGrey/60"
                                      ].join(" ")}
                                    >
                                      {a.notes}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            )}
          </div>

      <ScrollingMonthCalendarDialog
        open={monthPickerOpen}
        selectedDate={parseISODate(selectedDate)}
        onClose={() => setMonthPickerOpen(false)}
        onSelectDay={(d) => {
          const cd = calendarDate(d);
          setSelectedDate(isoDate(cd));
          setMonthCursor(startOfMonth(cd));
          setWeekCursor(cd);
          setMonthPickerOpen(false);
        }}
      />

      {detailOpen && (
        <div
          className="fixed inset-0 z-[45] grid place-items-center bg-slateGrey/30 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slateGrey/15 bg-chalk/95 shadow-pepla backdrop-blur">
            <div className="flex items-start justify-between gap-4 border-b border-slateGrey/15 px-6 py-5">
              <div>
                <div className="font-display tracking-pepla text-[11px] uppercase opacity-80">Selected day</div>
                <div className="font-body mt-1 text-xl">
                  {parseISODate(selectedDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
            </div>

            <div className="grid gap-4 px-6 py-5">
              <div className="rounded-2xl border border-slateGrey/15 bg-white/55 p-4">
                <div className="font-display tracking-pepla text-[11px] uppercase opacity-80">Add booking</div>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="modal-name">Customer name</Label>
                    <Input
                      id="modal-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="modal-phone">Phone number (optional)</Label>
                    <Input id="modal-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1..." />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="modal-notes">Notes (optional)</Label>
                    <Textarea
                      id="modal-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Placement, size, deposit status, etc."
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="modal-start">Start time</Label>
                      <Input id="modal-start" type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="modal-dur">Duration</Label>
                      <select
                        id="modal-dur"
                        value={durationMins}
                        onChange={(e) => setDurationMins(Number(e.target.value))}
                        className="h-10 w-full rounded-xl border border-slateGrey/20 bg-slateGrey/5 px-3 font-body text-[15px] outline-none focus:border-slateGrey/40"
                      >
                        <option value={30}>30 min</option>
                        <option value={60}>60 min</option>
                        <option value={90}>90 min</option>
                        <option value={120}>2 hours</option>
                        <option value={180}>3 hours</option>
                      </select>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 rounded-xl border border-deepRed/30 bg-white/60 px-4 py-3 font-body text-sm text-deepRed">
                    {error}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setError(null)} disabled={busy}>
                    Clear error
                  </Button>
                  <Button onClick={createAppointment} disabled={!canCreate}>
                    Book
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-slateGrey/15 bg-white/40 p-4">
                <div className="font-display tracking-pepla text-[11px] uppercase opacity-80">Bookings ({apptsForDay.length})</div>
                <div className="mt-3 grid gap-2">
                  {apptsForDay.length === 0 && <div className="font-body text-sm opacity-70">No bookings yet.</div>}
                  {apptsForDay.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-slateGrey/15 bg-white/55 px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-body text-base">{a.customerName}</div>
                          <div className="font-body text-sm opacity-70">
                            {new Date(a.startISO).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                            {new Date(a.endISO).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            {a.phoneNumber ? ` · ${a.phoneNumber}` : ""}
                          </div>
                          {a.notes && <div className="font-body mt-2 text-sm opacity-80">{a.notes}</div>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeAppointment(a.id)} disabled={busy}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
