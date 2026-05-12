import { businessHoursPolicyActive, loadBusinessHoursWeek } from "./businessHours";
import type { QuestionBlock, IntakeDayKey } from "./savedForms";

const INTAKE_COLUMNS: { key: IntakeDayKey; label: string; dow: number }[] = [
  { key: "tue", label: "Tue", dow: 2 },
  { key: "wed", label: "Wed", dow: 3 },
  { key: "thu", label: "Thu", dow: 4 },
  { key: "fri", label: "Fri", dow: 5 },
  { key: "sat", label: "Sat", dow: 6 }
];

const FALLBACK_KEYS: IntakeDayKey[] = ["tue", "wed", "thu", "fri", "sat"];

export type AvailabilityGridLayout = {
  colLabels: string[];
  colDayKeys: IntakeDayKey[];
  rowLabels: string[];
};

function normalizeColumnDayKeys(block: Pick<QuestionBlock, "colLabels" | "gridColumnDayKeys">): IntakeDayKey[] {
  const n = block.colLabels.length;
  const keys = block.gridColumnDayKeys;
  if (!keys?.length) return FALLBACK_KEYS.slice(0, Math.min(n, FALLBACK_KEYS.length));
  return block.colLabels.map((_, i) => {
    const k = keys[i];
    if (k === "tue" || k === "wed" || k === "thu" || k === "fri" || k === "sat") return k;
    return FALLBACK_KEYS[Math.min(i, FALLBACK_KEYS.length - 1)]!;
  });
}

/** Runtime column/day layout for availability-style grids (Tue–Sat + optional business-hours filter). */
export function effectiveAvailabilityGridLayout(
  block: Pick<QuestionBlock, "questionKind" | "colLabels" | "rowLabels" | "gridSyncBusinessHours" | "gridColumnDayKeys">
): AvailabilityGridLayout {
  const rowLabels = [...block.rowLabels];
  const isGrid = block.questionKind === "checkbox_grid" || block.questionKind === "multiple_choice_grid";
  if (!isGrid) {
    return { colLabels: [...block.colLabels], colDayKeys: normalizeColumnDayKeys(block), rowLabels };
  }

  if (!block.gridSyncBusinessHours || !businessHoursPolicyActive(loadBusinessHoursWeek())) {
    return { colLabels: [...block.colLabels], colDayKeys: normalizeColumnDayKeys(block), rowLabels };
  }

  const week = loadBusinessHoursWeek();
  const colLabels: string[] = [];
  const colDayKeys: IntakeDayKey[] = [];
  for (const c of INTAKE_COLUMNS) {
    if (week[c.dow]?.enabled) {
      colLabels.push(c.label);
      colDayKeys.push(c.key);
    }
  }
  if (colLabels.length === 0) {
    return {
      colLabels: INTAKE_COLUMNS.map((x) => x.label),
      colDayKeys: INTAKE_COLUMNS.map((x) => x.key),
      rowLabels
    };
  }
  return { colLabels, colDayKeys, rowLabels };
}
