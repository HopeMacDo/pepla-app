import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { BookingLink, IntakeRequest } from "../lib/models";
import {
  claimSpotBookingLink,
  getBookingLinkByToken,
  getIntakeById,
  patchSpotBookingLinkDepositPaid,
  saveClientPaymentMethodStub,
  setProposalDepositPaid,
  setProposalPendingSlot,
  tryFinalizeSpotBookingLink
} from "../lib/storage";
import { loadStudioByline } from "../lib/studioMenu";

const bronze = "#C59E6F";
const cardBg = "#14110e";

function formatSlotLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const timePart = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${datePart} — ${timePart}`;
}

function formatOfferChip(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "—", md: "—", time: "—" };
  const day = d.toLocaleDateString([], { weekday: "short" }).toUpperCase();
  const md = `${d.getMonth() + 1}.${d.getDate()}`;
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return { day, md, time };
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function ClientBookingLinkStep() {
  const { token } = useParams();
  const [link, setLink] = useState<BookingLink | null>(null);
  const [intake, setIntake] = useState<IntakeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState(false);
  const [busySpot, setBusySpot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [offerLocalPick, setOfferLocalPick] = useState<string | null>(null);
  const [cardLast4, setCardLast4] = useState("");
  const [saveCardForLater, setSaveCardForLater] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    const bl = await getBookingLinkByToken(token);
    setLink(bl);
    if (bl?.kind === "offer" && bl.intakeId) {
      setIntake(await getIntakeById(bl.intakeId));
    } else if (bl?.kind === "spot" && bl.fulfilledIntakeId) {
      setIntake(await getIntakeById(bl.fulfilledIntakeId));
    } else {
      setIntake(null);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, reload]);

  const sortedOfferSlots = useMemo(() => {
    const p = intake?.proposal;
    if (!p) return [];
    return [...p.slotStartISOs].sort((a, b) => a.localeCompare(b));
  }, [intake?.proposal]);

  async function onConfirmOfferTime() {
    if (!link?.intakeId || !offerLocalPick) return;
    setError(null);
    setBusySlot(true);
    try {
      const result = await setProposalPendingSlot(link.intakeId, offerLocalPick);
      if (!result.ok) {
        const msg =
          result.error === "conflict"
            ? "That time is no longer available. Please pick another option."
            : result.error === "already_finalized"
              ? "This offer was already confirmed."
              : result.error === "not_pending"
                ? "This offer is no longer open."
                : result.error === "invalid_slot"
                  ? "That time is not part of this offer."
                  : "This offer is not available.";
        setError(msg);
        await reload();
        return;
      }
      setIntake(result.intake);
      setOfferLocalPick(null);
      if (result.finalized) await reload();
    } finally {
      setBusySlot(false);
    }
  }

  async function onPayOfferDeposit() {
    if (!link?.intakeId) return;
    setError(null);
    setBusySpot(true);
    try {
      const res = await setProposalDepositPaid(link.intakeId, true);
      if (!res.ok) {
        setError(res.error === "conflict" ? "That time conflicts with another booking." : "Could not record deposit.");
        await reload();
        return;
      }
      if (saveCardForLater && cardLast4.replace(/\D/g, "").length >= 4) {
        await saveClientPaymentMethodStub(link.intakeId, {
          last4: cardLast4.replace(/\D/g, "").slice(-4)
        });
      }
      setIntake(res.intake);
      if (res.finalized) await reload();
    } finally {
      setBusySpot(false);
    }
  }

  async function onSubmitSpot(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusySpot(true);
    try {
      const res = await claimSpotBookingLink(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim()
      });
      if (!res.ok) {
        setError(res.error);
        await reload();
        return;
      }
      setLink(res.link);
      if (res.autoFinalized && res.intake) {
        setIntake(res.intake);
      }
      await reload();
    } finally {
      setBusySpot(false);
    }
  }

  async function onStubSpotDeposit() {
    if (!token) return;
    setError(null);
    setBusySpot(true);
    try {
      await patchSpotBookingLinkDepositPaid(token, true);
      const fin = await tryFinalizeSpotBookingLink(token);
      if (!fin.ok) {
        const msg =
          fin.error === "conflict"
            ? "That opening was taken. Please contact the studio."
            : fin.error === "incomplete"
              ? "Choose your time and details first."
              : "Could not finalize after deposit.";
        setError(msg);
        await reload();
        return;
      }
      setLink(fin.link);
      setIntake(fin.intake);
      await reload();
    } finally {
      setBusySpot(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f4] font-body text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  if (!token || !link) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f7f6f4] px-4 text-center text-neutral-800">
        <p className="font-body text-lg">Link not found</p>
        <p className="max-w-sm font-body text-sm text-neutral-500">This link may be invalid or expired.</p>
      </div>
    );
  }

  if (link.status === "expired" || link.status === "cancelled") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f7f6f4] px-4 text-center text-neutral-800">
        <p className="font-body text-lg">This link has expired</p>
        <p className="max-w-sm font-body text-sm text-neutral-500">Ask your artist for a fresh booking link if you still need an appointment.</p>
      </div>
    );
  }

  const isSpot = link.kind === "spot";
  const isOffer = link.kind === "offer";
  const provider = link.providerDisplayName;

  if (isOffer && (!intake || !intake.proposal)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f7f6f4] px-4 text-center text-neutral-800">
        <p className="font-body text-lg">Offer unavailable</p>
        <p className="max-w-sm font-body text-sm text-neutral-500">This offer may have been withdrawn or is no longer active.</p>
      </div>
    );
  }

  const p = isOffer ? intake!.proposal! : null;
  const offerBooked = isOffer && Boolean(p?.selectedSlotISO);
  const offerPendingSlot = p?.pendingSlotISO;
  const offerAwaitingDeposit = Boolean(isOffer && offerPendingSlot && !p?.depositPaid && !offerBooked);

  const spotBooked = isSpot && link.status === "fulfilled";
  const spotClaimedAwaitingDeposit =
    isSpot && link.status === "active" && Boolean(link.pendingSlotISO) && link.deposit > 0 && !link.depositPaid;

  const confirmedSlotISO = intake?.proposal?.selectedSlotISO ?? null;
  const showConfirmed = Boolean(confirmedSlotISO && (spotBooked || offerBooked));

  const studioLine = loadStudioByline();
  const headerLine = `${provider.trim().toUpperCase()} · ${studioLine.toUpperCase()}`;

  if (isOffer && p) {
    const canConfirmPick = Boolean(offerLocalPick) && !offerBooked && !busySlot;
    return (
      <div className="min-h-screen bg-white px-4 pb-16 pt-10 text-neutral-900 antialiased sm:px-6">
        <div className="mx-auto max-w-md">
          {!showConfirmed && (
            <>
              <p className="font-display text-[10px] uppercase tracking-[0.25em] text-neutral-500">{headerLine}</p>
              <h1
                className="mt-4 text-3xl font-normal italic leading-tight tracking-tight text-neutral-900 sm:text-4xl"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                {p.serviceName}
              </h1>
              <div className="mt-8 grid grid-cols-2 gap-8 border-b border-neutral-900/15 pb-8">
                <div>
                  <div className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-500">Total</div>
                  <div className="mt-1 font-body text-xl font-semibold tabular-nums">{formatMoney(p.price)}</div>
                </div>
                <div>
                  <div className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-500">Deposit</div>
                  <div className={`mt-1 font-body text-xl font-semibold tabular-nums ${p.deposit > 0 ? "text-[#b42318]" : ""}`}>
                    {p.deposit > 0 ? formatMoney(p.deposit) : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <p className="font-display text-[10px] uppercase tracking-[0.25em] text-neutral-500">Select a time</p>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {sortedOfferSlots.map((iso) => {
                    const chip = formatOfferChip(iso);
                    const selected = offerLocalPick === iso;
                    const locked = offerPendingSlot === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={Boolean(offerPendingSlot) || busySlot}
                        onClick={() => setOfferLocalPick(iso)}
                        className={[
                          "flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-3 text-center transition",
                          selected || locked
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-900/25 bg-white text-neutral-900 hover:border-neutral-900/50"
                        ].join(" ")}
                      >
                        <span className="font-display text-[9px] uppercase tracking-wider opacity-80">{chip.day}</span>
                        <span className="font-body text-lg font-semibold tabular-nums leading-none">{chip.md}</span>
                        <span className="font-body text-[11px] opacity-80">{chip.time}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!offerAwaitingDeposit && (
                <button
                  type="button"
                  disabled={!canConfirmPick}
                  onClick={() => void onConfirmOfferTime()}
                  className="mt-10 w-full rounded-full bg-neutral-200 py-4 font-display text-xs uppercase tracking-[0.2em] text-neutral-700 transition enabled:bg-neutral-900 enabled:text-white enabled:hover:bg-neutral-800 disabled:opacity-50"
                >
                  {busySlot ? "…" : "Confirm booking"}
                </button>
              )}

              {p.deposit > 0 && !offerAwaitingDeposit && !offerBooked && (
                <p className="mt-4 text-center font-body text-xs text-neutral-500">
                  {formatMoney(p.deposit)} deposit collected after you confirm to hold your appointment.
                </p>
              )}

              {offerAwaitingDeposit && offerPendingSlot && (
                <div className="mt-10 grid gap-5 border-t border-neutral-900/10 pt-8">
                  <p className="font-body text-sm text-neutral-600">
                    You chose <span className="font-medium text-neutral-900">{formatSlotLabel(offerPendingSlot)}</span>.
                    Add a card (demo) to pay your deposit
                    {saveCardForLater ? " — we’ll keep these digits on file for faster checkout later." : "."}
                  </p>
                  <label className="grid gap-1">
                    <span className="font-display text-[10px] uppercase tracking-pepla text-neutral-500">Card last 4 digits</span>
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      value={cardLast4}
                      onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="rounded-lg border border-neutral-900/20 px-3 py-2 font-body text-sm outline-none focus:border-neutral-900/50"
                      placeholder="4242"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 font-body text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={saveCardForLater}
                      onChange={(e) => setSaveCardForLater(e.target.checked)}
                      className="rounded border-neutral-400"
                    />
                    Save this card for faster checkout next time
                  </label>
                  <button
                    type="button"
                    disabled={busySpot || (p.deposit > 0 && cardLast4.length < 4)}
                    onClick={() => void onPayOfferDeposit()}
                    className="w-full rounded-full bg-neutral-900 py-4 font-display text-xs uppercase tracking-[0.2em] text-white transition hover:bg-neutral-800 disabled:opacity-40"
                  >
                    {busySpot ? "…" : `Pay ${formatMoney(p.deposit)} deposit (demo)`}
                  </button>
                </div>
              )}

              <a
                href="mailto:support@pepla.com"
                className="mt-10 flex items-center justify-center gap-1 font-body text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-4"
              >
                Questions about this offer
                <span aria-hidden>↗</span>
              </a>
            </>
          )}

          {showConfirmed && confirmedSlotISO && (
            <div className="mt-8 text-center">
              <p className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-500">You&apos;re set</p>
              <p className="mt-4 font-body text-lg text-neutral-800">
                Booked for <span className="font-semibold">{formatSlotLabel(confirmedSlotISO)}</span>.
              </p>
              <p className="mt-2 font-body text-sm text-neutral-500">{provider} will follow up in your thread.</p>
            </div>
          )}

          {error && <p className="mt-6 text-center font-body text-sm text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  const headline = "Available opening";
  const subline = `${provider} posted an open time you can claim.`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0a08] px-4 py-10 text-white antialiased">
      <div className="w-full max-w-md rounded-2xl border px-6 py-8 shadow-2xl" style={{ borderColor: bronze, backgroundColor: cardBg }}>
        <h1 className="font-display text-center text-xs uppercase tracking-[0.2em]" style={{ color: bronze }}>
          {headline}
        </h1>
        <p className="mt-4 text-center font-body text-sm leading-relaxed text-white/65">{subline}</p>

        {!spotBooked && (
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
            {(
              [
                ["Service", link.serviceName],
                ["Duration", `${link.durationMins} min`],
                ["Price", formatMoney(link.price)],
                ["Deposit", link.deposit > 0 ? formatMoney(link.deposit) : "None"]
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="grid gap-1">
                <div className="font-display text-[10px] uppercase tracking-[0.12em] text-violet-200/50">{label}</div>
                <div className="font-body text-base font-medium text-white">{value}</div>
              </div>
            ))}
          </div>
        )}

        {link.slotStartISOs[0] && !spotBooked && (
          <div className="mt-8 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="font-display text-[10px] uppercase tracking-[0.14em] text-violet-200/50">Opening</div>
            <div className="mt-1 font-body text-base text-white">{formatSlotLabel(link.slotStartISOs[0])}</div>
          </div>
        )}

        {!spotBooked && !spotClaimedAwaitingDeposit && (
          <form className="mt-8 grid gap-4" onSubmit={(e) => void onSubmitSpot(e)}>
            <div className="grid gap-1">
              <label className="font-display text-[10px] uppercase tracking-[0.12em] text-violet-200/50" htmlFor="spot-fn">
                First name
              </label>
              <input
                id="spot-fn"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 font-body text-sm text-white outline-none focus:border-white/30"
                autoComplete="given-name"
              />
            </div>
            <div className="grid gap-1">
              <label className="font-display text-[10px] uppercase tracking-[0.12em] text-violet-200/50" htmlFor="spot-ln">
                Last name
              </label>
              <input
                id="spot-ln"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 font-body text-sm text-white outline-none focus:border-white/30"
                autoComplete="family-name"
              />
            </div>
            <div className="grid gap-1">
              <label className="font-display text-[10px] uppercase tracking-[0.12em] text-violet-200/50" htmlFor="spot-ph">
                Phone
              </label>
              <input
                id="spot-ph"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 font-body text-sm text-white outline-none focus:border-white/30"
                autoComplete="tel"
              />
            </div>
            <button
              type="submit"
              disabled={busySpot || !firstName.trim() || !lastName.trim() || !phone.trim()}
              className="mt-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 font-display text-[11px] uppercase tracking-pepla text-white transition hover:bg-white/15 disabled:opacity-40"
              style={{ borderColor: bronze }}
            >
              {busySpot ? "…" : link.deposit > 0 ? "Hold this time" : "Confirm booking"}
            </button>
          </form>
        )}

        {spotClaimedAwaitingDeposit && (
          <div className="mt-6 grid gap-3">
            <p className="text-center font-body text-sm text-white/70">
              Your opening is held. Pay the deposit (demo) to confirm on the calendar.
            </p>
            <button
              type="button"
              disabled={busySpot}
              onClick={() => void onStubSpotDeposit()}
              className="rounded-xl px-4 py-3 font-display text-[11px] uppercase tracking-pepla text-[#0c0a08] transition hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: bronze }}
            >
              {busySpot ? "…" : `Pay deposit ${formatMoney(link.deposit)} (stub)`}
            </button>
          </div>
        )}

        {spotBooked && confirmedSlotISO && (
          <p className="mt-8 text-center font-body text-sm text-white/85">
            You&apos;re booked for <span className="font-medium text-white">{formatSlotLabel(confirmedSlotISO)}</span>. See
            you then.
          </p>
        )}

        {error && <p className="mt-4 text-center font-body text-sm text-amber-200/90">{error}</p>}
      </div>
    </div>
  );
}
