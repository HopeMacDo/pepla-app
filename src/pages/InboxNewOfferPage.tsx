import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import IntakeOfferForm from "../components/IntakeOfferForm";
import type { IntakeRequest } from "../lib/models";
import { getIntakeById, listIntake, sweepExpiredBookingLinks } from "../lib/storage";

function displayThreadName(row: IntakeRequest) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ") || row.customerName;
}

export default function InboxNewOfferPage() {
  const [sp] = useSearchParams();
  const intakePre = sp.get("intake") ?? "";
  const customerPre = sp.get("customerId") ?? "";

  const [rows, setRows] = useState<IntakeRequest[]>([]);
  const [selectedIntakeId, setSelectedIntakeId] = useState(intakePre);
  const [selectedRow, setSelectedRow] = useState<IntakeRequest | null>(null);

  const refresh = useCallback(async () => {
    await sweepExpiredBookingLinks();
    setRows(await listIntake());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedIntakeId) {
      setSelectedRow(null);
      return;
    }
    let cancelled = false;
    void getIntakeById(selectedIntakeId).then((r) => {
      if (!cancelled) setSelectedRow(r);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIntakeId]);

  useEffect(() => {
    if (!customerPre) return;
    const match = rows.find((r) => r.customerId === customerPre && r.status === "accepted");
    if (match) setSelectedIntakeId(match.id);
  }, [customerPre, rows]);

  const acceptedRows = useMemo(() => rows.filter((r) => r.status === "accepted"), [rows]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6">
      <Link
        to="/inbox?tab=accepted"
        className="font-display text-xs uppercase tracking-pepla text-slateGrey/70 underline decoration-slateGrey/25 underline-offset-4 hover:decoration-slateGrey/50"
      >
        Inbox
      </Link>
      <h1 className="mt-4 font-body text-2xl font-normal text-slateGrey">New offer</h1>
      <p className="mt-2 max-w-xl font-body text-sm text-slateGrey/70">
        Build the offer: pick a service from your menu, set price and deposit, then drag on the week grid to add up to five
        time options that match the appointment length.
      </p>

      {customerPre && acceptedRows.length === 0 && (
        <p className="mt-6 rounded-xl border border-slateGrey/15 bg-white/40 px-4 py-3 font-body text-sm text-slateGrey/80">
          No accepted inbox thread is linked to this CRM customer yet. Accept a request first, or start from{" "}
          <Link className="underline decoration-slateGrey/30" to="/intake">
            intake
          </Link>
          .
        </p>
      )}

      <div className="mt-8 grid gap-8 rounded-2xl bg-white/40 p-6 ring-1 ring-slateGrey/10 sm:p-8">
        <div className="grid gap-2">
          <label htmlFor="offer-thread" className="font-body text-sm font-medium text-slateGrey">
            Client thread
          </label>
          <select
            id="offer-thread"
            value={selectedIntakeId}
            onChange={(e) => setSelectedIntakeId(e.target.value)}
            className="h-11 w-full rounded-xl border border-slateGrey/20 bg-white/70 px-3 font-body text-[15px] outline-none focus:border-slateGrey/45"
          >
            <option value="">Select…</option>
            {acceptedRows.map((r) => (
              <option key={r.id} value={r.id}>
                {displayThreadName(r)} · {r.phoneNumber}
              </option>
            ))}
          </select>
          <p className="font-body text-xs text-slateGrey/55">Only accepted threads can receive slot offers.</p>
        </div>

        {selectedIntakeId ? (
          <IntakeOfferForm
            key={selectedIntakeId}
            intakeId={selectedIntakeId}
            clientAvailabilitySelections={selectedRow?.availabilitySelections ?? null}
            variant="standalone"
            onSent={() => void refresh()}
          />
        ) : (
          <p className="font-body text-sm text-slateGrey/65">Select a thread to continue.</p>
        )}
      </div>
    </div>
  );
}
