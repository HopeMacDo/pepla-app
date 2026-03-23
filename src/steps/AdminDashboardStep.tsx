import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../ui/primitives";
import type { IntakeRequest, IntakeStatus } from "../lib/models";
import { listIntake } from "../lib/storage";

const tabOrder: IntakeStatus[] = ["requests", "accepted", "upcoming"];
const tabLabel: Record<IntakeStatus, string> = {
  requests: "Requests",
  accepted: "Accepted",
  upcoming: "Upcoming"
};

function shortVision(text: string | undefined) {
  const value = (text ?? "").trim();
  if (!value) return "No vision details yet.";
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
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

export default function AdminDashboardStep() {
  const [sp, setSp] = useSearchParams();
  const location = useLocation();
  const [rows, setRows] = useState<IntakeRequest[]>([]);
  const [query, setQuery] = useState("");

  const currentTab = useMemo<IntakeStatus>(() => {
    const raw = (sp.get("tab") ?? "requests").toLowerCase();
    return tabOrder.includes(raw as IntakeStatus) ? (raw as IntakeStatus) : "requests";
  }, [sp]);

  useEffect(() => {
    (async () => {
      setRows(await listIntake());
    })();
  }, [location.key]);

  const countsByTab = useMemo(() => {
    return tabOrder.reduce(
      (acc, tab) => {
        acc[tab] = rows.filter((row) => row.status === tab).length;
        return acc;
      },
      { requests: 0, accepted: 0, upcoming: 0 } as Record<IntakeStatus, number>
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.status !== currentTab) return false;
      if (!q) return true;
      const fullName = [row.firstName, row.lastName].filter(Boolean).join(" ").toLowerCase();
      const customerName = row.customerName.toLowerCase();
      const phone = row.phoneNumber.toLowerCase();
      const vision = (row.vision ?? "").toLowerCase();
      return fullName.includes(q) || customerName.includes(q) || phone.includes(q) || vision.includes(q);
    });
  }, [rows, currentTab, query]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="font-display tracking-pepla text-xs uppercase opacity-80">Admin</div>
          <div className="font-body mt-2 text-2xl">Intake inbox</div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-center gap-2 border-b border-slateGrey/15 pb-4">
            {tabOrder.map((tab) => {
              const active = tab === currentTab;
              return (
                <button
                  key={tab}
                  onClick={() => setSp({ tab })}
                  className={[
                    "rounded-full border px-4 py-2 font-display text-xs uppercase tracking-pepla transition",
                    active
                      ? "border-slateGrey/40 bg-slateGrey text-sand"
                      : "border-slateGrey/20 bg-white/30 text-slateGrey hover:bg-white/60"
                  ].join(" ")}
                >
                  <span>{tabLabel[tab]}</span>
                  <span
                    className={[
                      "ml-2 inline-grid min-w-[1.5rem] place-items-center rounded-full px-1.5 py-0.5 text-[10px]",
                      active ? "bg-sand/20 text-sand" : "bg-slateGrey/10 text-slateGrey"
                    ].join(" ")}
                  >
                    {countsByTab[tab]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label htmlFor="admin-search" className="sr-only">
              Search intake records
            </label>
            <input
              id="admin-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${tabLabel[currentTab]} by name, phone, or vision...`}
              className="h-11 w-full rounded-xl border border-slateGrey/20 bg-white/60 px-3 font-body text-sm outline-none transition focus:border-slateGrey/40"
            />
          </div>

          <div className="mt-5 max-h-[62vh] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-slateGrey/15 bg-white/40 px-4 py-6 font-body text-sm opacity-75">
                {query.trim()
                  ? `No ${tabLabel[currentTab]} records match "${query.trim()}".`
                  : `No records in ${tabLabel[currentTab]}.`}
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((row) => (
                  <Link
                    key={row.id}
                    to={`/admin/intake/${row.id}?tab=${currentTab}`}
                    className="rounded-2xl border border-slateGrey/15 bg-white/55 p-4 transition hover:bg-white/80"
                  >
                    <div className="font-body text-lg">{[row.firstName, row.lastName].filter(Boolean).join(" ") || row.customerName}</div>
                    <div className="mt-2 font-body text-sm opacity-75">{shortVision(row.vision)}</div>
                    <div className="mt-3 font-body text-xs uppercase tracking-[0.08em] opacity-70">{formatAvailability(row)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

