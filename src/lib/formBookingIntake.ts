import type { IntakeAvailability, IntakeRequest } from "./models";
import { effectiveAvailabilityGridLayout } from "./formGridAvailabilityLayout";
import type { FormBlock, QuestionBlock, IntakeDayKey } from "./savedForms";

function emptyAvailability(): IntakeAvailability {
  return {
    mornings: { tue: false, wed: false, thu: false, fri: false, sat: false },
    afternoons: { tue: false, wed: false, thu: false, fri: false, sat: false }
  };
}

export function parseGridCb(v: unknown): Record<string, number[]> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const out: Record<string, number[]> = {};
  for (const [k, val] of Object.entries(o)) {
    if (Array.isArray(val)) {
      out[k] = val.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    }
  }
  return out;
}

function formatAvailabilityString(sel: IntakeAvailability): string {
  const dayKeys: IntakeDayKey[] = ["tue", "wed", "thu", "fri", "sat"];
  const rows = [
    { key: "mornings" as const, label: "Mornings" },
    { key: "afternoons" as const, label: "Afternoons" }
  ];
  return rows
    .map((row) => {
      const picked = dayKeys.filter((day) => sel[row.key][day]).map((d) => d.toUpperCase());
      return `${row.label}: ${picked.length ? picked.join(", ") : "none"}`;
    })
    .join(" | ");
}

function availabilityFromCheckboxGrid(block: QuestionBlock, value: unknown): IntakeAvailability {
  const g = parseGridCb(value);
  const { colDayKeys, rowLabels } = effectiveAvailabilityGridLayout(block);
  const out = emptyAvailability();
  const slotForRow = (ri: number): "mornings" | "afternoons" => {
    const label = (rowLabels[ri] ?? "").toLowerCase();
    if (label.includes("afternoon")) return "afternoons";
    return "mornings";
  };
  for (let ri = 0; ri < rowLabels.length; ri++) {
    const slot = slotForRow(ri);
    const cols = g[String(ri)] ?? [];
    for (const ci of cols) {
      const day = colDayKeys[ci];
      if (day && (day === "tue" || day === "wed" || day === "thu" || day === "fri" || day === "sat")) {
        out[slot][day] = true;
      }
    }
  }
  return out;
}

/** Map saved form answers to an inbox intake row (demo: local IndexedDB). */
export function mapFormAnswersToIntakeRequest(blocks: FormBlock[], answers: Record<string, unknown>): IntakeRequest {
  let firstName = "";
  let lastName = "";
  let phone = "";
  let message = "";
  let availability: IntakeAvailability | null = null;

  for (const b of blocks) {
    if (b.kind !== "question") continue;
    const v = answers[b.id];
    const fk = b.fieldKey;
    if (fk === "firstName" && typeof v === "string") firstName = v.trim();
    else if (fk === "lastName" && typeof v === "string") lastName = v.trim();
    else if (fk === "phone" && typeof v === "string") phone = v.trim();
    else if (fk === "message" && typeof v === "string") message = v.trim();
    else if (fk === "availability" && b.questionKind === "checkbox_grid") {
      availability = availabilityFromCheckboxGrid(b, v);
    }
  }

  const sel = availability ?? emptyAvailability();
  const customerName = `${firstName} ${lastName}`.trim() || "Client";
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    customerName,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phoneNumber: phone || "—",
    vision: message || "—",
    availability: formatAvailabilityString(sel),
    availabilitySelections: sel,
    photoDataUrls: [],
    status: "requests",
    messages: [],
    slots: []
  };
}
