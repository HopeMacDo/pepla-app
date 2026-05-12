import type { IntakeAvailability } from "./models";

/** Mornings / afternoons on the intake form map to these local-time windows (calendar grid overlay). */
const MORNING_START_HOUR = 9;
const MORNING_END_HOUR = 12;
const AFTERNOON_START_HOUR = 12;
const AFTERNOON_END_HOUR = 17;

export type AvailabilityGridSegment = { startMinFromGrid: number; endMinFromGrid: number };

function jsDayToIntakeDayKey(d: Date): keyof IntakeAvailability["mornings"] | null {
  const dow = d.getDay();
  if (dow === 2) return "tue";
  if (dow === 3) return "wed";
  if (dow === 4) return "thu";
  if (dow === 5) return "fri";
  if (dow === 6) return "sat";
  return null;
}

function toGridMinute(hour: number, minute: number, gridFirstHour: number) {
  return hour * 60 + minute - gridFirstHour * 60;
}

function gridSpanMinutes(gridFirstHour: number, gridLastHour: number) {
  return (gridLastHour - gridFirstHour + 1) * 60;
}

function clipSegment(
  start: number,
  end: number,
  gridFirstHour: number,
  gridLastHour: number
): AvailabilityGridSegment | null {
  const max = gridSpanMinutes(gridFirstHour, gridLastHour);
  const s = Math.max(0, start);
  const e = Math.min(max, end);
  if (e - s < 1) return null;
  return { startMinFromGrid: s, endMinFromGrid: e };
}

/** Half-open segments [start, end) in minutes from `gridFirstHour` (same coordinates as `CalendarStep` week grid). */
export function availabilitySegmentsForDay(
  d: Date,
  selections: IntakeAvailability,
  gridFirstHour: number,
  gridLastHour: number
): AvailabilityGridSegment[] {
  const key = jsDayToIntakeDayKey(d);
  if (!key) return [];

  const out: AvailabilityGridSegment[] = [];
  if (selections.mornings[key]) {
    const seg = clipSegment(
      toGridMinute(MORNING_START_HOUR, 0, gridFirstHour),
      toGridMinute(MORNING_END_HOUR, 0, gridFirstHour),
      gridFirstHour,
      gridLastHour
    );
    if (seg) out.push(seg);
  }
  if (selections.afternoons[key]) {
    const seg = clipSegment(
      toGridMinute(AFTERNOON_START_HOUR, 0, gridFirstHour),
      toGridMinute(AFTERNOON_END_HOUR, 0, gridFirstHour),
      gridFirstHour,
      gridLastHour
    );
    if (seg) out.push(seg);
  }
  return out;
}

function segmentContaining(
  segments: AvailabilityGridSegment[],
  t: number
): AvailabilityGridSegment | null {
  return segments.find((s) => t >= s.startMinFromGrid && t < s.endMinFromGrid) ?? null;
}

/** 15-minute aligned start for a drag, inside client availability (or null = use default calendar behavior). */
export function bestAvailabilityConstrainedDragStart(
  d: Date,
  selections: IntakeAvailability,
  offsetY: number,
  gridFirstHour: number,
  gridLastHour: number,
  slotMinutes: number,
  minDurationMins: number,
  startMinFromOffsetY: (y: number) => number
): number | null {
  const segments = availabilitySegmentsForDay(d, selections, gridFirstHour, gridLastHour);
  if (segments.length === 0) return null;

  const cursor = startMinFromOffsetY(offsetY);
  let best: { start: number; dist: number } | null = null;

  for (const seg of segments) {
    const span = seg.endMinFromGrid - seg.startMinFromGrid;
    if (span < minDurationMins) continue;
    const lo = seg.startMinFromGrid;
    const hi = seg.endMinFromGrid - minDurationMins;
    const step = slotMinutes;
    const snapped = Math.round(cursor / step) * step;
    const clamped = Math.max(lo, Math.min(hi, snapped));
    const dist = Math.abs(clamped - cursor);
    if (!best || dist < best.dist) best = { start: clamped, dist };
  }

  if (best) return best.start;

  for (const seg of segments) {
    const span = seg.endMinFromGrid - seg.startMinFromGrid;
    if (span >= minDurationMins) return seg.startMinFromGrid;
  }
  return segments[0]?.startMinFromGrid ?? null;
}

export function constrainedDragDurationMins(
  d: Date,
  selections: IntakeAvailability,
  gridFirstHour: number,
  gridLastHour: number,
  startMinFromGrid: number,
  pointerMinSnap: number,
  baseDurationMins: (start: number, pointer: number) => number
): number {
  const segments = availabilitySegmentsForDay(d, selections, gridFirstHour, gridLastHour);
  if (segments.length === 0) return baseDurationMins(startMinFromGrid, pointerMinSnap);
  const seg = segmentContaining(segments, startMinFromGrid);
  if (!seg) return baseDurationMins(startMinFromGrid, pointerMinSnap);
  const maxDur = seg.endMinFromGrid - startMinFromGrid;
  return Math.min(baseDurationMins(startMinFromGrid, pointerMinSnap), maxDur);
}

export function availabilityOverlayRectsForDay(
  d: Date,
  selections: IntakeAvailability,
  gridFirstHour: number,
  gridLastHour: number,
  pxPerHour: number
): { top: number; height: number }[] {
  return availabilitySegmentsForDay(d, selections, gridFirstHour, gridLastHour).map((s) => ({
    top: (s.startMinFromGrid / 60) * pxPerHour,
    height: ((s.endMinFromGrid - s.startMinFromGrid) / 60) * pxPerHour
  }));
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** True if the block lies fully inside one client availability segment on that day (or there is no segment that day). */
export function slotBlockFitsClientAvailability(
  startISO: string,
  durationMins: number,
  selections: IntakeAvailability,
  gridFirstHour: number,
  gridLastHour: number
): boolean {
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + durationMins * 60 * 1000);
  if (!sameLocalDay(start, end)) return false;

  const segments = availabilitySegmentsForDay(start, selections, gridFirstHour, gridLastHour);
  if (segments.length === 0) return true;

  const startMin = toGridMinute(start.getHours(), start.getMinutes(), gridFirstHour);
  const endMin = toGridMinute(end.getHours(), end.getMinutes(), gridFirstHour);

  const seg = segmentContaining(segments, startMin);
  if (!seg) return false;
  return startMin >= seg.startMinFromGrid && endMin <= seg.endMinFromGrid && endMin > startMin;
}
