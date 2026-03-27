import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getIntakeById, setProposalPendingSlot } from "../lib/storage";
import type { IntakeRequest } from "../lib/models";

const bronze = "#C59E6F";
const cardBg = "#14110e";

function formatSlotLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const timePart = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${datePart} — ${timePart}`;
}

function relativeSentLabel(sentAt: string) {
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return "";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfSent = new Date(sent);
  startOfSent.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - startOfSent.getTime()) / (24 * 60 * 60 * 1000));
  if (dayDiff === 0) return "Sent today";
  if (dayDiff === 1) return "Sent yesterday";
  if (dayDiff > 1 && dayDiff < 7) return `Sent ${dayDiff} days ago`;
  return `Sent ${sent.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function ClientProposalStep() {
  const { id } = useParams();
  const [row, setRow] = useState<IntakeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const r = await getIntakeById(id);
      if (!cancelled) {
        setRow(r);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const sortedSlots = useMemo(() => {
    const p = row?.proposal;
    if (!p) return [];
    return [...p.slotStartISOs].sort((a, b) => a.localeCompare(b));
  }, [row?.proposal]);

  async function onSelect(slotISO: string) {
    if (!id) return;
    setError(null);
    setBusySlot(slotISO);
    try {
      const result = await setProposalPendingSlot(id, slotISO);
      if (!result.ok) {
        const msg =
          result.error === "conflict"
            ? "That time is no longer available. Please pick another slot or contact the studio."
            : result.error === "already_finalized"
              ? "This proposal was already confirmed."
              : result.error === "not_pending"
                ? "This booking is no longer open for this link."
                : result.error === "invalid_slot"
                  ? "That time is not part of this proposal."
                  : "This proposal is not available.";
        setError(msg);
        if (result.error === "already_finalized" || result.error === "not_pending" || result.error === "conflict") {
          setRow(await getIntakeById(id));
        }
        return;
      }
      setRow(result.intake);
    } finally {
      setBusySlot(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center font-body text-sm text-white/60">
        Loading proposal…
      </div>
    );
  }

  if (!row || !row.proposal) {
    return (
      <div className="flex min-h-[calc(100vh-2rem)] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-body text-lg text-white/90">Proposal not found</p>
        <p className="max-w-sm font-body text-sm text-white/50">This link may be invalid or the proposal was removed.</p>
      </div>
    );
  }

  const p = row.proposal;
  const hasConfirmedSlot = Boolean(p.selectedSlotISO);
  const manualUpcoming = row.status === "upcoming" && !p.selectedSlotISO;
  const pendingISO = p.pendingSlotISO;
  const awaitingDeposit = Boolean(pendingISO && !p.depositPaid && !hasConfirmedSlot);
  const depositIn = p.depositPaid && !pendingISO && !hasConfirmedSlot;

  return (
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-md rounded-2xl border px-6 py-8 shadow-2xl"
        style={{ borderColor: bronze, backgroundColor: cardBg }}
      >
        <h1 className="font-display text-center text-xs uppercase tracking-[0.2em]" style={{ color: bronze }}>
          Booking proposal
        </h1>

        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
          {(
            [
              ["Service", p.serviceName],
              ["Duration", `${p.durationMins} min`],
              ["Price", formatMoney(p.price)],
              ["Deposit", formatMoney(p.deposit)]
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="grid gap-1">
              <div className="font-display text-[10px] uppercase tracking-[0.12em] text-violet-200/50">{label}</div>
              <div className="font-body text-base font-medium text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <div className="font-display text-[10px] uppercase tracking-[0.14em] text-violet-200/50">Available slots</div>
          <div className="mt-3 grid gap-2">
            {manualUpcoming ? (
              <p className="font-body text-sm text-white/70">
                Your appointment has been scheduled. If you need the exact time, reply to your artist or call the
                studio.
              </p>
            ) : (
              sortedSlots.map((iso) => {
                const isConfirmedChoice = p.selectedSlotISO === iso;
                const isPreferred = pendingISO === iso && !hasConfirmedSlot;
                const done = hasConfirmedSlot;
                return (
                  <div
                    key={iso}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="font-body text-sm text-white">{formatSlotLabel(iso)}</span>
                    {done ? (
                      isConfirmedChoice ? (
                        <span className="font-display text-[10px] uppercase tracking-pepla" style={{ color: bronze }}>
                          Confirmed
                        </span>
                      ) : null
                    ) : isPreferred ? (
                      <span className="font-display text-[10px] uppercase tracking-pepla text-white/55">Your pick</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busySlot !== null}
                        onClick={() => onSelect(iso)}
                        className="font-display text-[11px] uppercase tracking-pepla transition hover:opacity-80 disabled:opacity-40"
                        style={{ color: bronze }}
                      >
                        {busySlot === iso ? "…" : "Select"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {awaitingDeposit && pendingISO && (
          <p className="mt-4 font-body text-center text-sm text-white/70">
            Your preferred time is <span className="text-white/90">{formatSlotLabel(pendingISO)}</span>. Once your
            deposit is received, that time will be held and you&apos;ll see a confirmation here.
          </p>
        )}

        {depositIn && (
          <p className="mt-4 font-body text-center text-sm text-white/70">
            Deposit received — select your preferred time to finish booking.
          </p>
        )}

        {error && <p className="mt-4 text-center font-body text-sm text-amber-200/90">{error}</p>}

        {hasConfirmedSlot && p.selectedSlotISO && (
          <p className="mt-6 text-center font-body text-sm text-white/85">
            You&apos;re booked for{" "}
            <span className="font-medium text-white">{formatSlotLabel(p.selectedSlotISO)}</span>. See you then.
          </p>
        )}

        <p className="mt-8 text-right font-body text-xs text-violet-200/45">{relativeSentLabel(p.sentAt)}</p>
      </div>
    </div>
  );
}
