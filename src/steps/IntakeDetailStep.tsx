import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, CardBody, CardHeader } from "../ui/primitives";
import type { IntakeRequest, IntakeStatus } from "../lib/models";
import { getIntakeById, updateIntakeStatus } from "../lib/storage";

const tabLabel: Record<IntakeStatus, string> = {
  requests: "Requests",
  accepted: "Accepted",
  upcoming: "Upcoming"
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

export default function IntakeDetailStep() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { id } = useParams();
  const [row, setRow] = useState<IntakeRequest | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function moveTo(status: IntakeStatus) {
    if (!id) return;
    setBusy(true);
    try {
      const next = await updateIntakeStatus(id, status);
      if (next) {
        setRow(next);
        navigate(`/admin?tab=${status}`);
      }
    } finally {
      setBusy(false);
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
          to={`/admin?tab=${backTab}`}
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

            <div className="flex items-center gap-3 border-t border-slateGrey/15 pt-4">
              {row.status === "requests" && (
                <Button onClick={() => moveTo("accepted")} disabled={busy}>
                  Accept
                </Button>
              )}
              {row.status === "accepted" && (
                <Button onClick={() => moveTo("upcoming")} disabled={busy}>
                  Mark as upcoming
                </Button>
              )}
              {row.status === "upcoming" && (
                <div className="font-body text-sm opacity-70">This intake is already marked as upcoming.</div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

