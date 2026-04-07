/** Test / preview form submissions (localStorage). */

export type FormSubmissionRecord = {
  id: string;
  formId: string;
  submittedAt: string;
  /** Block id → answer payload (JSON-serializable) */
  answers: Record<string, unknown>;
};

const STORAGE_KEY = "pepla-form-submissions-v1";

function readAll(): FormSubmissionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSubmissionShape);
  } catch {
    return [];
  }
}

function isSubmissionShape(x: unknown): x is FormSubmissionRecord {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.formId === "string" &&
    typeof o.submittedAt === "string" &&
    o.answers !== null &&
    typeof o.answers === "object"
  );
}

function writeAll(rows: FormSubmissionRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listSubmissionsForForm(formId: string): FormSubmissionRecord[] {
  return readAll()
    .filter((s) => s.formId === formId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export function appendFormSubmission(formId: string, answers: Record<string, unknown>): FormSubmissionRecord {
  const row: FormSubmissionRecord = {
    id: crypto.randomUUID(),
    formId,
    submittedAt: new Date().toISOString(),
    answers
  };
  const all = readAll();
  all.push(row);
  writeAll(all);
  return row;
}

export function deleteFormSubmission(submissionId: string) {
  writeAll(readAll().filter((s) => s.id !== submissionId));
}
