import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label } from "../ui/primitives";
import type { ServiceCatalogItem } from "../lib/models";
import { createSpotBookingLink, listAppointments, listCatalogServices, sweepExpiredBookingLinks } from "../lib/storage";
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

function safeCloseToCalendar(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) navigate(-1);
  else navigate("/calendar");
}

export default function CalendarCreateSpotPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState(() => sp.get("date") ?? isoDate(new Date()));
  const [newStartTime, setNewStartTime] = useState(() => sp.get("time") ?? timeHHMMRoundedNow(15));
  const [durationMins, setDurationMins] = useState(() => Number(sp.get("duration") ?? 60));

  const [providerDisplayName, setProviderDisplayName] = useState("Hope");
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<"" | "custom" | string>("");
  const [serviceName, setServiceName] = useState(() => sp.get("service") ?? "");
  const [priceInput, setPriceInput] = useState(() => sp.get("price") ?? "200");
  const [depositInput, setDepositInput] = useState(() => sp.get("deposit") ?? "50");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const [timeHour12, setTimeHour12] = useState(() => {
    const hh = parseHHMM(sp.get("time") ?? timeHHMMRoundedNow(15))?.hh ?? 11;
    return hh % 12 || 12;
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
    void sweepExpiredBookingLinks();
  }, []);

  useEffect(() => {
    void (async () => {
      setCatalog(await listCatalogServices());
    })();
  }, []);

  const serviceFromUrl = sp.get("service") ?? "";

  useEffect(() => {
    if (!serviceFromUrl.trim() || catalog.length === 0) return;
    const match = catalog.find((s) => s.name === serviceFromUrl.trim());
    if (match) {
      setSelectedCatalogId(match.id);
      setServiceName(match.name);
      setDurationMins(match.durationMins);
      setPriceInput(match.price ? String(match.price) : "");
      setDepositInput(String(match.depositAmount));
    } else {
      setSelectedCatalogId("custom");
      setServiceName(serviceFromUrl.trim());
    }
  }, [catalog, serviceFromUrl]);

  const parsedPrice = useMemo(() => {
    const raw = priceInput.trim();
    if (!raw) return null;
    const n = Number(raw.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }, [priceInput]);

  const parsedDeposit = useMemo(() => {
    const raw = depositInput.trim();
    if (!raw) return 0;
    const n = Number(raw.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }, [depositInput]);

  const expiresAtISO = useMemo(() => {
    if (!expiresAtLocal.trim()) return undefined;
    const d = new Date(expiresAtLocal);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  }, [expiresAtLocal]);

  const canCreate = useMemo(() => {
    if (busy) return false;
    if (!serviceName.trim()) return false;
    if (parsedPrice == null) return false;
    if (parsedDeposit === null) return false;
    if (!providerDisplayName.trim()) return false;
    return true;
  }, [busy, parsedDeposit, parsedPrice, providerDisplayName, serviceName]);

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

  const onCreate = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const day = parseISODate(selectedDate);
      const [hh, mm] = newStartTime.split(":").map((x) => Number(x));
      const start = new Date(day);
      start.setHours(hh ?? 11, mm ?? 0, 0, 0);
      const end = new Date(start.getTime() + durationMins * 60 * 1000);

      const all = await listAppointments();
      const conflict = all.some((a) => {
        const as = new Date(a.startISO);
        const ae = new Date(a.endISO);
        return start < ae && as < end;
      });
      if (conflict) throw new Error("That time overlaps another calendar block.");

      if (parsedPrice == null) throw new Error("Enter a valid price.");
      if (parsedDeposit === null) throw new Error("Enter a valid deposit (0 is ok).");

      const res = await createSpotBookingLink({
        providerDisplayName: providerDisplayName.trim(),
        serviceName: serviceName.trim(),
        durationMins,
        price: parsedPrice,
        deposit: parsedDeposit,
        slotStartISO: start.toISOString(),
        expiresAt: expiresAtISO
      });
      if ("error" in res) {
        throw new Error(res.error === "overlap" ? "That time is no longer free." : "Invalid time.");
      }
      const url = `${window.location.origin}/book/${res.token}`;
      setShareUrl(url);
      await sweepExpiredBookingLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    durationMins,
    expiresAtISO,
    newStartTime,
    parsedDeposit,
    parsedPrice,
    providerDisplayName,
    selectedDate,
    serviceName
  ]);

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
          <h1 className="font-body text-xl font-normal leading-tight sm:text-2xl">Create Booking Offer</h1>
          <p className="mt-1 font-body text-sm text-slateGrey/70">Post a public opening with a shareable link.</p>
        </div>
      </div>

      {shareUrl ? (
        <div className="rounded-2xl bg-white/30 p-5 ring-1 ring-slateGrey/10">
          <p className="font-body text-sm text-slateGrey/80">Share this link anywhere you promote openings:</p>
          <code className="mt-3 block overflow-x-auto rounded-lg bg-white/60 px-3 py-2 font-body text-xs text-slateGrey">{shareUrl}</code>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => void navigator.clipboard.writeText(shareUrl)}>
              Copy link
            </Button>
            <Button type="button" size="sm" onClick={() => safeCloseToCalendar(navigate)}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/30 p-4 ring-1 ring-slateGrey/10 transition hover:bg-white/40 sm:p-5">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="spot-provider">Your first name (shown to clients)</Label>
              <Input
                id="spot-provider"
                value={providerDisplayName}
                onChange={(e) => setProviderDisplayName(e.target.value)}
                className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 focus:border-slateGrey/45"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="spot-date">Date</Label>
                <Input
                  id="spot-date"
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
                <Label htmlFor="spot-service">Service</Label>
                <select
                  id="spot-service"
                  value={selectedCatalogId}
                  onChange={(e) => {
                    const v = e.target.value as "" | "custom" | string;
                    setSelectedCatalogId(v);
                    if (v === "") {
                      setServiceName("");
                      return;
                    }
                    if (v === "custom") {
                      setServiceName("");
                      return;
                    }
                    const s = catalog.find((x) => x.id === v);
                    if (s) {
                      setServiceName(s.name);
                      setDurationMins(s.durationMins);
                      setPriceInput(s.price ? String(s.price) : "");
                      setDepositInput(String(s.depositAmount));
                    }
                  }}
                  className="h-10 w-full rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 font-body text-[15px] outline-none focus:border-slateGrey/45"
                >
                  <option value="">Select a service</option>
                  {catalog.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {selectedCatalogId === "custom" && (
                  <Input
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="Service name"
                    className="mt-2 rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 placeholder:text-slateGrey/35 focus:border-slateGrey/45"
                  />
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spot-dur">Duration</Label>
                <select
                  id="spot-dur"
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
                <Label htmlFor="spot-price">Price</Label>
                <Input
                  id="spot-price"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="$0"
                  className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 placeholder:text-slateGrey/35 focus:border-slateGrey/45"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spot-deposit">Deposit</Label>
                <Input
                  id="spot-deposit"
                  inputMode="decimal"
                  value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                  placeholder="0 for none"
                  className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 placeholder:text-slateGrey/35 focus:border-slateGrey/45"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="spot-exp">Link expires (optional)</Label>
              <Input
                id="spot-exp"
                type="datetime-local"
                value={expiresAtLocal}
                onChange={(e) => setExpiresAtLocal(e.target.value)}
                className="rounded-none border-0 border-b border-slateGrey/25 bg-transparent px-0 focus:border-slateGrey/45"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-deepRed/30 bg-white/60 px-4 py-3 font-body text-sm text-deepRed">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end">
            <Button onClick={() => void onCreate()} disabled={!canCreate}>
              Create link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
