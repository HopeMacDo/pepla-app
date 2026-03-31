import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input, Label, Textarea } from "../ui/primitives";
import type { Appointment } from "../lib/models";
import { listAppointments, putAppointment } from "../lib/storage";

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

export default function CalendarNewBookingPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [newStartTime, setNewStartTime] = useState("11:00");
  const [durationMins, setDurationMins] = useState(60);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setAppointments(await listAppointments());
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

  const canCreate = useMemo(() => Boolean(customerName.trim() && !busy), [busy, customerName]);

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
      navigate("/calendar");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-2 sm:px-6 sm:pt-4">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/calendar"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
          aria-label="Back to calendar"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <div className="font-display tracking-pepla text-[10px] uppercase opacity-70">Calendar</div>
          <h1 className="font-body text-xl font-normal leading-tight sm:text-2xl">New booking</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-slateGrey/15 bg-white/55 p-4 sm:p-5">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-appt-date">Date</Label>
            <Input
              id="new-appt-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-appt-name">Customer name</Label>
            <Input
              id="new-appt-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-appt-phone">Phone number (optional)</Label>
            <Input id="new-appt-phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-appt-notes">Notes (optional)</Label>
            <Textarea
              id="new-appt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Placement, size, deposit status, etc."
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-appt-start">Start time</Label>
              <Input id="new-appt-start" type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-appt-dur">Duration</Label>
              <select
                id="new-appt-dur"
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
          <div className="mt-4 rounded-xl border border-deepRed/30 bg-white/60 px-4 py-3 font-body text-sm text-deepRed">{error}</div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setError(null)} disabled={busy}>
            Clear error
          </Button>
          <Button onClick={createAppointment} disabled={!canCreate}>
            Book
          </Button>
        </div>
      </div>
    </div>
  );
}
