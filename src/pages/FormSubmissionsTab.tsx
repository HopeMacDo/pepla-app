import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { deleteFormSubmission, listSubmissionsForForm, type FormSubmissionRecord } from "../lib/formSubmissions";
import { deserializeBlocks, getSavedForm, type FormBlock, type QuestionBlock } from "../lib/savedForms";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}

function optionLabel(opt: string, i: number) {
  const t = opt.trim();
  return t || `Option ${i + 1}`;
}

function formatStoredAnswer(block: QuestionBlock, v: unknown): string {
  switch (block.questionKind) {
    case "short_answer":
    case "long_answer":
    case "electronic_signature":
      return typeof v === "string" ? v || "—" : "—";
    case "multiple_choice":
    case "dropdown":
      if (typeof v !== "number" || v < 0) return "—";
      return optionLabel(block.options[v] ?? "", v);
    case "checkboxes":
      if (!Array.isArray(v)) return "—";
      return (v as number[])
        .map((i) => optionLabel(block.options[i] ?? "", i))
        .join(", ") || "—";
    case "file_upload": {
      const m = v as { name?: string } | null;
      return m?.name ?? "—";
    }
    case "date":
    case "time":
      return typeof v === "string" ? v : "—";
    case "multiple_choice_grid":
    case "checkbox_grid":
      return typeof v === "object" && v !== null ? JSON.stringify(v) : "—";
    default:
      return v === undefined || v === null ? "—" : String(v);
  }
}

export default function FormSubmissionsTab() {
  const { formId } = useParams<{ formId: string }>();
  const [subs, setSubs] = useState<FormSubmissionRecord[]>(() =>
    formId ? listSubmissionsForForm(formId) : []
  );

  const saved = formId ? getSavedForm(formId) : undefined;
  const blocks = useMemo(() => (saved ? deserializeBlocks(saved.blocks) : []), [saved]);
  const questions = useMemo(() => blocks.filter((b): b is QuestionBlock => b.kind === "question"), [blocks]);

  const refresh = () => {
    if (formId) setSubs(listSubmissionsForForm(formId));
  };

  if (!formId || !saved) return null;

  return (
    <div className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <h2 className="font-display text-lg tracking-pepla text-slateGrey">Submissions</h2>
        <p className="font-body text-sm text-slateGrey/70">
          Responses saved from the Preview tab on this device. This is a local preview store until a backend is connected.
        </p>
      </div>

      {subs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slateGrey/25 bg-white/30 px-4 py-8 text-center font-body text-sm text-slateGrey/55">
          No submissions yet. Use <strong className="font-medium text-slateGrey/75">Preview</strong> and submit the form to
          record one.
        </p>
      ) : (
        <ul className="space-y-4">
          {subs.map((s) => (
            <li key={s.id}>
              <SubmissionCard
                submission={s}
                questions={questions}
                onDelete={() => {
                  deleteFormSubmission(s.id);
                  refresh();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmissionCard({
  submission,
  questions,
  onDelete
}: {
  submission: FormSubmissionRecord;
  questions: QuestionBlock[];
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-slateGrey/15 bg-white/50 shadow-pepla">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-body transition hover:bg-slateGrey/5"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="font-body text-sm text-slateGrey">{formatWhen(submission.submittedAt)}</span>
        <span className="shrink-0 font-display text-[10px] uppercase tracking-pepla text-slateGrey/50">
          {open ? "Hide" : "View"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-slateGrey/10 px-4 py-4">
          <dl className="space-y-3">
            {questions.map((q) => (
              <div key={q.id}>
                <dt className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/50">
                  {q.prompt.trim() || "Question"}
                </dt>
                <dd className="mt-1 font-body text-sm text-slateGrey">{formatStoredAnswer(q, submission.answers[q.id])}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className="mt-4 font-body text-sm text-deepRed underline decoration-deepRed/35 underline-offset-4 transition hover:decoration-deepRed/60"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            Delete submission
          </button>
        </div>
      ) : null}
    </div>
  );
}
