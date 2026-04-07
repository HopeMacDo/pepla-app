import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  defaultAnswersForBlocks,
  FormRespondentView,
  validateRespondentAnswers
} from "../components/FormRespondentView";
import { appendFormSubmission } from "../lib/formSubmissions";
import { deserializeBlocks, getSavedForm, type FormBlock, type QuestionBlock } from "../lib/savedForms";
import { Button } from "../ui/primitives";

function optionLabel(opt: string, i: number) {
  const t = opt.trim();
  return t || `Option ${i + 1}`;
}

function formatAnswerValue(block: QuestionBlock, v: unknown): string {
  switch (block.questionKind) {
    case "short_answer":
    case "long_answer":
    case "electronic_signature":
      return typeof v === "string" ? v : "—";
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
      return typeof v === "string" ? v : "—";
    case "time":
      return typeof v === "string" ? v : "—";
    case "multiple_choice_grid": {
      if (!v || typeof v !== "object") return "—";
      const g = v as Record<string, number>;
      return Object.entries(g)
        .map(([ri, ci]) => {
          const r = block.rowLabels[Number(ri)] ?? `Row ${Number(ri) + 1}`;
          const c = block.colLabels[ci] ?? `Col ${ci + 1}`;
          return `${r}: ${c}`;
        })
        .join("; ") || "—";
    }
    case "checkbox_grid": {
      if (!v || typeof v !== "object") return "—";
      const g = v as Record<string, number[]>;
      return Object.entries(g)
        .flatMap(([ri, cols]) =>
          (cols ?? []).map((ci) => {
            const r = block.rowLabels[Number(ri)] ?? `Row ${Number(ri) + 1}`;
            const c = block.colLabels[ci] ?? `Col ${ci + 1}`;
            return `${r} × ${c}`;
          })
        )
        .join(", ") || "—";
    }
    default:
      return String(v ?? "—");
  }
}

export default function FormPreviewTab() {
  const { formId } = useParams<{ formId: string }>();
  const [blocks, setBlocks] = useState<FormBlock[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const reload = useCallback(() => {
    if (!formId) return;
    const saved = getSavedForm(formId);
    if (!saved) return;
    const next = deserializeBlocks(saved.blocks);
    setBlocks(next);
    setAnswers(defaultAnswersForBlocks(next));
    setSubmitMsg(null);
    setErrors([]);
  }, [formId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!formId) return null;

  const saved = getSavedForm(formId);
  if (!saved) return null;

  const onAnswerChange = (blockId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [blockId]: value }));
    setErrors([]);
    setSubmitMsg(null);
  };

  const onSubmit = () => {
    const e = validateRespondentAnswers(blocks, answers);
    if (e.length) {
      setErrors(e);
      return;
    }
    appendFormSubmission(formId, { ...answers });
    setAnswers(defaultAnswersForBlocks(blocks));
    setSubmitMsg("Submission recorded. Open the Submissions tab to review it.");
    setErrors([]);
  };

  return (
    <div className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <h2 className="font-display text-lg tracking-pepla text-slateGrey">Preview</h2>
        <p className="font-body text-sm text-slateGrey/70">
          This is how respondents see your form. Fill it in and submit to verify questions and capture a test submission
          (stored on this device).
        </p>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-xl border border-deepRed/25 bg-deepRed/5 px-4 py-3 font-body text-sm text-deepRed" role="alert">
          <p className="font-medium">Please fix the following:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {submitMsg ? (
        <p className="font-body text-sm text-slateGrey/80" role="status">
          {submitMsg}
        </p>
      ) : null}

      <FormRespondentView blocks={blocks} answers={answers} onAnswerChange={onAnswerChange} />

      <div className="flex flex-wrap items-center gap-3 border-t border-slateGrey/15 pt-6">
        <Button type="button" onClick={onSubmit}>
          Submit responses
        </Button>
        <button
          type="button"
          className="font-body text-sm text-slateGrey/70 underline decoration-slateGrey/35 underline-offset-4 transition hover:text-slateGrey"
          onClick={reload}
        >
          Reset preview
        </button>
      </div>

      <details className="rounded-xl border border-slateGrey/15 bg-white/40 px-4 py-3 font-body text-sm text-slateGrey/80">
        <summary className="cursor-pointer font-display text-[11px] uppercase tracking-pepla text-slateGrey/60">
          Snapshot of current answers (debug)
        </summary>
        <ul className="mt-3 space-y-2 border-t border-slateGrey/10 pt-3">
          {blocks
            .filter((b): b is QuestionBlock => b.kind === "question")
            .map((b) => (
              <li key={b.id}>
                <span className="font-medium text-slateGrey">{b.prompt.trim() || "Question"}:</span>{" "}
                {formatAnswerValue(b, answers[b.id])}
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}
