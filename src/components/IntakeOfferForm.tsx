import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import OfferWeekTimePicker from "./OfferWeekTimePicker";
import { Button, Input, Label } from "../ui/primitives";
import type { Appointment, IntakeAvailability, IntakeRequest, ServiceCatalogItem } from "../lib/models";
import {
  getActiveOfferTokenForIntake,
  listAppointments,
  listCatalogServices,
  sendOfferWithShareableLink,
  sweepExpiredBookingLinks,
  type BookingProposalInput
} from "../lib/storage";

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

export type IntakeOfferFormProps = {
  intakeId: string;
  clientAvailabilitySelections?: IntakeAvailability | null;
  /** `embedded`: intake thread page — optional close. `standalone`: inbox new-offer page. */
  variant?: "embedded" | "standalone";
  onCancel?: () => void;
  /** Called after a successful send (e.g. parent refresh). */
  onSent?: (payload: { shareUrl: string; intake: IntakeRequest }) => void;
};

export default function IntakeOfferForm({
  intakeId,
  clientAvailabilitySelections = null,
  variant = "standalone",
  onCancel,
  onSent
}: IntakeOfferFormProps) {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providerDisplayName, setProviderDisplayName] = useState("Hope");
  const [presetChoice, setPresetChoice] = useState<string>("");
  const [customService, setCustomService] = useState("");
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [durationMins, setDurationMins] = useState(60);
  const [priceInput, setPriceInput] = useState("220");
  const [depositEnabled, setDepositEnabled] = useState(true);
  const [depositInput, setDepositInput] = useState("50");
  const [selectedSlotISOs, setSelectedSlotISOs] = useState<string[]>([]);
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const catalogRef = useRef<ServiceCatalogItem[]>([]);
  catalogRef.current = catalog;

  const refreshLocal = useCallback(async () => {
    await sweepExpiredBookingLinks();
    setAppointments(await listAppointments());
    setCatalog(await listCatalogServices());
  }, []);

  useEffect(() => {
    void refreshLocal();
  }, [refreshLocal]);

  useEffect(() => {
    if (catalog.length === 0) {
      setPresetChoice("CUSTOM");
      return;
    }
    setPresetChoice((prev) => {
      if (prev && prev !== "CUSTOM" && catalog.some((s) => s.id === prev)) return prev;
      return catalog[0]!.id;
    });
  }, [catalog]);

  useEffect(() => {
    if (presetChoice === "CUSTOM" || !presetChoice) return;
    const s = catalogRef.current.find((x) => x.id === presetChoice);
    if (!s) return;
    setDurationMins(s.durationMins);
    setPriceInput(s.price ? String(s.price) : "0");
    if (s.depositAmount > 0) {
      setDepositEnabled(true);
      setDepositInput(String(s.depositAmount));
    } else {
      setDepositEnabled(false);
      setDepositInput("0");
    }
  }, [presetChoice]);

  const parsedPrice = useMemo(() => {
    const n = Number(priceInput.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [priceInput]);

  const parsedDeposit = useMemo(() => {
    if (!depositEnabled) return 0;
    const n = Number(depositInput.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [depositEnabled, depositInput]);

  const effectiveServiceName = useMemo(() => {
    if (presetChoice === "CUSTOM") return customService.trim();
    const s = catalog.find((x) => x.id === presetChoice);
    return (s?.name ?? "").trim();
  }, [catalog, customService, presetChoice]);

  const expiresAtISO = useMemo(() => {
    if (!expiresAtLocal.trim()) return undefined;
    const d = new Date(expiresAtLocal);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }, [expiresAtLocal]);

  const canSend = useMemo(() => {
    if (busy) return false;
    if (!intakeId) return false;
    if (!effectiveServiceName) return false;
    if (parsedPrice == null || parsedDeposit === null) return false;
    if (selectedSlotISOs.length < 1 || selectedSlotISOs.length > 5) return false;
    return true;
  }, [busy, effectiveServiceName, intakeId, parsedDeposit, parsedPrice, selectedSlotISOs.length]);

  const [existingLink, setExistingLink] = useState<string | null>(null);

  useEffect(() => {
    if (!intakeId) {
      setExistingLink(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const t = await getActiveOfferTokenForIntake(intakeId);
      if (cancelled) return;
      setExistingLink(t ? `${window.location.origin}/book/${t}` : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [intakeId, shareUrl]);

  async function onSend() {
    setError(null);
    setShareUrl(null);
    if (!effectiveServiceName) {
      setError("Choose or enter a service.");
      return;
    }
    if (parsedPrice == null || parsedDeposit === null) {
      setError("Enter a valid price and deposit amount.");
      return;
    }
    const slots = Array.from(new Set(selectedSlotISOs)).sort((a, b) => a.localeCompare(b));
    if (slots.length < 1) {
      setError("Add at least one time from the calendar.");
      return;
    }
    if (slots.length > 5) {
      setError("You can offer up to five time options.");
      return;
    }
    setBusy(true);
    try {
      const payload: BookingProposalInput = {
        serviceName: effectiveServiceName,
        durationMins,
        price: parsedPrice,
        deposit: parsedDeposit,
        slotStartISOs: slots
      };
      const res = await sendOfferWithShareableLink(intakeId, payload, {
        providerDisplayName: providerDisplayName.trim(),
        expiresAt: expiresAtISO
      });
      if (!res) {
        setError("Could not send offer — try again or refresh the thread.");
        return;
      }
      const url = `${window.location.origin}/book/${res.token}`;
      setShareUrl(url);
      setSelectedSlotISOs([]);
      await refreshLocal();
      onSent?.({ shareUrl: url, intake: res.intake });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      {variant === "embedded" && onCancel && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-body text-sm text-slateGrey/75">
            Pick 1–5 times (drag on the week). Client preferred windows are highlighted when available.
          </p>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Close
          </Button>
        </div>
      )}

      {existingLink && !shareUrl && (
        <div className="rounded-xl border border-slateGrey/15 bg-white/60 px-4 py-3 font-body text-xs text-slateGrey/75">
          Active link on file: <code className="break-all text-[11px] text-slateGrey">{existingLink}</code>
          <button
            type="button"
            className="ml-2 font-display text-[10px] uppercase tracking-pepla text-slateGrey/70 underline"
            onClick={() => void navigator.clipboard.writeText(existingLink)}
          >
            Copy
          </button>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor={`offer-provider-${intakeId}`}>Your first name (shown to client)</Label>
        <Input
          id={`offer-provider-${intakeId}`}
          value={providerDisplayName}
          onChange={(e) => setProviderDisplayName(e.target.value)}
          className="rounded-xl border border-slateGrey/20 bg-white/70 px-3 py-2 font-body text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`offer-service-${intakeId}`}>Service</Label>
          <select
            id={`offer-service-${intakeId}`}
            value={
              presetChoice === "CUSTOM" || (presetChoice && !catalog.some((s) => s.id === presetChoice))
                ? "CUSTOM"
                : presetChoice
            }
            onChange={(e) => {
              const v = e.target.value;
              setPresetChoice(v);
              if (v === "CUSTOM") setCustomService("");
            }}
            className="h-11 w-full rounded-xl border border-slateGrey/20 bg-white/70 px-3 font-body text-[15px] outline-none focus:border-slateGrey/45"
          >
            {catalog.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="CUSTOM">Custom…</option>
          </select>
          {(presetChoice === "CUSTOM" || (presetChoice && !catalog.some((s) => s.id === presetChoice))) && (
            <Input
              value={customService}
              onChange={(e) => setCustomService(e.target.value)}
              placeholder="Service name"
              className="rounded-xl border border-slateGrey/20 bg-white/70 px-3 py-2 font-body text-sm"
            />
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`offer-dur-${intakeId}`}>Duration</Label>
          <select
            id={`offer-dur-${intakeId}`}
            value={durationMins}
            onChange={(e) => setDurationMins(Number(e.target.value))}
            className="h-11 w-full rounded-xl border border-slateGrey/20 bg-white/70 px-3 font-body text-[15px] outline-none focus:border-slateGrey/45"
          >
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m % 60 === 0 ? `${m / 60} hr` : `${m} min`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`offer-price-${intakeId}`}>Total price</Label>
          <Input
            id={`offer-price-${intakeId}`}
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="rounded-xl border border-slateGrey/20 bg-white/70 px-3 py-2 font-body text-sm"
          />
        </div>
        <div className="grid gap-3 rounded-xl border border-slateGrey/15 bg-white/50 p-4">
          <label className="flex cursor-pointer items-center gap-2 font-body text-sm text-slateGrey">
            <input
              type="checkbox"
              checked={depositEnabled}
              onChange={(e) => setDepositEnabled(e.target.checked)}
              className="rounded border-slateGrey/40"
            />
            Require deposit
          </label>
          {depositEnabled && (
            <>
              <Label htmlFor={`offer-dep-${intakeId}`}>Deposit amount</Label>
              <Input
                id={`offer-dep-${intakeId}`}
                inputMode="decimal"
                value={depositInput}
                onChange={(e) => setDepositInput(e.target.value)}
                className="rounded-xl border border-slateGrey/20 bg-white/70 px-3 py-2 font-body text-sm"
              />
            </>
          )}
        </div>
      </div>

      <OfferWeekTimePicker
        durationMins={durationMins}
        selectedSlotISOs={selectedSlotISOs}
        maxSlots={5}
        appointments={appointments}
        onChange={setSelectedSlotISOs}
        clientAvailabilitySelections={clientAvailabilitySelections}
      />

      <div className="grid gap-2">
        <Label htmlFor={`offer-exp-${intakeId}`}>Offer expires (optional)</Label>
        <Input
          id={`offer-exp-${intakeId}`}
          type="datetime-local"
          value={expiresAtLocal}
          onChange={(e) => setExpiresAtLocal(e.target.value)}
          className="rounded-xl border border-slateGrey/20 bg-white/70 px-3 py-2 font-body text-sm"
        />
      </div>

      {error && <p className="font-body text-sm text-deepRed">{error}</p>}

      {shareUrl && (
        <div className="rounded-xl border border-slateGrey/15 bg-white/70 px-4 py-3">
          <div className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/60">Private client link</div>
          <code className="mt-2 block break-all font-body text-xs text-slateGrey">{shareUrl}</code>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => void navigator.clipboard.writeText(shareUrl)}>
            Copy
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-slateGrey/10 pt-6">
        <Button type="button" disabled={!canSend} onClick={() => void onSend()}>
          {busy ? "Sending…" : "Send offer"}
        </Button>
        {variant === "standalone" && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !intakeId}
            onClick={() => navigate(`/inbox/intake/${intakeId}?tab=accepted`)}
          >
            Open thread
          </Button>
        )}
        {variant === "embedded" && shareUrl && onCancel && (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Done
          </Button>
        )}
        <Link
          to="/settings/services"
          className="self-center font-display text-[11px] uppercase tracking-pepla text-slateGrey/60 underline decoration-slateGrey/25 underline-offset-4 hover:text-slateGrey"
        >
          Edit service menu
        </Link>
      </div>
    </div>
  );
}
