import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Card, CardBody, CardHeader, Input, Label } from "../ui/primitives";
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

function rowInitials(row: IntakeRequest) {
  const f = row.firstName?.trim();
  const l = row.lastName?.trim();
  if (f && l) return `${f[0]!}${l[0]!}`.toUpperCase();
  if (f) return (f.length >= 2 ? f.slice(0, 2) : `${f[0]!}?`).toUpperCase();
  const name = row.customerName.trim();
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Display-only: NEW = needs studio action; PENDING = waiting on client. Upcoming rows have no badge. */
function rowStatusBadge(row: IntakeRequest): "NEW" | "PENDING" | null {
  if (row.status === "upcoming") return null;
  if (row.status === "requests") return "NEW";
  if (row.status === "accepted") {
    if (row.proposal) return "PENDING";
    return "NEW";
  }
  return null;
}

function listSummaryLine(tab: IntakeStatus, totalInTab: number, matchCount: number, hasQuery: boolean): string {
  if (hasQuery) {
    if (matchCount === 0) return "No records match your search.";
    return `${matchCount} ${matchCount === 1 ? "record" : "records"} match your search.`;
  }
  if (totalInTab === 0) return `No ${tabLabel[tab].toLowerCase()} yet.`;
  if (tab === "requests") {
    return `${totalInTab} ${totalInTab === 1 ? "request" : "requests"} waiting for a response.`;
  }
  if (tab === "accepted") {
    return `${totalInTab} ${totalInTab === 1 ? "client" : "clients"} in accepted booking.`;
  }
  return `${totalInTab} scheduled on the calendar.`;
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

  const hasQuery = Boolean(query.trim());
  const summaryText = listSummaryLine(currentTab, countsByTab[currentTab], filtered.length, hasQuery);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div
            className="text-2xl font-normal italic leading-snug tracking-[-0.01em] text-slateGrey"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            Inbox
          </div>
        </CardHeader>
        <CardBody>
          <div
            className="relative border-b-[0.5px] pb-0"
            style={{ borderColor: "var(--color-border-tertiary)" }}
          >
            <div className="relative flex flex-wrap gap-x-8 gap-y-2">
              {tabOrder.map((tab) => {
                const active = tab === currentTab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSp({ tab })}
                    className={[
                      "flex items-center gap-2 pb-3 pt-1 font-display text-xs uppercase tracking-pepla transition",
                      "border-b-[1.5px] -mb-[0.5px]",
                      active ? "border-[#0E0E0E] text-[#0E0E0E]" : "border-transparent text-slateGrey/50 hover:text-slateGrey/75"
                    ].join(" ")}
                  >
                    <span>{tabLabel[tab]}</span>
                    <span
                      className={[
                        "inline-grid min-w-[1.25rem] place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none",
                        active ? "bg-[#0E0E0E] text-[#F2EFE9]" : "text-slateGrey/70"
                      ].join(" ")}
                      style={active ? undefined : { backgroundColor: "var(--color-background-secondary)" }}
                    >
                      {countsByTab[tab]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <Label htmlFor="inbox-search">Search</Label>
            <div className="flex min-w-0 items-center gap-2 border-b border-b-[0.5px] pb-2.5 transition [border-bottom-color:var(--color-border-tertiary)] focus-within:border-slateGrey/40">
              <svg
                className="h-4 w-4 shrink-0 text-slateGrey/45"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <Input
                id="inbox-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder=""
                autoComplete="off"
                className="min-w-0 flex-1 rounded-none border-0 border-b-0 bg-transparent px-0 py-0 font-body text-[15px] text-slateGrey shadow-none outline-none ring-0 focus:border-transparent focus:ring-0"
              />
            </div>
          </div>

          <div className="mt-5 max-h-[62vh] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="border-b-[0.5px] py-10 text-center font-body text-sm text-slateGrey/60" style={{ borderColor: "var(--color-border-tertiary)" }}>
                {query.trim()
                  ? `No ${tabLabel[currentTab]} records match "${query.trim()}".`
                  : `No records in ${tabLabel[currentTab]}.`}
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((row) => {
                  const badge = rowStatusBadge(row);
                  return (
                    <Link
                      key={row.id}
                      to={`/inbox/intake/${row.id}?tab=${currentTab}`}
                      className="flex gap-3 border-b-[0.5px] py-4 transition hover:opacity-90"
                      style={{ borderColor: "var(--color-border-tertiary)" }}
                    >
                      <div
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-display text-[11px] font-medium uppercase tracking-pepla text-slateGrey"
                        style={{ backgroundColor: "var(--color-background-secondary)" }}
                        aria-hidden
                      >
                        {rowInitials(row)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-body text-lg text-slateGrey">
                            {[row.firstName, row.lastName].filter(Boolean).join(" ") || row.customerName}
                          </div>
                          {currentTab === "accepted" && row.proposal && (
                            <span className="font-display text-[10px] uppercase tracking-pepla text-[#8a6b47]">
                              Proposal sent
                            </span>
                          )}
                        </div>
                        <div className="mt-1 font-body text-sm text-slateGrey/70">{shortVision(row.vision)}</div>
                        <div className="mt-2 font-body text-xs uppercase tracking-[0.08em] text-slateGrey/55">{formatAvailability(row)}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                        <div className="font-body text-xs text-slateGrey/65">{formatShortDate(row.createdAt)}</div>
                        {badge === "NEW" && (
                          <span className="rounded px-2 py-0.5 font-display text-[10px] font-medium tracking-pepla text-[#F2EFE9]" style={{ backgroundColor: "#7C1618" }}>
                            NEW
                          </span>
                        )}
                        {badge === "PENDING" && (
                          <span
                            className="rounded px-2 py-0.5 font-display text-[10px] font-medium tracking-pepla text-slateGrey/65"
                            style={{ backgroundColor: "var(--color-background-secondary)" }}
                          >
                            PENDING
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <p className="mt-3 font-body text-[12px] leading-snug text-slateGrey/50">{summaryText}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

