import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, CardBody, CardHeader, Input, Label } from "../ui/primitives";
import type { IntakeRequest, IntakeStatus } from "../lib/models";
import { getIntakeById, sendBookingProposal, setProposalDepositPaid, updateIntakeStatus } from "../lib/storage";

const tabLabel: Record<IntakeStatus, string> = {
  requests: "Requests",
  accepted: "Accepted",
  upcoming: "Upcoming"
};

function isoDateLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toSlotISO(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map((x) => Number(x));
  const [hh, mm] = timeStr.split(":").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0).toISOString();
}

function formatProposalSlot(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

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

export default function IntakeDetailStep() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { id } = useParams();
  const [row, setRow] = useState<IntakeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [durationMins, setDurationMins] = useState(45);
  const [price, setPrice] = useState(120);
  const [deposit, setDeposit] = useState(50);
  const [slotRows, setSlotRows] = useState(() => [
    { key: crypto.randomUUID(), date: isoDateLocal(new Date()), time: "10:00" }
  ]);

  const clientProposalUrl = useMemo(() => {
    if (!id || typeof window === "undefined") return "";
    return `${window.location.origin}/proposal/${id}`;
  }, [id]);

  const backTab = useMemo<IntakeStatus>(() => {
    const raw = (sp.get("tab") ?? "requests").toLowerCase();
    return raw === "accepted" || raw === "upcoming" ? raw : "requests";
  }, [sp]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setRow(await getIntakeById(id));
    })();
  }, [id]);

  useEffect(() => {
    if (!row || row.status !== "accepted") return;
    if (row.proposal) {
      const p = row.proposal;
      setServiceName(p.serviceName);
      setDurationMins(p.durationMins);
      setPrice(p.price);
      setDeposit(p.deposit);
      setSlotRows(
        p.slotStartISOs.map((iso) => {
          const d = new Date(iso);
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          return { key: crypto.randomUUID(), date: isoDateLocal(d), time: `${hh}:${mm}` };
        })
      );
    } else {
      setServiceName("");
      setDurationMins(45);
      setPrice(120);
      setDeposit(50);
      setSlotRows([{ key: crypto.randomUUID(), date: isoDateLocal(new Date()), time: "10:00" }]);
    }
  }, [row?.id, row?.status, row?.proposal?.sentAt]);

  async function moveTo(status: IntakeStatus) {
    if (!id) return;
    setBusy(true);
    try {
      const next = await updateIntakeStatus(id, status);
      if (next) {
        setRow(next);
        navigate(`/inbox?tab=${status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitProposal(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setProposalError(null);
    const slots = slotRows.map((r) => toSlotISO(r.date, r.time));
    if (slots.some((s) => Number.isNaN(new Date(s).getTime()))) {
      setProposalError("Check each date and time.");
      return;
    }
    if (!serviceName.trim()) {
      setProposalError("Add a service name.");
      return;
    }
    setProposalBusy(true);
    try {
      const next = await sendBookingProposal(id, {
        serviceName: serviceName.trim(),
        durationMins,
        price,
        deposit,
        slotStartISOs: slots
      });
      if (next) setRow(next);
      else setProposalError("Could not save proposal (intake must be Accepted).");
    } finally {
      setProposalBusy(false);
    }
  }

  function addSlotRow() {
    setSlotRows((rows) => [...rows, { key: crypto.randomUUID(), date: isoDateLocal(new Date()), time: "11:00" }]);
  }

  function removeSlotRow(key: string) {
    setSlotRows((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  }

  async function copyClientLink() {
    if (!clientProposalUrl) return;
    try {
      await navigator.clipboard.writeText(clientProposalUrl);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setProposalError("Could not copy link.");
    }
  }

  async function markDepositPaid(paid: boolean) {
    if (!id) return;
    setDepositError(null);
    setDepositBusy(true);
    try {
      const result = await setProposalDepositPaid(id, paid);
      if (!result.ok) {
        if (result.error === "conflict") {
          setDepositError(
            "The client’s chosen time overlaps another booking. Ask them to pick a different slot or clear the calendar conflict."
          );
          setRow(await getIntakeById(id));
        }
        return;
      }
      setRow(result.intake);
      if (result.finalized) {
        navigate(`/inbox?tab=upcoming`);
      }
    } finally {
      setDepositBusy(false);
    }
  }

  if (!row) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="font-body text-sm opacity-75">Loading intake request...</div>
      </div>
    );
  }

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
          <div className="font-display tracking-pepla text-xs uppercase opacity-80">Intake detail</div>
          <div className="font-body mt-2 text-2xl">{[row.firstName, row.lastName].filter(Boolean).join(" ") || row.customerName}</div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-6">
            <div className="grid gap-1">
              <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Phone</div>
              <div className="font-body">{row.phoneNumber}</div>
            </div>

            <div className="grid gap-2">
              <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Vision</div>
              <div className="rounded-2xl border border-slateGrey/15 bg-white/45 px-4 py-3 font-body">
                {row.vision?.trim() || "No vision details provided."}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Availability</div>
              <div className="rounded-2xl border border-slateGrey/15 bg-white/45 px-4 py-3 font-body">{formatAvailability(row)}</div>
            </div>

            <div className="grid gap-3">
              <div className="font-display text-[11px] uppercase tracking-pepla opacity-70">Inspiration photos</div>
              {row.photoDataUrls.length === 0 ? (
                <div className="rounded-2xl border border-slateGrey/15 bg-white/45 px-4 py-3 font-body text-sm opacity-75">No photos uploaded.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {row.photoDataUrls.map((src, idx) => (
                    <div key={`${idx}`} className="overflow-hidden rounded-xl border border-slateGrey/15 bg-white/45">
                      <img src={src} alt={`inspiration ${idx + 1}`} className="aspect-square w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {row.status === "accepted" && (
              <div className="grid gap-4 border-t border-slateGrey/15 pt-4">
                <div className="font-display text-[11px] uppercase tracking-pepla opacity-80">Send client proposal</div>
                <p className="font-body text-sm opacity-75">
                  Send the link below after you record the service and offered times. The calendar only blocks once the
                  client has chosen a time <span className="font-medium">and</span> their deposit is marked received
                  (payment hook later).
                </p>

                {row.proposal && (
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-slateGrey/15 bg-white/40 px-4 py-3">
                      <div className="font-body text-sm">
                        <span className="opacity-70">Client link</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="max-w-full overflow-x-auto rounded-lg bg-white/60 px-2 py-1 font-body text-xs">
                          {clientProposalUrl}
                        </code>
                        <Button type="button" variant="ghost" size="sm" onClick={() => void copyClientLink()}>
                          {copyDone ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slateGrey/15 bg-white/40 px-4 py-3">
                      <div className="font-display text-[11px] uppercase tracking-pepla opacity-80">Deposit & client pick</div>
                      <div className="mt-3 grid gap-2 font-body text-sm">
                        <div>
                          <span className="opacity-70">Deposit: </span>
                          {row.proposal.depositPaid ? (
                            <span className="font-medium text-slateGrey">Received</span>
                          ) : (
                            <span className="opacity-80">Not received</span>
                          )}
                        </div>
                        {row.proposal.pendingSlotISO && (
                          <div>
                            <span className="opacity-70">Client’s preferred time: </span>
                            <span className="font-medium text-slateGrey">{formatProposalSlot(row.proposal.pendingSlotISO)}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={depositBusy || row.proposal.depositPaid}
                          onClick={() => void markDepositPaid(true)}
                        >
                          Mark deposit received
                        </Button>
                        {row.proposal.depositPaid && (
                          <Button type="button" variant="ghost" size="sm" disabled={depositBusy} onClick={() => void markDepositPaid(false)}>
                            Undo (demo)
                          </Button>
                        )}
                      </div>
                      {depositError && <div className="mt-2 font-body text-sm text-deepRed">{depositError}</div>}
                    </div>
                  </div>
                )}

                <form className="grid gap-4" onSubmit={(e) => void submitProposal(e)}>
                  <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                    <div className="grid gap-1">
                      <Label htmlFor="prop-service">Service</Label>
                      <Input
                        id="prop-service"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        placeholder="e.g. Fine line — small"
                        required
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="prop-duration">Duration (minutes)</Label>
                      <Input
                        id="prop-duration"
                        type="number"
                        min={15}
                        step={5}
                        value={durationMins}
                        onChange={(e) => setDurationMins(Number(e.target.value) || 45)}
                        required
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="prop-price">Price ($)</Label>
                      <Input
                        id="prop-price"
                        type="number"
                        min={0}
                        step={1}
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value) || 0)}
                        required
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="prop-deposit">Deposit ($)</Label>
                      <Input
                        id="prop-deposit"
                        type="number"
                        min={0}
                        step={1}
                        value={deposit}
                        onChange={(e) => setDeposit(Number(e.target.value) || 0)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Proposed times</Label>
                    <div className="grid gap-2">
                      {slotRows.map((r) => (
                        <div key={r.key} className="flex flex-wrap items-end gap-2">
                          <div className="grid min-w-[9rem] flex-1 gap-1">
                            <span className="font-display text-[10px] uppercase tracking-pepla opacity-60">Date</span>
                            <Input type="date" value={r.date} onChange={(e) => setSlotRows((rows) => rows.map((x) => (x.key === r.key ? { ...x, date: e.target.value } : x)))} required />
                          </div>
                          <div className="grid w-28 gap-1">
                            <span className="font-display text-[10px] uppercase tracking-pepla opacity-60">Time</span>
                            <Input type="time" value={r.time} onChange={(e) => setSlotRows((rows) => rows.map((x) => (x.key === r.key ? { ...x, time: e.target.value } : x)))} required />
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="mb-0.5" onClick={() => removeSlotRow(r.key)}>
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={addSlotRow}>
                      Add time slot
                    </Button>
                  </div>

                  {proposalError && <div className="font-body text-sm text-deepRed">{proposalError}</div>}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={proposalBusy}>
                      {row.proposal ? "Update proposal" : "Send proposal"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => moveTo("upcoming")} disabled={busy || proposalBusy}>
                      Skip proposal · mark upcoming
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {(row.status === "requests" || row.status === "upcoming") && (
              <div className="flex items-center gap-3 border-t border-slateGrey/15 pt-4">
                {row.status === "requests" && (
                  <Button onClick={() => moveTo("accepted")} disabled={busy}>
                    Accept
                  </Button>
                )}
                {row.status === "upcoming" && (
                  <div className="font-body text-sm opacity-70">
                    <p>This intake is already marked as upcoming.</p>
                    {row.proposal?.selectedSlotISO && (
                      <p className="mt-2 font-medium text-slateGrey">
                        Booked: {formatProposalSlot(row.proposal.selectedSlotISO)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

