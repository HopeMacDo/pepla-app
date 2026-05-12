import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ServiceCatalogItem } from "../lib/models";
import { deleteCatalogService, getCatalogService, putCatalogService } from "../lib/storage";
import { Button, Input, Label, Textarea } from "../ui/primitives";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function durationOptions() {
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
}

const DUR_OPTS = durationOptions();

function emptyDraft(id: string, now: string): ServiceCatalogItem {
  return {
    id,
    name: "",
    durationMins: 60,
    price: 0,
    priceDisplayOnline: true,
    description: "",
    depositAmount: 0,
    depositRequirements: "",
    createdAt: now,
    updatedAt: now
  };
}

export default function ServiceEditorPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const isNew = serviceId === "new" || !serviceId;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceCatalogItem | null>(null);

  const load = useCallback(async () => {
    if (!serviceId || serviceId === "new") return;
    setLoading(true);
    setError(null);
    try {
      const row = await getCatalogService(serviceId);
      if (!row) {
        setError("That service was not found.");
        setDraft(null);
        return;
      }
      setDraft(row);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    if (isNew) {
      const now = new Date().toISOString();
      setDraft(emptyDraft(crypto.randomUUID(), now));
      setLoading(false);
      return;
    }
    void load();
  }, [isNew, load]);

  const parsedPrice = useMemo(() => {
    const n = draft?.price;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
    return n;
  }, [draft?.price]);

  const canSave = useMemo(() => {
    if (!draft || saving) return false;
    if (!draft.name.trim()) return false;
    if (parsedPrice == null) return false;
    return true;
  }, [draft, parsedPrice, saving]);

  async function onSave() {
    if (!draft || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const next: ServiceCatalogItem = {
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        depositRequirements: draft.depositRequirements.trim(),
        price: parsedPrice ?? 0,
        depositAmount: Math.max(0, draft.depositAmount),
        updatedAt: now,
        createdAt: draft.createdAt || now
      };
      await putCatalogService(next);
      navigate("/settings/services");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!serviceId || isNew) return;
    if (!window.confirm("Delete this service? It will be removed from your menu.")) return;
    setRemoving(true);
    setError(null);
    try {
      await deleteCatalogService(serviceId);
      navigate("/settings/services");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRemoving(false);
    }
  }

  if (loading || !draft) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
            aria-label="Back"
            onClick={() => navigate("/settings/services")}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">
            {isNew ? "Create a New Service" : "Edit service"}
          </h1>
        </div>
        {error ? <p className="font-body text-sm text-deepRed">{error}</p> : <p className="font-body text-sm text-slateGrey/65">Loading…</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
          aria-label="Back to services"
          onClick={() => navigate("/settings/services")}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">
          {isNew ? "Create a New Service" : "Edit service"}
        </h1>
      </div>

      <div className="grid gap-5 rounded-2xl border border-slateGrey/15 bg-white/45 p-5 sm:p-6">
        <div className="grid gap-2">
          <Label htmlFor="svc-name">Name</Label>
          <Input
            id="svc-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Full balayage"
            className="rounded-xl border border-slateGrey/20 bg-white/60 px-3 py-2 font-body text-sm"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="svc-dur">Duration</Label>
          <select
            id="svc-dur"
            value={draft.durationMins}
            onChange={(e) => setDraft({ ...draft, durationMins: Number(e.target.value) })}
            className="h-11 w-full rounded-xl border border-slateGrey/20 bg-white/60 px-3 font-body text-[15px] outline-none focus:border-slateGrey/45"
          >
            {DUR_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="svc-price">Price</Label>
            <Input
              id="svc-price"
              inputMode="decimal"
              value={draft.price === 0 ? "" : String(draft.price)}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d.]/g, "");
                if (raw === "") {
                  setDraft({ ...draft, price: 0 });
                  return;
                }
                const n = Number(raw);
                if (Number.isFinite(n) && n >= 0) setDraft({ ...draft, price: n });
              }}
              placeholder="0"
              className="rounded-xl border border-slateGrey/20 bg-white/60 px-3 py-2 font-body text-sm"
            />
          </div>
          <label
            className={cx(
              "flex cursor-pointer items-center gap-3 rounded-xl border border-slateGrey/15 bg-white/50 px-4 py-3 font-body text-sm text-slateGrey"
            )}
          >
            <input
              type="checkbox"
              checked={draft.priceDisplayOnline}
              onChange={(e) => setDraft({ ...draft, priceDisplayOnline: e.target.checked })}
              className="h-4 w-4 shrink-0 rounded border-slateGrey/40 accent-slateGrey"
            />
            <span>Display price online</span>
          </label>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="svc-desc">Description</Label>
          <Textarea
            id="svc-desc"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={4}
            placeholder="What clients should expect, add-ons, etc."
            className="min-h-[6rem] rounded-xl border border-slateGrey/20 bg-white/60 px-3 py-2 font-body text-sm"
          />
        </div>

        <div className="grid gap-4 rounded-xl border border-slateGrey/15 bg-white/40 p-4">
          <p className="font-display text-[11px] uppercase tracking-pepla text-slateGrey/55">Deposit</p>
          <div className="grid gap-2">
            <Label htmlFor="svc-dep-amt">Default deposit ($)</Label>
            <Input
              id="svc-dep-amt"
              inputMode="decimal"
              value={draft.depositAmount === 0 ? "" : String(draft.depositAmount)}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d.]/g, "");
                if (raw === "") {
                  setDraft({ ...draft, depositAmount: 0 });
                  return;
                }
                const n = Number(raw);
                if (Number.isFinite(n) && n >= 0) setDraft({ ...draft, depositAmount: n });
              }}
              placeholder="0"
              className="rounded-xl border border-slateGrey/20 bg-white/60 px-3 py-2 font-body text-sm"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="svc-dep-req">Deposit requirements</Label>
            <Textarea
              id="svc-dep-req"
              value={draft.depositRequirements}
              onChange={(e) => setDraft({ ...draft, depositRequirements: e.target.value })}
              rows={3}
              placeholder="e.g. Non-refundable $50 to book; balance due at appointment."
              className="min-h-[4.5rem] rounded-xl border border-slateGrey/20 bg-white/60 px-3 py-2 font-body text-sm"
            />
          </div>
        </div>

        {error && <p className="font-body text-sm text-deepRed">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 border-t border-slateGrey/10 pt-4">
          <Button type="button" disabled={!canSave} onClick={() => void onSave()}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {!isNew && (
            <Button type="button" variant="danger" disabled={removing} onClick={() => void onDelete()}>
              {removing ? "Deleting…" : "Delete"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
