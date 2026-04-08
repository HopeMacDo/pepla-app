import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Label, Textarea } from "../ui/primitives";
import type { IntakeRequest, IntakeStatus } from "../lib/models";
import { appendInboxMessage, getIntakeById, updateIntakeStatus } from "../lib/storage";

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

function formatThreadTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatSlotLine(iso: string, durationMins: number) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `${iso} · ${durationMins} min`;
  const when = d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${when} · ${durationMins} min`;
}

function contentTypeLabel(t: string) {
  switch (t) {
    case "slot_offer":
      return "Slot offer";
    case "booking_confirmation":
      return "Booking";
    case "payment_status":
      return "Payment";
    default:
      return "Message";
  }
}

const VALID_BACK_TABS: IntakeStatus[] = ["requests", "accepted", "upcoming", "completed", "denied"];

export default function IntakeDetailStep() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { id } = useParams();
  const [row, setRow] = useState<IntakeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [slotOfferOpen, setSlotOfferOpen] = useState(false);

  const clientProposalUrl = useMemo(() => {
    if (!id || typeof window === "undefined") return "";
    return `${window.location.origin}/proposal/${id}`;
  }, [id]);

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

  async function refresh() {
    if (!id) return;
    setRow(await getIntakeById(id));
  }

  async function onDeny() {
    if (!id) return;
    setBusy(true);
    try {
      const next = await updateIntakeStatus(id, "denied");
      if (next) {
        setRow(next);
        navigate(`/inbox?tab=denied`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmAcceptAfterPlaceholder() {
    if (!id) return;
    setBusy(true);
    try {
      const next = await updateIntakeStatus(id, "accepted");
      if (next) {
        setRow(next);
        setSlotOfferOpen(false);
        navigate(`/inbox?tab=accepted`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!id || !replyDraft.trim()) return;
    setBusy(true);
    try {
      const next = await appendInboxMessage(id, {
        sender: "provider",
        contentType: "text",
        body: replyDraft.trim()
      });
      if (next) {
        setRow(next);
        setReplyDraft("");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!row) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="font-body text-sm opacity-75">Loading thread…</div>
      </div>
    );
  }

  const displayName = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.customerName;
  const sortedMessages = [...(row.messages ?? [])].sort((a, b) => a.at.localeCompare(b.at));

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
          <details className="group rounded-2xl border border-slateGrey/15 bg-white/35">
            <summary className="cursor-pointer list-none px-4 py-3 font-display text-xs uppercase tracking-pepla text-slateGrey/80 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span>Original request</span>
                <span className="text-[10px] font-normal opacity-60 group-open:hidden">Show</span>
                <span className="hidden text-[10px] font-normal opacity-60 group-open:inline">Hide</span>
              </span>
            </summary>
            <div className="grid gap-4 border-t border-slateGrey/10 px-4 pb-4 pt-3">
              <div className="grid gap-1">
                <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Phone</div>
                <div className="font-body">{row.phoneNumber}</div>
              </div>
              <div className="grid gap-2">
                <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Vision</div>
                <div className="rounded-xl border border-slateGrey/10 bg-white/50 px-3 py-2.5 font-body text-sm">
                  {row.vision?.trim() || "No vision details provided."}
                </div>
              </div>
              <div className="grid gap-2">
                <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Availability</div>
                <div className="rounded-xl border border-slateGrey/10 bg-white/50 px-3 py-2.5 font-body text-sm">{formatAvailability(row)}</div>
              </div>
              <div className="grid gap-2">
                <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Inspiration photos</div>
                {row.photoDataUrls.length === 0 ? (
                  <div className="rounded-xl border border-slateGrey/10 bg-white/50 px-3 py-2.5 font-body text-sm opacity-75">No photos uploaded.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {row.photoDataUrls.map((src, idx) => (
                      <div key={`${idx}`} className="overflow-hidden rounded-lg border border-slateGrey/10 bg-white/50">
                        <img src={src} alt={`inspiration ${idx + 1}`} className="aspect-square w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </details>

          <section className="grid gap-3">
            <div className="font-display text-[11px] uppercase tracking-pepla opacity-80">Conversation</div>
            {sortedMessages.length === 0 ? (
              <div className="rounded-2xl border border-slateGrey/15 bg-white/40 px-4 py-8 text-center font-body text-sm text-slateGrey/65">
                No messages yet. Replies and automated updates will appear here.
              </div>
            ) : (
              <ul className="grid gap-3">
                {sortedMessages.map((m) => {
                  const isProvider = m.sender === "provider";
                  return (
                    <li
                      key={m.id}
                      className={["flex", isProvider ? "justify-end" : "justify-start"].join(" ")}
                    >
                      <div
                        className={[
                          "max-w-[min(100%,28rem)] rounded-2xl border px-3.5 py-2.5",
                          isProvider ? "border-sky/40 bg-sky/90" : "border-slateGrey/15 bg-white/60"
                        ].join(" ")}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/55">
                            {isProvider ? "You" : "Client"}
                          </span>
                          <span className="rounded bg-black/[0.06] px-1.5 py-0.5 font-display text-[9px] uppercase tracking-pepla text-slateGrey/60">
                            {contentTypeLabel(m.contentType)}
                          </span>
                          <span className="ml-auto font-body text-[11px] text-slateGrey/50">{formatThreadTime(m.at)}</span>
                        </div>
                        {m.body.trim() ? (
                          <p className="mt-1.5 whitespace-pre-wrap font-body text-sm text-slateGrey">{m.body}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {row.status === "accepted" && row.proposal && (
            <div className="rounded-2xl border border-slateGrey/15 bg-white/40 px-4 py-3 font-body text-sm">
              <div className="font-display text-[11px] uppercase tracking-pepla opacity-80">Client proposal link</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="max-w-full overflow-x-auto rounded-lg bg-white/60 px-2 py-1 text-xs">{clientProposalUrl}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(clientProposalUrl)}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}

          <section
            className="grid gap-4 border-t border-slateGrey/15 pt-6"
            aria-label="Provider actions"
          >
            {row.status === "requests" && (
              <>
                {slotOfferOpen && (
                  <div className="rounded-2xl border border-dashed border-slateGrey/25 bg-white/50 px-4 py-5">
                    <div className="font-display text-[11px] uppercase tracking-pepla opacity-80">Offer time slots</div>
                    <p className="mt-2 font-body text-sm text-slateGrey/75">
                      Slot selection UI will go here (calendar picks, duration, and send to client).
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" size="sm" disabled={busy} onClick={() => void confirmAcceptAfterPlaceholder()}>
                        Mark as accepted
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setSlotOfferOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busy || slotOfferOpen} onClick={() => setSlotOfferOpen(true)}>
                    Accept
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void onDeny()}>
                    Deny
                  </Button>
                </div>

                <form className="grid gap-2" onSubmit={(e) => void sendReply(e)}>
                  <Label htmlFor="thread-reply">Reply to client</Label>
                  <Textarea
                    id="thread-reply"
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    rows={3}
                    placeholder="Type a message…"
                    className="resize-y rounded-2xl border-slateGrey/20 bg-white/60"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" variant="ghost" size="sm" disabled={busy || !replyDraft.trim()}>
                      Send reply
                    </Button>
                  </div>
                </form>
              </>
            )}

            {row.status === "accepted" && (
              <div className="grid gap-4">
                <div>
                  <div className="font-display text-[11px] uppercase tracking-pepla opacity-80">Offered slots</div>
                  {row.slots.length === 0 ? (
                    <p className="mt-2 font-body text-sm text-slateGrey/70">
                      No slots on file yet. Slot selection and sending offers will plug in here.
                    </p>
                  ) : (
                    <ul className="mt-2 grid gap-2">
                      {row.slots.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slateGrey/15 bg-white/50 px-3 py-2.5 font-body text-sm"
                        >
                          <span>{formatSlotLine(s.startISO, s.durationMins)}</span>
                          <span className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/60">{s.status}</span>
                        </li>
                      ))}
                    </ul>
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
    </div>
  );
}
