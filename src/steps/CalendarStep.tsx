import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Button, Input, Label, Textarea } from "../ui/primitives";
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
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" }
];

export default function CalendarStep() {
  const [sp] = useSearchParams();
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("month");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
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
            startISO: base.toISOString(),
            endISO: end.toISOString(),
            customerName: name,
            phoneNumber: "+1 (760) 555-0123",
            notes: note
          } satisfies Appointment;
        };
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
          mk(23, 11, 0, "Lee H.", "Mini piece")
        ];
        await Promise.all(fake.map((a) => putAppointment(a)));
        setAppointments(await listAppointments());
      } else {
        setAppointments(existing);
      }
    })();
  }, []);

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

  const monthDays = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const monthApptCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      const k = isoDate(new Date(a.startISO));
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  const totalThisMonth = useMemo(() => {
    const m = monthCursor.getMonth();
    const y = monthCursor.getFullYear();
    return appointments.filter((a) => {
      const d = new Date(a.startISO);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [appointments, monthCursor]);

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

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Card>
        <CardHeader className="px-4 pb-1.5 pt-4 sm:px-6 sm:pt-5">
          <div className="font-body text-xl sm:text-2xl">Book an appointment</div>
          <div className="font-body mt-0.5 max-w-2xl text-sm opacity-80">
            Full-month calendar with booking hints. Click a date to add or review bookings.
          </div>
        </CardHeader>
        <CardBody className="px-4 pb-4 pt-0 sm:px-6 sm:pb-5">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-display tracking-pepla text-[10px] uppercase opacity-80">Month</div>
                <div className="font-body text-lg leading-tight sm:text-xl">{isoMonthLabel(monthCursor)}</div>
              </div>

              <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <div
                  className="inline-flex self-start rounded-full border border-slateGrey/15 bg-white/45 p-0.5 sm:self-center"
                  role="tablist"
                  aria-label="Calendar view"
                >
                  {VIEW_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={calendarView === opt.id}
                      onClick={() => setCalendarView(opt.id)}
                      className={[
                        "rounded-full px-2.5 py-1 font-display text-[10px] uppercase tracking-pepla transition sm:px-3 sm:text-[11px]",
                        calendarView === opt.id
                          ? "bg-slateGrey text-sand shadow-sm"
                          : "text-slateGrey/85 hover:bg-white/55"
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setMonthCursor((m) => addMonths(m, -1))} disabled={busy}>
                    Prev
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonthCursor(startOfMonth(new Date()))} disabled={busy}>
                    Today
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonthCursor((m) => addMonths(m, 1))} disabled={busy}>
                    Next
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-slateGrey/15 bg-white/40 px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-2">
              <div className="font-body text-xs opacity-80 sm:text-sm">
                Total bookings this month: <span className="text-slateGrey">{totalThisMonth}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-deepRed/90" />
                  <span className="font-body text-[10px] opacity-70 sm:text-xs">booked</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-skyBlue" />
                  <span className="font-body text-[10px] opacity-70 sm:text-xs">light</span>
                </div>
              </div>
            </div>

            {calendarView === "month" && (
              <div className="rounded-2xl border border-slateGrey/15 bg-white/35 p-1.5 sm:p-2.5">
                <div className="grid grid-cols-7 gap-1 pb-1 sm:gap-1.5">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center font-display tracking-pepla text-[9px] uppercase opacity-70 sm:text-[10px]">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid auto-rows-[minmax(2.75rem,auto)] grid-cols-7 gap-1 sm:auto-rows-[minmax(3.5rem,auto)] sm:gap-1.5">
                  {monthDays.map((d) => {
                    const inMonth = d.getMonth() === monthCursor.getMonth();
                    const k = dayKey(d);
                    const count = monthApptCountByDay.get(k) ?? 0;
                    const isToday = sameDay(d, new Date());
                    const isSelected = k === selectedDate;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setSelectedDate(k);
                          setDetailOpen(true);
                          const s = defaultStartForDay(d);
                          setNewStartTime(`${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`);
                        }}
                        className={[
                          "relative flex min-h-0 min-w-0 rounded-xl border text-left transition sm:rounded-2xl",
                          inMonth ? "bg-white/55" : "bg-white/25",
                          "border-slateGrey/15 hover:bg-white/70",
                          isSelected ? "border-deepRed/40 bg-white/75 ring-1 ring-deepRed/20" : "",
                          !inMonth ? "opacity-60" : ""
                        ].join(" ")}
                      >
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-0.5 px-1 py-1 sm:gap-1 sm:p-1.5">
                          <div className="flex items-start justify-between gap-0">
                            <div
                              className={[
                                "grid h-4 min-w-[1rem] shrink-0 place-items-center rounded-lg font-body text-[10px] leading-none sm:h-[1.125rem] sm:min-w-[1.125rem] sm:rounded-xl sm:text-[11px]",
                                isToday ? "bg-slateGrey text-sand" : "bg-transparent"
                              ].join(" ")}
                            >
                              {d.getDate()}
                            </div>
                            {count > 0 && (
                              <div className="shrink-0 rounded-full border border-slateGrey/15 bg-sand/80 px-0.5 py-px font-display tabular-nums tracking-pepla text-[8px] uppercase leading-none sm:px-1 sm:text-[9px]">
                                {count}
                              </div>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-0.5">
                            <div className="flex items-center gap-px">
                              {apptSummaryDots(count).map((i) => (
                                <span
                                  key={i}
                                  className={[
                                    "h-1 w-1 shrink-0 rounded-full sm:h-1.5 sm:w-1.5",
                                    i === 0 ? "bg-deepRed/90" : i === 1 ? "bg-slateGrey/50" : "bg-skyBlue"
                                  ].join(" ")}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {calendarView === "week" && (
              <div className="flex min-h-[7rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slateGrey/25 bg-white/20 px-4 py-5 sm:min-h-[8rem]">
                <div className="max-w-sm text-center">
                  <div className="font-display tracking-pepla text-[10px] uppercase opacity-70 sm:text-[11px]">Week view</div>
                  <p className="font-body mt-1 text-xs opacity-80 sm:text-sm">Week view is coming soon.</p>
                </div>
              </div>
            )}

            {calendarView === "day" && (
              <div className="flex min-h-[7rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slateGrey/25 bg-white/20 px-4 py-5 sm:min-h-[8rem]">
                <div className="max-w-sm text-center">
                  <div className="font-display tracking-pepla text-[10px] uppercase opacity-70 sm:text-[11px]">Day view</div>
                  <p className="font-body mt-1 text-xs opacity-80 sm:text-sm">Day view is coming soon.</p>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {detailOpen && (
        <div
          className="fixed inset-0 z-20 grid place-items-center bg-slateGrey/30 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slateGrey/15 bg-sand/95 shadow-pepla backdrop-blur">
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
                        className="h-10 w-full rounded-xl border border-slateGrey/20 bg-sand/40 px-3 font-body text-[15px] outline-none focus:border-slateGrey/40"
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
