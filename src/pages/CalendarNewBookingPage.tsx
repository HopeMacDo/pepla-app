import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label, Textarea } from "../ui/primitives";
import type { Appointment } from "../lib/models";
import { listAppointments, putAppointment } from "../lib/storage";
import { CUSTOMERS_TABLE, toTrimmedString, type Customer } from "@/lib/customers";
import { formatSupabaseError, supabase } from "@/lib/supabase";
import {
  businessHour12Options,
  inferMeridiemFromBusinessHours,
  parseHHMM,
  timeHHMMRoundedNow,
  toHHMM24,
  type Meridiem
} from "../lib/businessTime";

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

function normalizeDigits(s: string) {
  return s.replace(/\D/g, "");
}

function matchesCustomerSearch(c: Customer, raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const first = toTrimmedString(c.first_name).toLowerCase();
  const last = toTrimmedString(c.last_name).toLowerCase();
  const phone = toTrimmedString(c.phone_number);
  const phoneDigits = normalizeDigits(phone);
  const qDigits = normalizeDigits(raw);
  return (
    first.includes(q) ||
    last.includes(q) ||
    phone.toLowerCase().includes(q) ||
    (qDigits.length > 0 && phoneDigits.includes(qDigits))
  );
}

function displayCustomerName(c: Customer) {
  const first = toTrimmedString(c.first_name);
  const last = toTrimmedString(c.last_name);
  const full = `${first} ${last}`.trim();
  return full || "Unnamed customer";
}

function safeCloseToCalendar(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) navigate(-1);
  else navigate("/calendar");
}

export default function CalendarNewBookingPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState(() => sp.get("date") ?? isoDate(new Date()));
  const [newStartTime, setNewStartTime] = useState(() => sp.get("time") ?? timeHHMMRoundedNow(15));
  const [durationMins, setDurationMins] = useState(() => Number(sp.get("duration") ?? 60));

  const [serviceName, setServiceName] = useState(() => sp.get("service") ?? "");
  const [priceInput, setPriceInput] = useState(() => sp.get("price") ?? "");
  const [notes, setNotes] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const customerMenuRef = useRef<HTMLDivElement>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timeHour12, setTimeHour12] = useState(() => {
    const hh = parseHHMM(sp.get("time") ?? timeHHMMRoundedNow(15))?.hh ?? 11;
    const h12 = hh % 12 || 12;
    return h12;
  });
  const [timeMinute, setTimeMinute] = useState(() => {
    const mm = parseHHMM(sp.get("time") ?? timeHHMMRoundedNow(15))?.mm ?? 0;
    return mm - (mm % 15);
  });
  const [timeMeridiem, setTimeMeridiem] = useState<Meridiem>(() => {
    const hh = parseHHMM(sp.get("time") ?? timeHHMMRoundedNow(15))?.hh ?? 11;
    return hh >= 12 ? "PM" : "AM";
  });

  useEffect(() => {
    setNewStartTime(toHHMM24(timeHour12, timeMinute, timeMeridiem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeHour12, timeMinute, timeMeridiem]);

  useEffect(() => {
    (async () => {
      setAppointments(await listAppointments());
    })();
  }, []);

  const loadCustomers = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from(CUSTOMERS_TABLE)
      .select("id, first_name, last_name, phone_number")
      .order("last_name", { ascending: true });

    if (fetchError) throw fetchError;
    setCustomers((data as Customer[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadCustomers();
      } catch (e) {
        if (!cancelled) setCustomersError(formatSupabaseError(e));
      } finally {
        if (!cancelled) setCustomersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCustomers]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (customerMenuRef.current && !customerMenuRef.current.contains(t)) setCustomerMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
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

  const parsedPrice = useMemo(() => {
    const raw = priceInput.trim();
    if (!raw) return null;
    const n = Number(raw.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }, [priceInput]);

  const canCreate = useMemo(() => {
    if (busy) return false;
    if (!selectedCustomer) return false;
    if (!serviceName.trim()) return false;
    if (parsedPrice == null) return false;
    return true;
  }, [busy, parsedPrice, selectedCustomer, serviceName]);

  const filteredCustomers = useMemo(() => {
    const list = customers.filter((c) => matchesCustomerSearch(c, customerQuery));
    return list.slice(0, 12);
  }, [customerQuery, customers]);

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

      if (!selectedCustomer) throw new Error("Choose a customer.");
      if (!serviceName.trim()) throw new Error("Choose a service.");
      if (parsedPrice == null) throw new Error("Enter a valid price.");

      const appt: Appointment = {
        id: crypto.randomUUID(),
        kind: "appointment",
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        customerId: selectedCustomer.id,
        customerName: displayCustomerName(selectedCustomer),
        phoneNumber: toTrimmedString(selectedCustomer.phone_number) || undefined,
        serviceName: serviceName.trim(),
        price: parsedPrice,
        notes: notes.trim() || undefined
      };
      await putAppointment(appt);
      safeCloseToCalendar(navigate);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

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
          <h1 className="font-body text-xl font-normal leading-tight sm:text-2xl">Book an appointment</h1>
        </div>
      </div>

      <div className="rounded-2xl bg-white/30 p-4 ring-1 ring-slateGrey/10 transition hover:bg-white/40 sm:p-5">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>Customer</Label>
            <div ref={customerMenuRef} className="relative">
              {selectedCustomer ? (
                <div className="border-b border-slateGrey/20 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-body text-base text-slateGrey">{displayCustomerName(selectedCustomer)}</div>
                      <div className="truncate font-body text-sm text-slateGrey/70">
                        {toTrimmedString(selectedCustomer.phone_number) || "No phone number"}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 bg-transparent px-1 py-2 font-display text-[11px] uppercase tracking-pepla text-slateGrey/70 underline decoration-slateGrey/25 underline-offset-4 transition hover:text-slateGrey"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerQuery("");
                        setCustomerMenuOpen(true);
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    type="search"
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setCustomerMenuOpen(true);
                    }}
                    onFocus={() => setCustomerMenuOpen(true)}
                    placeholder={customersLoading ? "Loading customers..." : customersError ? "Customers unavailable" : "Search customers..."}
                    disabled={customersLoading || Boolean(customersError)}
                    autoComplete="off"
                    className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 focus:border-slateGrey/45"
                  />
                  {customersError && <div className="mt-2 font-body text-sm text-deepRed">{customersError}</div>}
                  {customerMenuOpen && !customersLoading && !customersError && (
                    <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-slateGrey/15 bg-chalk/95 shadow-lg backdrop-blur">
                      {filteredCustomers.length === 0 ? (
                        <div className="px-4 py-3 font-body text-sm text-slateGrey/70">No matches</div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="flex w-full flex-col gap-0.5 border-0 bg-transparent px-4 py-3 text-left transition hover:bg-white/55"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerMenuOpen(false);
                            }}
                          >
                            <span className="font-body text-sm text-slateGrey">{displayCustomerName(c)}</span>
                            <span className="font-body text-xs text-slateGrey/65">
                              {toTrimmedString(c.phone_number) || "No phone number"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-appt-date">Date</Label>
              <Input
                id="new-appt-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 focus:border-slateGrey/45"
              />
            </div>
            <div className="grid gap-2">
              <Label>Time</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={`${timeHour12}:${String(timeMinute).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [hRaw, mRaw] = e.target.value.split(":");
                    const h = Number(hRaw);
                    const m = Number(mRaw);
                    if (Number.isFinite(h)) setTimeHour12(h);
                    if (Number.isFinite(m)) setTimeMinute(m);
                    const inferred = inferMeridiemFromBusinessHours(h);
                    if (inferred) setTimeMeridiem(inferred);
                  }}
                  className="h-10 w-full rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 font-body text-[15px] outline-none focus:border-slateGrey/45"
                  aria-label="Start time"
                >
                  {businessHour12Options().flatMap((h) =>
                    [0, 15, 30, 45].map((m) => (
                      <option key={`${h}-${m}`} value={`${h}:${String(m).padStart(2, "0")}`}>
                        {h}:{String(m).padStart(2, "0")}
                      </option>
                    ))
                  )}
                </select>
                <select
                  value={timeMeridiem}
                  onChange={(e) => setTimeMeridiem(e.target.value as Meridiem)}
                  className="h-10 w-[5.25rem] rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 font-body text-[15px] outline-none focus:border-slateGrey/45"
                  aria-label="AM/PM"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-appt-service">Service</Label>
              <select
                id="new-appt-service"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="h-10 w-full rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 font-body text-[15px] outline-none focus:border-slateGrey/45"
              >
                <option value="">Select a service</option>
                <option value="Tattoo appointment">Tattoo appointment</option>
                <option value="Consultation">Consultation</option>
                <option value="Touch-up">Touch-up</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-appt-dur">Duration</Label>
              <select
                id="new-appt-dur"
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-appt-price">Price</Label>
              <Input
                id="new-appt-price"
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="$0.00"
                className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 placeholder:text-slateGrey/35 focus:border-slateGrey/45"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-appt-notes">Notes (optional)</Label>
              <Textarea
                id="new-appt-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Placement, size, deposit status, etc."
                className="min-h-[44px] rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 placeholder:text-slateGrey/35 focus:border-slateGrey/45"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-deepRed/30 bg-white/60 px-4 py-3 font-body text-sm text-deepRed">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end">
          <Button onClick={createAppointment} disabled={!canCreate}>
            Book
          </Button>
        </div>
      </div>
    </div>
  );
}
