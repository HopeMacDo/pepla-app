import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Appointment, IntakeRequest } from "../lib/models";
import { listAppointments, listIntake } from "../lib/storage";

const DISPLAY_NAME = "Hope";

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatTodayLong(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(d);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function firstNameFromCustomer(name: string) {
  const t = name.trim();
  if (!t) return "Guest";
  return t.split(/\s+/)[0] ?? t;
}

function isScheduleAppointment(a: Appointment) {
  return a.kind === "appointment" || a.kind === "spot_hold";
}

function pickNextAppointmentId(appts: Appointment[], nowMs: number): string | null {
  const inProgress = appts.find((a) => {
    const s = new Date(a.startISO).getTime();
    const e = new Date(a.endISO).getTime();
    return s <= nowMs && nowMs < e;
  });
  if (inProgress) return inProgress.id;
  const next = appts.find((a) => new Date(a.startISO).getTime() > nowMs);
  return next?.id ?? null;
}

/** Sample clients for Today — merged with real calendar rows (non-overlapping slots only). */
function previewAppointmentsForDay(day: Date): Appointment[] {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  const mk = (
    hour: number,
    minute: number,
    durationMins: number,
    id: string,
    name: string,
    service: string,
    price: number
  ): Appointment => {
    const start = new Date(y, m, d, hour, minute, 0, 0);
    const end = new Date(start.getTime() + durationMins * 60 * 1000);
    return {
      id: `today-preview:${id}`,
      kind: "appointment",
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      customerName: name,
      serviceName: service,
      price
    };
  };
  return [
    mk(8, 0, 45, "morgan", "Morgan Wu", "Flash consult", 70),
    mk(9, 0, 60, "alex", "Alex Kim", "Consultation · placement", 85),
    mk(10, 15, 45, "taylor", "Taylor Reed", "Stencil review", 80),
    mk(11, 30, 45, "jordan", "Jordan Lee", "Touch-up", 95),
    mk(13, 0, 30, "avery", "Avery Bloom", "Healing check-in", 55),
    mk(14, 0, 60, "sam", "Sam Ortiz", "Session · linework", 120),
    mk(15, 30, 45, "marcus", "Marcus Chen", "Stencil review", 75),
    mk(16, 15, 45, "riley", "Riley Park", "Healing check", 65),
    mk(17, 30, 60, "casey", "Casey Nova", "Shading pass", 140),
    mk(18, 45, 45, "drew", "Drew Ellis", "Color touch-up", 90)
  ];
}

function intervalOverlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function previewSlotsWithoutOverlap(real: Appointment[], previews: Appointment[]): Appointment[] {
  return previews.filter((p) => {
    const ps = new Date(p.startISO).getTime();
    const pe = new Date(p.endISO).getTime();
    return !real.some((r) => {
      const rs = new Date(r.startISO).getTime();
      const re = new Date(r.endISO).getTime();
      return intervalOverlaps(ps, pe, rs, re);
    });
  });
}

function PinIcon({ variant }: { variant: "done" | "current" | "upcoming" }) {
  if (variant === "current") {
    return (
      <svg className="h-5 w-5 shrink-0 text-ember" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
      </svg>
    );
  }
  if (variant === "done") {
    return (
      <svg className="h-5 w-5 shrink-0 text-slateGrey/35" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 shrink-0 text-slateGrey/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z" />
      <circle cx="12" cy="11" r="2.25" />
    </svg>
  );
}

function StatTileProgress({ segments }: { segments: { ratio: number; className: string }[] }) {
  return (
    <div className="mt-4 flex h-1 w-full overflow-hidden rounded-full bg-slateGrey/10" role="presentation">
      {segments.map((seg, i) => (
        <div
          key={i}
          className={["h-full transition-[flex-grow] duration-300", seg.className].join(" ")}
          style={{ flexGrow: Math.max(0, seg.ratio), flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

export default function TodayPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [intakes, setIntakes] = useState<IntakeRequest[]>([]);
  const [nowTick, setNowTick] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const [listHeight, setListHeight] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [appts, rows] = await Promise.all([listAppointments(), listIntake()]);
      if (!cancelled) {
        setAppointments(appts);
        setIntakes(rows);
      }
    }
    void load();
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, []);

  const now = useMemo(() => new Date(), [nowTick]);
  const greeting = greetingForHour(now.getHours());
  const calendarDayKey = useMemo(
    () => `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`,
    [nowTick]
  );

  const previewForDay = useMemo(() => {
    const [ys, ms, ds] = calendarDayKey.split("-").map(Number);
    return previewAppointmentsForDay(new Date(ys, ms, ds));
  }, [calendarDayKey]);

  const todayAppts = useMemo(() => {
    const day = new Date();
    return appointments
      .filter((a) => isScheduleAppointment(a) && sameDay(new Date(a.startISO), day))
      .sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
  }, [appointments, nowTick]);

  const scheduleAppts = useMemo(() => {
    const extras = previewSlotsWithoutOverlap(todayAppts, previewForDay);
    return [...todayAppts, ...extras].sort(
      (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
    );
  }, [todayAppts, previewForDay]);

  const pendingRequestCount = useMemo(
    () => intakes.filter((r) => r.status === "requests").length,
    [intakes]
  );

  const { completedCount, estRevenue, completedRevenue } = useMemo(() => {
    const t = Date.now();
    let done = 0;
    let est = 0;
    let doneRev = 0;
    for (const a of scheduleAppts) {
      const endMs = new Date(a.endISO).getTime();
      const price = a.price ?? 0;
      est += price;
      if (t >= endMs) {
        done += 1;
        doneRev += price;
      }
    }
    return { completedCount: done, estRevenue: est, completedRevenue: doneRev };
  }, [scheduleAppts, nowTick]);

  const apptCount = scheduleAppts.length;
  const nextId = useMemo(() => pickNextAppointmentId(scheduleAppts, Date.now()), [scheduleAppts, nowTick]);

  const apptProgressSegments = useMemo(() => {
    if (apptCount === 0) return [{ ratio: 1, className: "bg-slateGrey/10" }];
    const doneR = completedCount;
    const rest = apptCount - doneR;
    return [
      { ratio: doneR, className: "bg-ember" },
      { ratio: rest, className: "bg-slateGrey/12" }
    ];
  }, [apptCount, completedCount]);

  const revenueProgressSegments = useMemo(() => {
    if (estRevenue <= 0) return [{ ratio: 1, className: "bg-slateGrey/10" }];
    const redR = Math.min(1, completedRevenue / estRevenue) * estRevenue;
    const blueR = estRevenue - redR;
    return [
      { ratio: redR, className: "bg-ember" },
      { ratio: Math.max(0, blueR), className: "bg-sky" }
    ];
  }, [completedRevenue, estRevenue]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setListHeight(el.offsetHeight));
    ro.observe(el);
    setListHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [scheduleAppts.length]);

  const nowLineTopPx = useMemo(() => {
    if (scheduleAppts.length === 0 || listHeight <= 0) return null;
    const firstMs = new Date(scheduleAppts[0].startISO).getTime();
    const lastMs = new Date(scheduleAppts[scheduleAppts.length - 1].endISO).getTime();
    const span = Math.max(lastMs - firstMs, 60_000);
    const t = Date.now();
    const u = t <= firstMs ? 0 : t >= lastMs ? 1 : (t - firstMs) / span;
    return u * listHeight;
  }, [scheduleAppts, listHeight, nowTick]);

  const estRevenueLabel = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(estRevenue);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10">
      <header className="space-y-1">
        <p className="font-body text-2xl font-normal text-slateGrey sm:text-3xl">
          {greeting}, {DISPLAY_NAME}
        </p>
        <p className="font-body text-sm text-slateGrey/60 sm:text-base">{formatTodayLong(now)}</p>
      </header>

      <section aria-label="Today summary" className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-12">
        <div>
          <p className="font-body text-3xl font-normal tabular-nums tracking-tight text-slateGrey sm:text-4xl">{apptCount}</p>
          <p className="mt-1 font-display text-[11px] uppercase tracking-pepla text-slateGrey/65">Appointments</p>
          <StatTileProgress segments={apptProgressSegments} />
        </div>

        <div>
          <p className="font-body text-3xl font-normal tabular-nums tracking-tight text-slateGrey sm:text-4xl">
            {estRevenueLabel}
          </p>
          <p className="mt-1 font-display text-[11px] uppercase tracking-pepla text-slateGrey/65">Est. revenue</p>
          <StatTileProgress segments={revenueProgressSegments} />
        </div>

        <div>
          <p className="font-body text-3xl font-normal tabular-nums tracking-tight text-slateGrey sm:text-4xl">
            {pendingRequestCount}
          </p>
          <p className="mt-1 font-display text-[11px] uppercase tracking-pepla text-slateGrey/65">Pending requests</p>
        </div>
      </section>

      <section aria-labelledby="today-schedule-heading" className="space-y-3">
        <h2 id="today-schedule-heading" className="font-display text-xs uppercase tracking-pepla text-slateGrey/70">
          Today&apos;s schedule
        </h2>

        <div className="relative">
          {nowLineTopPx != null && scheduleAppts.length > 0 && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-20 flex items-center pl-3 pr-1 sm:pl-4"
              style={{ top: Math.max(0, Math.min(nowLineTopPx, listHeight - 1)) }}
              aria-hidden
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
              <span className="h-px min-w-0 flex-1 bg-ember/75" />
            </div>
          )}
          <ul ref={listRef} className="relative z-0 divide-y divide-slateGrey/12" role="list">
            {scheduleAppts.map((a) => {
              const start = new Date(a.startISO);
              const end = new Date(a.endISO);
              const t = Date.now();
              const done = t >= end.getTime();
              const active = t >= start.getTime() && t < end.getTime();
              const isNext = a.id === nextId;
              const pinVariant = done ? "done" : active ? "current" : "upcoming";
              const rowMuted = done;
              const name = firstNameFromCustomer(a.customerName);
              const sub = a.serviceName ?? a.notes ?? "";

              return (
                <li key={a.id} className="flex min-h-[52px] items-center gap-3 py-3 first:pt-0 sm:min-h-[56px]">
                  <span className="flex w-5 shrink-0 justify-center">
                    <PinIcon variant={pinVariant} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        "font-body text-[15px] leading-snug",
                        rowMuted
                          ? "font-normal text-slateGrey/45"
                          : isNext || active
                            ? "font-medium text-slateGrey"
                            : "font-normal text-slateGrey"
                      ].join(" ")}
                    >
                      {name}
                    </p>
                    {sub ? (
                      <p
                        className={[
                          "mt-0.5 truncate font-body text-xs",
                          rowMuted ? "text-slateGrey/35" : "text-slateGrey/55"
                        ].join(" ")}
                      >
                        {sub}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isNext ? (
                      <span className="rounded-md bg-sky/80 px-2 py-0.5 font-display text-[10px] font-normal uppercase tracking-pepla text-slateGrey">
                        Next
                      </span>
                    ) : null}
                    <time
                      dateTime={a.startISO}
                      className={[
                        "font-body text-sm tabular-nums",
                        rowMuted ? "text-slateGrey/40" : "text-slateGrey/60"
                      ].join(" ")}
                    >
                      {formatTime(start)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
