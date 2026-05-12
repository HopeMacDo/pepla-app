import type { IntakeAvailability } from "./models";
import { availabilitySegmentsForDay, type AvailabilityGridSegment } from "./calendarClientAvailability";
import type { BusinessHoursWeek } from "./businessHours";
import { businessHoursPolicyActive } from "./businessHours";

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

/** Open window for this calendar day from studio business hours (empty = closed that day). */
export function businessHoursSegmentsForDay(
  d: Date,
  week: BusinessHoursWeek,
  gridFirstHour: number,
  gridLastHour: number
): AvailabilityGridSegment[] {
  const cfg = week[d.getDay()];
  if (!cfg?.enabled) return [];
  const sh = Math.floor(cfg.startMin / 60);
  const sm = cfg.startMin % 60;
  const eh = Math.floor(cfg.endMin / 60);
  const em = cfg.endMin % 60;
  const seg = clipSegment(
    toGridMinute(sh, sm, gridFirstHour),
    toGridMinute(eh, em, gridFirstHour),
    gridFirstHour,
    gridLastHour
  );
  return seg ? [seg] : [];
}

export function fullGridAvailabilitySegment(
  gridFirstHour: number,
  gridLastHour: number
): AvailabilityGridSegment {
  return { startMinFromGrid: 0, endMinFromGrid: gridSpanMinutes(gridFirstHour, gridLastHour) };
}

function intersectTwo(
  a: AvailabilityGridSegment,
  b: AvailabilityGridSegment
): AvailabilityGridSegment | null {
  const s = Math.max(a.startMinFromGrid, b.startMinFromGrid);
  const e = Math.min(a.endMinFromGrid, b.endMinFromGrid);
  if (e - s < 1) return null;
  return { startMinFromGrid: s, endMinFromGrid: e };
}

export function intersectSegmentLists(
  a: AvailabilityGridSegment[],
  b: AvailabilityGridSegment[]
): AvailabilityGridSegment[] {
  const out: AvailabilityGridSegment[] = [];
  for (const x of a) {
    for (const y of b) {
      const z = intersectTwo(x, y);
      if (z) out.push(z);
    }
  }
  return out;
}

/**
 * Combined segments for **client-facing** constraints (public booking, intake grids, etc.):
 * business hours and client availability both narrow valid times when the business-hours policy is on.
 * `null` = no constraint. `[]` = no valid region that day.
 */
export function effectiveBookingSegmentsForDay(
  d: Date,
  clientOverlay: IntakeAvailability | null,
  businessWeek: BusinessHoursWeek,
  gridFirstHour: number,
  gridLastHour: number
): AvailabilityGridSegment[] | null {
  const policy = businessHoursPolicyActive(businessWeek);
  const clientSegs = clientOverlay
    ? availabilitySegmentsForDay(d, clientOverlay, gridFirstHour, gridLastHour)
    : null;

  if (!policy) {
    if (!clientOverlay) return null;
    if (!clientSegs?.length) return null;
    return clientSegs;
  }

  const bizSegs = businessHoursSegmentsForDay(d, businessWeek, gridFirstHour, gridLastHour);

  if (!clientOverlay) {
    return bizSegs.length > 0 ? bizSegs : [];
  }

  const pool =
    clientSegs && clientSegs.length > 0
      ? clientSegs
      : [fullGridAvailabilitySegment(gridFirstHour, gridLastHour)];

  return intersectSegmentLists(pool, bizSegs);
}

/**
 * Segments for **studio** week grids (internal calendar, booking-offer picker).
 * Business hours are a visual guide only — they do not restrict drags or studio actions.
 * When an intake client-availability overlay is present, drags still snap inside those preferred blocks.
 */
export function effectiveStudioBookingSegmentsForDay(
  d: Date,
  clientOverlay: IntakeAvailability | null,
  _businessWeek: BusinessHoursWeek,
  gridFirstHour: number,
  gridLastHour: number
): AvailabilityGridSegment[] | null {
  void _businessWeek;
  if (!clientOverlay) return null;
  const clientSegs = availabilitySegmentsForDay(d, clientOverlay, gridFirstHour, gridLastHour);
  if (!clientSegs?.length) return null;
  return clientSegs;
}

function segmentContaining(
  segments: AvailabilityGridSegment[],
  t: number
): AvailabilityGridSegment | null {
  return segments.find((s) => t >= s.startMinFromGrid && t < s.endMinFromGrid) ?? null;
}

export function bestSegmentConstrainedDragStart(
  segments: AvailabilityGridSegment[],
  offsetY: number,
  gridFirstHour: number,
  gridLastHour: number,
  slotMinutes: number,
  minDurationMins: number,
  startMinFromOffsetY: (y: number) => number
): number | null {
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

export function constrainedSegmentDragDurationMins(
  segments: AvailabilityGridSegment[],
  startMinFromGrid: number,
  pointerMinSnap: number,
  baseDurationMins: (start: number, pointer: number) => number
): number {
  if (segments.length === 0) return baseDurationMins(startMinFromGrid, pointerMinSnap);
  const seg = segmentContaining(segments, startMinFromGrid);
  if (!seg) return baseDurationMins(startMinFromGrid, pointerMinSnap);
  const maxDur = seg.endMinFromGrid - startMinFromGrid;
  return Math.min(baseDurationMins(startMinFromGrid, pointerMinSnap), maxDur);
}

export function segmentListOverlayRects(
  segments: AvailabilityGridSegment[],
  pxPerHour: number
): { top: number; height: number }[] {
  return segments.map((s) => ({
    top: (s.startMinFromGrid / 60) * pxPerHour,
    height: Math.max(((s.endMinFromGrid - s.startMinFromGrid) / 60) * pxPerHour, 6)
  }));
}

/** Grid segments for time *outside* `openWithinGrid` (dimmed “closed” overlays; open windows stay clear). */
export function complementGridSegments(
  openWithinGrid: AvailabilityGridSegment[],
  gridFirstHour: number,
  gridLastHour: number
): AvailabilityGridSegment[] {
  const max = gridSpanMinutes(gridFirstHour, gridLastHour);
  if (openWithinGrid.length === 0) {
    return [{ startMinFromGrid: 0, endMinFromGrid: max }];
  }
  const sorted = [...openWithinGrid].sort((a, b) => a.startMinFromGrid - b.startMinFromGrid);
  const out: AvailabilityGridSegment[] = [];
  let cursor = 0;
  for (const s of sorted) {
    const lo = Math.max(0, s.startMinFromGrid);
    const hi = Math.min(max, s.endMinFromGrid);
    if (lo > cursor) {
      out.push({ startMinFromGrid: cursor, endMinFromGrid: lo });
    }
    cursor = Math.max(cursor, hi);
    if (cursor >= max) break;
  }
  if (cursor < max) {
    out.push({ startMinFromGrid: cursor, endMinFromGrid: max });
  }
  return out.filter((x) => x.endMinFromGrid - x.startMinFromGrid >= 1);
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function slotBlockFitsEffectiveBookingSegments(
  startISO: string,
  durationMins: number,
  segments: AvailabilityGridSegment[] | null,
  gridFirstHour: number
): boolean {
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + durationMins * 60 * 1000);
  if (!sameLocalDay(start, end)) return false;

  if (segments === null) return true;
  if (segments.length === 0) return false;

  const startMin = toGridMinute(start.getHours(), start.getMinutes(), gridFirstHour);
  const endMin = toGridMinute(end.getHours(), end.getMinutes(), gridFirstHour);

  const seg = segmentContaining(segments, startMin);
  if (!seg) return false;
  return startMin >= seg.startMinFromGrid && endMin <= seg.endMinFromGrid && endMin > startMin;
}
