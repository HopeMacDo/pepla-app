import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

function timeHHMMRoundedNow(stepMins = 15) {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.round(mins / stepMins) * stepMins;
  const hh = Math.floor((rounded % (24 * 60)) / 60);
  const mm = rounded % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function safeCloseToCalendar(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) navigate(-1);
  else navigate("/calendar");
}

export default function CalendarBlockTimePage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState(() => sp.get("date") ?? isoDate(new Date()));
  const [startTime, setStartTime] = useState(() => sp.get("time") ?? timeHHMMRoundedNow(15));
  const [durationMins, setDurationMins] = useState(() => Number(sp.get("duration") ?? 60));
  const [note, setNote] = useState("");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => setAppointments(await listAppointments()))();
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

  async function createBlock() {
    setError(null);
    setBusy(true);
    try {
      const day = parseISODate(selectedDate);
      const [hh, mm] = startTime.split(":").map((x) => Number(x));
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
        kind: "block",
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        customerName: "Blocked",
        notes: note.trim() || undefined
      };
      await putAppointment(appt);
      safeCloseToCalendar(navigate);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const canCreate = useMemo(() => !busy, [busy]);

  const durationOptions = useMemo(() => {
    const maxMins = 12 * 60;
    const opts: Array<{ value: number; label: string }> = [];
    for (let m = 15; m <= maxMins; m += 15) {
      if (m % 60 === 0) {
        const h = m / 60;
        opts.push({ value: m, label: h === 1 ? "1 hour" : `${h} hours` });
      } else if (m > 60 && m % 60 !== 0) {
        const h = Math.floor(m / 60);
        const mm = m % 60;
        opts.push({ value: m, label: `${h}h ${mm}m` });
      } else {
        opts.push({ value: m, label: `${m} min` });
      }
    }
    return opts;
  }, []);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-3 sm:px-6 sm:pt-4">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
          aria-label="Close"
          onClick={() => safeCloseToCalendar(navigate)}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="font-body text-xl font-normal leading-tight sm:text-2xl">Block time</h1>
        </div>
      </div>

      <div className="rounded-2xl bg-white/30 p-4 ring-1 ring-slateGrey/10 transition hover:bg-white/40 sm:p-5">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="block-date">Date</Label>
            <Input
              id="block-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 focus:border-slateGrey/45"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="block-start">Start time</Label>
              <Input
                id="block-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 focus:border-slateGrey/45"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="block-dur">Duration</Label>
              <select
                id="block-dur"
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
                className="h-10 w-full rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 font-body text-[15px] outline-none focus:border-slateGrey/45"
              >
                {durationOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="block-note">Note (optional)</Label>
            <Textarea
              id="block-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lunch, doctor’s appointment, travel, etc."
              className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 placeholder:text-slateGrey/35 focus:border-slateGrey/45"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-deepRed/30 bg-white/60 px-4 py-3 font-body text-sm text-deepRed">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end">
          <Button onClick={createBlock} disabled={!canCreate}>
            Block
          </Button>
        </div>
      </div>
    </div>
  );
}

