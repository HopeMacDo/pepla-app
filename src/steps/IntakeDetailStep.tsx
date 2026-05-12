import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import IntakeAvailabilityReadGrid from "../components/IntakeAvailabilityReadGrid";
import IntakeOfferForm from "../components/IntakeOfferForm";
import { Button, Card, CardBody, CardHeader, Label, Textarea } from "../ui/primitives";
import type { IntakeRequest, IntakeStatus, InboxSlot } from "../lib/models";
import { appendInboxMessage, getActiveOfferTokenForIntake, getIntakeById, updateIntakeStatus } from "../lib/storage";

const tabLabel: Record<IntakeStatus, string> = {
  requests: "Requests",
  accepted: "Accepted",
  upcoming: "Upcoming",
  completed: "Completed",
  denied: "Denied"
};

function formatAvailability(req: IntakeRequest) {
  const fromSelections = req.availabilitySelections;
  if (fromSelections) {
    const slots = [
      ["Mornings", fromSelections.mornings] as const,
      ["Afternoons", fromSelections.afternoons] as const
    ];
    return slots
      .map(([label, values]) => {
        const days = (Object.keys(values) as Array<keyof typeof values>)
          .filter((k) => values[k])
          .map((k) => String(k).toUpperCase());
        return `${label}: ${days.length ? days.join(", ") : "none"}`;
      })
      .join(" | ");
  }
  return req.availability;
}

function formatSlotLine(iso: string, durationMins: number) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `${iso} · ${durationMins} min`;
  const when = d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${when} · ${durationMins} min`;
}

function OfferedSlotCard({ slot }: { slot: InboxSlot }) {
  const d = new Date(slot.startISO);
  if (Number.isNaN(d.getTime())) {
    return (
      <div className="rounded-xl border border-slateGrey/20 bg-chalk px-3 py-3 text-center font-body text-xs text-slateGrey/70">
        Invalid time
      </div>
    );
  }
  const selected = slot.status === "selected";
  const expired = slot.status === "expired";
  const day = d.toLocaleDateString([], { weekday: "short" }).toUpperCase();
  const dateLabel = `${d.getMonth() + 1}.${d.getDate()}`;
  const timeLabel = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();

  return (
    <div
      className={[
        "flex min-w-[5.75rem] max-w-[6.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-3 text-center shadow-sm transition",
        selected ? "bg-void text-chalk ring-1 ring-void" : "border border-slateGrey/25 bg-chalk text-slateGrey",
        expired ? "opacity-55" : ""
      ].join(" ")}
    >
      <span className={`font-display text-[9px] uppercase tracking-[0.18em] ${selected ? "text-chalk/90" : "text-slateGrey/55"}`}>
        {day}
      </span>
      <span className={`font-body text-lg font-semibold tabular-nums leading-tight ${selected ? "text-chalk" : "text-slateGrey"}`}>
        {dateLabel}
      </span>
      <span className={`font-body text-[13px] tabular-nums leading-tight ${selected ? "text-chalk/90" : "text-slateGrey/85"}`}>
        {timeLabel}
      </span>
      {expired && (
        <span className="mt-0.5 font-display text-[8px] uppercase tracking-pepla text-slateGrey/50">Expired</span>
      )}
    </div>
  );
}

const VALID_BACK_TABS: IntakeStatus[] = ["requests", "accepted", "upcoming", "completed", "denied"];

export default function IntakeDetailStep() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { id } = useParams();
  const [row, setRow] = useState<IntakeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientBookUrl, setClientBookUrl] = useState<string | null>(null);
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [denyMessageDraft, setDenyMessageDraft] = useState("");
  const [offerFlowOpen, setOfferFlowOpen] = useState(false);

  const clientProposalUrl = useMemo(() => {
    if (!id || typeof window === "undefined") return "";
    return `${window.location.origin}/proposal/${id}`;
  }, [id]);

  const shareClientUrl = clientBookUrl ?? clientProposalUrl;

  const backTab = useMemo<IntakeStatus>(() => {
    const raw = (sp.get("tab") ?? "requests").toLowerCase() as IntakeStatus;
    return VALID_BACK_TABS.includes(raw) ? raw : "requests";
  }, [sp]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const r = await getIntakeById(id);
      if (!cancelled) setRow(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !row?.proposal) {
      setClientBookUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const t = await getActiveOfferTokenForIntake(id);
      if (!cancelled) setClientBookUrl(t ? `${window.location.origin}/book/${t}` : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, row?.proposal, row?.updatedAt]);

  useEffect(() => {
    setOfferFlowOpen(false);
  }, [id]);

  async function refresh() {
    if (!id) return;
    setRow(await getIntakeById(id));
  }

  function closeDenyDialog() {
    setDenyDialogOpen(false);
    setDenyMessageDraft("");
  }

  useEffect(() => {
    if (!denyDialogOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDenyDialog();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [denyDialogOpen]);

  async function beginOfferFlow() {
    if (!id) return;
    if (row?.status === "requests") {
      setBusy(true);
      try {
        const next = await updateIntakeStatus(id, "accepted");
        if (next) {
          setRow(next);
          setOfferFlowOpen(true);
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    setOfferFlowOpen(true);
  }

  async function confirmDeny() {
    if (!id) return;
    setBusy(true);
    try {
      const note = denyMessageDraft.trim();
      const body = note
        ? `This request has been declined.\n\n${note}`
        : "This request has been declined.";
      await appendInboxMessage(id, { sender: "provider", contentType: "text", body });
      const next = await updateIntakeStatus(id, "denied");
      if (next) {
        setRow(next);
        closeDenyDialog();
        navigate(`/inbox?tab=denied`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!row) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="font-body text-sm opacity-75">Loading…</div>
      </div>
    );
  }

  const displayName = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.customerName;

  return (
    <div className="grid gap-6">
      <div>
        <Link
          to={`/inbox?tab=${backTab}`}
          className="font-display text-xs uppercase tracking-pepla text-slateGrey/70 underline decoration-slateGrey/25 underline-offset-4 hover:decoration-slateGrey/50"
        >
          {tabLabel[backTab]}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display tracking-pepla text-xs uppercase opacity-80">Thread</div>
              <div className="font-body mt-2 text-2xl">{displayName}</div>
              {row.customerId && (
                <Link
                  to={`/customers/${row.customerId}`}
                  className="mt-1 inline-block font-body text-sm text-slateGrey/70 underline decoration-slateGrey/25 underline-offset-4 hover:text-slateGrey"
                >
                  View customer in CRM
                </Link>
              )}
            </div>
            <span
              className="rounded-md px-2.5 py-1 font-display text-[10px] font-medium uppercase tracking-pepla"
              style={{ backgroundColor: "var(--color-background-secondary)" }}
            >
              {tabLabel[row.status]}
            </span>
          </div>
        </CardHeader>
        <CardBody className="grid gap-8">
          <section className="grid gap-4" aria-label="Original request">
            <div className="font-display text-[11px] uppercase tracking-pepla opacity-80">Original request</div>
            <div className="grid gap-4">
              <div className="grid gap-1">
                <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Phone</div>
                <div className="font-body">{row.phoneNumber}</div>
              </div>
              <div className="grid gap-1.5">
                <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Vision</div>
                <div className="font-body text-sm text-slateGrey">{row.vision?.trim() || "No vision details provided."}</div>
              </div>
              <div className="grid gap-1.5">
                <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Availability</div>
                {row.availabilitySelections ? (
                  <IntakeAvailabilityReadGrid selections={row.availabilitySelections} />
                ) : (
                  <div className="font-body text-sm text-slateGrey">{formatAvailability(row)}</div>
                )}
              </div>
              <div className="grid gap-2">
                <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Inspiration photos</div>
                {row.photoDataUrls.length === 0 ? (
                  <div className="font-body text-sm text-slateGrey/75">No photos uploaded.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {row.photoDataUrls.map((src, idx) => (
                      <div key={`${idx}`} className="overflow-hidden rounded-lg bg-slateGrey/10">
                        <img src={src} alt={`inspiration ${idx + 1}`} className="aspect-square w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section
            className="grid gap-4 border-t border-slateGrey/15 pt-6"
            aria-label="Provider actions"
          >
            {row.status === "requests" && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy || !id} onClick={() => void beginOfferFlow()}>
                  Accept & offer times
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setDenyMessageDraft("");
                    setDenyDialogOpen(true);
                  }}
                >
                  Deny
                </Button>
              </div>
            )}

            {row.status === "accepted" && (
              <div className="grid gap-5">
                <div>
                  <div className="font-display text-[11px] uppercase tracking-pepla opacity-80">Offered slots</div>

                  {row.slots.length === 0 ? (
                    <p className="mt-2 font-body text-sm text-slateGrey/70">
                      No active offer yet. Use <span className="font-medium">New offer</span> below to pick times and send a link.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                      <div className="flex flex-wrap gap-2">
                        {row.slots.map((s) => (
                          <OfferedSlotCard key={s.id} slot={s} />
                        ))}
                      </div>

                      {row.proposal && (
                        <div className="min-w-0 flex-1 border-t border-slateGrey/15 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                          <div className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/60">Client booking link</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <code className="max-w-full flex-1 overflow-x-auto break-all rounded-lg border border-slateGrey/15 bg-white/60 px-2 py-1.5 font-body text-[11px] text-slateGrey">
                              {shareClientUrl}
                            </code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void navigator.clipboard.writeText(shareClientUrl)}
                            >
                              Copy
                            </Button>
                          </div>
                          {!clientBookUrl && (
                            <p className="mt-2 font-body text-xs text-slateGrey/55">
                              Legacy link (intake id). Send a fresh offer to get a private token link.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {row.bookingDetails && (
                  <div className="rounded-2xl border border-slateGrey/15 bg-white/45 px-4 py-3">
                    <div className="font-display text-[11px] uppercase tracking-pepla opacity-80">Booking details</div>
                    <dl className="mt-3 grid gap-2 font-body text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slateGrey/65">Service</dt>
                        <dd className="font-medium text-slateGrey">{row.bookingDetails.serviceLabel}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slateGrey/65">Deposit</dt>
                        <dd className="font-medium text-slateGrey">${row.bookingDetails.depositAmount}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slateGrey/65">Payment</dt>
                        <dd className="font-medium text-slateGrey">{row.bookingDetails.paymentStatus}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 font-body text-xs text-slateGrey/55">Payment capture and adjustments — placeholder.</p>
                  </div>
                )}

                <Button type="button" variant="ghost" size="sm" className="w-fit" disabled>
                  Edit slot offer (coming soon)
                </Button>

                <div className="grid max-w-md gap-2 border-t border-slateGrey/15 pt-5">
                  <Button type="button" className="w-full justify-center sm:w-auto sm:min-w-[14rem]" onClick={() => setOfferFlowOpen(true)}>
                    New offer
                  </Button>
                  <p className="font-body text-xs text-slateGrey/55">Send up to five time options with a private booking link.</p>
                </div>
              </div>
            )}

            {(row.status === "upcoming" || row.status === "completed" || row.status === "denied") && (
              <div className="font-body text-sm text-slateGrey/75">
                {row.status === "denied" && <p>This request was denied. No further provider actions.</p>}
                {row.status === "completed" && <p>This thread is marked completed.</p>}
                {row.status === "upcoming" && (
                  <p>
                    This booking is on the calendar.
                    {row.proposal?.selectedSlotISO ? (
                      <span className="mt-2 block font-medium text-slateGrey">
                        {formatSlotLine(row.proposal.selectedSlotISO, row.proposal.durationMins)}
                      </span>
                    ) : null}
                  </p>
                )}
                <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={() => void refresh()}>
                  Refresh thread
                </Button>
              </div>
            )}
          </section>
        </CardBody>
      </Card>

      {offerFlowOpen && id && row.status === "accepted" && (
        <Card>
          <CardHeader>
            <div className="font-display tracking-pepla text-xs uppercase opacity-80">Offer times</div>
            <div className="font-body mt-2 text-xl text-slateGrey">Build offer for {displayName}</div>
          </CardHeader>
          <CardBody>
            <IntakeOfferForm
              intakeId={id}
              clientAvailabilitySelections={row.availabilitySelections ?? null}
              variant="embedded"
              onCancel={() => setOfferFlowOpen(false)}
              onSent={() => void refresh()}
            />
          </CardBody>
        </Card>
      )}

      {denyDialogOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slateGrey/35 px-4 py-8"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDenyDialog();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deny-dialog-title"
            className="w-full max-w-md rounded-2xl border border-slateGrey/15 bg-chalk px-5 py-5 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div id="deny-dialog-title" className="font-body text-lg text-slateGrey">
              Deny this request?
            </div>
            <p className="mt-2 font-body text-sm text-slateGrey/75">
              The client will be notified that the request was declined. You can add an optional personal message below.
            </p>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="deny-message">Message to client (optional)</Label>
              <Textarea
                id="deny-message"
                value={denyMessageDraft}
                onChange={(e) => setDenyMessageDraft(e.target.value)}
                rows={4}
                placeholder="e.g. We’re fully booked for the style you described…"
                className="resize-y rounded-xl border-slateGrey/20 bg-white/70 font-body text-sm"
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={closeDenyDialog}>
                Cancel
              </Button>
              <Button type="button" disabled={busy} onClick={() => void confirmDeny()}>
                Deny request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
