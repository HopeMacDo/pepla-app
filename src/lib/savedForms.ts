/** Client-side persisted custom forms (Settings → Forms). */

import { BOOKING_REQUEST_FORM_ID, createDefaultBookingRequestForm } from "./bookingRequestFormSeed";

export const QUESTION_KINDS = [
  { value: "short_answer", label: "Short answer" },
  { value: "long_answer", label: "Long answer" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "dropdown", label: "Drop down" },
  { value: "file_upload", label: "File / image upload" },
  { value: "multiple_choice_grid", label: "Multiple choice grid" },
  { value: "checkbox_grid", label: "Checkbox grid" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "electronic_signature", label: "Electronic signature" }
] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number]["value"];

export type TitleBlock = { id: string; kind: "title_desc"; title: string; description: string; required: boolean };

/** Runtime: `src` is blob: or data: URL for &lt;img&gt;. */
export type ImageBlock = { id: string; kind: "image"; src: string | null; caption: string; required: boolean };

export type IntakeDayKey = "tue" | "wed" | "thu" | "fri" | "sat";

export type FormIntakeFieldKey = "firstName" | "lastName" | "phone" | "message" | "availability";

export type QuestionBlock = {
  id: string;
  kind: "question";
  questionKind: QuestionKind;
  prompt: string;
  options: string[];
  rowLabels: string[];
  colLabels: string[];
  required: boolean;
  /** Checkboxes only: max number of options a respondent may select (1…options.length). */
  checkboxMaxSelections?: number;
  /**
   * Multiple choice grid / checkbox grid: when true, the respondent must answer every row
   * (in addition to the block-level Required setting, if any).
   */
  gridRequireEachRow?: boolean;
  /** Map answers into a booking intake (public booking form). */
  fieldKey?: FormIntakeFieldKey;
  /** Checkbox / MC grid: when true, Tue–Sat columns follow Settings → Bookings → Business Hours. */
  gridSyncBusinessHours?: boolean;
  /** Column index → intake weekday key (Tue–Sat). Used with availability grids. */
  gridColumnDayKeys?: IntakeDayKey[];
};

export type FormBlock = TitleBlock | ImageBlock | QuestionBlock;

export type PersistedImageBlock = { id: string; kind: "image"; dataUrl: string | null; caption: string; required?: boolean };

export type PersistedFormBlock = TitleBlock | PersistedImageBlock | QuestionBlock;

export type SavedForm = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  blocks: PersistedFormBlock[];
  /** When true, completed form submissions surface for inbox / requests (future wiring). */
  sendResponsesToInbox?: boolean;
};

export const DEFAULT_OPTIONS = () => ["", ""];
export const DEFAULT_ROWS = () => [""];
export const DEFAULT_COLS = () => ["", ""];

export function needsOptions(k: QuestionKind) {
  return k === "multiple_choice" || k === "checkboxes" || k === "dropdown";
}

export function needsGrid(k: QuestionKind) {
  return k === "multiple_choice_grid" || k === "checkbox_grid";
}

const STORAGE_KEY = "pepla-saved-forms-v1";

function ensureBookingRequestFormSeed() {
  const all = readAll();
  if (all.some((f) => f.id === BOOKING_REQUEST_FORM_ID)) return;
  writeAll([...all, createDefaultBookingRequestForm()]);
}

function readAll(): SavedForm[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedFormShape);
  } catch {
    return [];
  }
}

function isSavedFormShape(x: unknown): x is SavedForm {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.updatedAt === "string" &&
    Array.isArray(o.blocks)
  );
}

function writeAll(forms: SavedForm[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(forms));
}

export function listSavedForms(): SavedForm[] {
  ensureBookingRequestFormSeed();
  return readAll().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getSavedForm(id: string): SavedForm | undefined {
  ensureBookingRequestFormSeed();
  return readAll().find((f) => f.id === id);
}

export function upsertSavedForm(form: SavedForm) {
  const all = readAll();
  const i = all.findIndex((f) => f.id === form.id);
  if (i >= 0) all[i] = form;
  else all.push(form);
  writeAll(all);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function serializeBlocks(blocks: FormBlock[]): Promise<PersistedFormBlock[]> {
  const out: PersistedFormBlock[] = [];
  for (const b of blocks) {
    if (b.kind === "title_desc" || b.kind === "question") {
      out.push(b);
      continue;
    }
    if (!b.src) {
      out.push({ id: b.id, kind: "image", dataUrl: null, caption: b.caption, required: b.required });
      continue;
    }
    if (b.src.startsWith("data:")) {
      out.push({ id: b.id, kind: "image", dataUrl: b.src, caption: b.caption, required: b.required });
      continue;
    }
    const blob = await fetch(b.src).then((r) => r.blob());
    const dataUrl = await blobToDataUrl(blob);
    out.push({ id: b.id, kind: "image", dataUrl, caption: b.caption, required: b.required });
  }
  return out;
}

export function deserializeBlocks(blocks: PersistedFormBlock[]): FormBlock[] {
  return blocks.map((b): FormBlock => {
    if (b.kind === "image") {
      return {
        id: b.id,
        kind: "image",
        src: b.dataUrl,
        caption: b.caption,
        required: b.required === true
      };
    }
    if (b.kind === "title_desc") {
      const t = b as TitleBlock;
      return { ...t, required: t.required === true };
    }
    const q = b as QuestionBlock;
    const n = q.options.length;
    const rawMax = q.checkboxMaxSelections;
    const checkboxMaxSelections =
      q.questionKind === "checkboxes" && n > 0
        ? Math.min(Math.max(1, rawMax ?? n), n)
        : undefined;
    const gridRequireEachRow =
      (q.questionKind === "multiple_choice_grid" || q.questionKind === "checkbox_grid") && q.gridRequireEachRow === true
        ? true
        : undefined;
    const rawFk = (q as { fieldKey?: unknown }).fieldKey;
    const fieldKey =
      rawFk === "firstName" || rawFk === "lastName" || rawFk === "phone" || rawFk === "message" || rawFk === "availability"
        ? rawFk
        : undefined;
    const gridSyncBusinessHours = q.gridSyncBusinessHours === true ? true : undefined;
    const rawKeys = (q as { gridColumnDayKeys?: unknown }).gridColumnDayKeys;
    const gridColumnDayKeys =
      Array.isArray(rawKeys) && rawKeys.length > 0
        ? rawKeys.filter((x): x is IntakeDayKey =>
            x === "tue" || x === "wed" || x === "thu" || x === "fri" || x === "sat"
          )
        : undefined;
    return {
      ...q,
      required: q.required === true,
      checkboxMaxSelections,
      gridRequireEachRow,
      fieldKey,
      gridSyncBusinessHours,
      gridColumnDayKeys
    };
  });
}

export function revokeImageSrc(src: string | null | undefined) {
  if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
}
