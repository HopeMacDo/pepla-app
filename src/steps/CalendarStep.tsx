import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Button, Input, Label, Textarea } from "../ui/primitives";
import type { Appointment } from "../lib/models";
import { deleteAppointment, listAppointments, putAppointment } from "../lib/storage";

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

function timeLabel(h: number, m: number) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

export default function CalendarStep() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
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
          mk(2, 12, 0, "Jess M.", "Consult · placement + size"),
          mk(7, 13, 0, "Carmen", "Color refresh · 90 min (placeholder)"),
          mk(9, 10, 30, "Rylie H.", "Blackwork · ankle")
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
      setDetailOpen(true);
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
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="font-display tracking-pepla text-xs uppercase">Step 2</div>
          <div className="font-body mt-2 text-2xl">Book an appointment</div>
          <div className="font-body mt-2 max-w-2xl opacity-80">
            Month view with subtle booking hints. Click a date to review details and add new appointments.
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            <div className="md:col-span-3 grid gap-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-display tracking-pepla text-[11px] uppercase opacity-80">Month</div>
                  <div className="font-body mt-1 text-xl">{isoMonthLabel(monthCursor)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMonthCursor((m) => addMonths(m, -1))} disabled={busy}>
                    Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMonthCursor(startOfMonth(new Date()))}
                    disabled={busy}
                  >
                    Today
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonthCursor((m) => addMonths(m, 1))} disabled={busy}>
                    Next
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slateGrey/15 bg-white/40 px-4 py-3">
                <div className="font-body text-sm opacity-80">
                  Total bookings this month: <span className="text-slateGrey">{totalThisMonth}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-deepRed/90" />
                    <span className="font-body text-xs opacity-70">booked</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-skyBlue" />
                    <span className="font-body text-xs opacity-70">light</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slateGrey/15 bg-white/35 p-4">
                <div className="grid grid-cols-7 gap-2 pb-3">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center font-display tracking-pepla text-[10px] uppercase opacity-70">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthDays.map((d) => {
                    const inMonth = d.getMonth() === monthCursor.getMonth();
                    const k = dayKey(d);
                    const count = monthApptCountByDay.get(k) ?? 0;
                    const isToday = sameDay(d, new Date());
                    const isSelected = k === selectedDate;
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          setSelectedDate(k);
                          setDetailOpen(true);
                          const s = defaultStartForDay(d);
                          setNewStartTime(`${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`);
                        }}
                        className={[
                          "group relative aspect-square rounded-2xl border text-left transition",
                          inMonth ? "bg-white/55" : "bg-white/25",
                          "border-slateGrey/15 hover:bg-white/70",
                          isSelected ? "border-deepRed/40 bg-white/75" : "",
                          !inMonth ? "opacity-60" : ""
                        ].join(" ")}
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className={[
                                "h-6 w-6 rounded-xl grid place-items-center font-body text-sm",
                                isToday ? "bg-slateGrey text-sand" : "bg-transparent"
                              ].join(" ")}
                            >
                              {d.getDate()}
                            </div>
                            {count > 0 && (
                              <div className="rounded-full border border-slateGrey/15 bg-sand/80 px-2 py-0.5 font-display tracking-pepla text-[10px] uppercase">
                                {count}
                              </div>
                            )}
                          </div>

                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {apptSummaryDots(count).map((i) => (
                                <span
                                  key={i}
                                  className={[
                                    "h-1.5 w-1.5 rounded-full",
                                    i === 0 ? "bg-deepRed/90" : i === 1 ? "bg-slateGrey/50" : "bg-skyBlue"
                                  ].join(" ")}
                                />
                              ))}
                            </div>
                            <div className="font-body text-[11px] opacity-0 transition group-hover:opacity-60">open</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="name">Customer name</Label>
                <Input id="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone number (optional)</Label>
                <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Placement, size, deposit status, etc." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start">Start time</Label>
                  <Input id="start" type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dur">Duration</Label>
                  <select
                    id="dur"
                    value={durationMins}
                    onChange={(e) => setDurationMins(Number(e.target.value))}
                    className="w-full rounded-xl border border-slateGrey/20 bg-sand/40 px-3 py-2 font-body text-[15px] outline-none focus:border-slateGrey/40"
                  >
                    <option value={30}>30 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>2 hours</option>
                    <option value={180}>3 hours</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-deepRed/30 bg-white/60 px-4 py-3 font-body text-sm text-deepRed">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/crm?name=${encodeURIComponent(customerName.trim())}&phone=${encodeURIComponent(phoneNumber.trim())}`)}
                >
                  Go to customers
                </Button>
                <Button
                  onClick={() => {
                    setDetailOpen(true);
                  }}
                  disabled={busy}
                >
                  Open day
                </Button>
              </div>
            </div>
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
          <div className="w-full max-w-xl rounded-3xl border border-slateGrey/15 bg-sand/95 shadow-pepla backdrop-blur">
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

            <div className="px-6 py-5 grid gap-4">
              <div className="rounded-2xl border border-slateGrey/15 bg-white/55 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display tracking-pepla text-[11px] uppercase opacity-80">Add booking</div>
                  <div className="font-body text-sm opacity-70">
                    {newStartTime} · {durationMins} min
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setError(null)} disabled={busy}>
                    Clear error
                  </Button>
                  <Button onClick={createAppointment} disabled={!canCreate}>
                    Book
                  </Button>
                </div>
                {error && (
                  <div className="mt-3 rounded-xl border border-deepRed/30 bg-white/60 px-4 py-3 font-body text-sm text-deepRed">
                    {error}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slateGrey/15 bg-white/40 p-4">
                <div className="font-display tracking-pepla text-[11px] uppercase opacity-80">
                  Bookings ({apptsForDay.length})
                </div>
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

