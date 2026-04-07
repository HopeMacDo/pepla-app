import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import type { FormDetailOutletContext } from "./FormDetailPage";
import {
  businessHour12Options,
  inferMeridiemFromBusinessHours,
  parseHHMM,
  timeHHMMRoundedNow,
  type Meridiem
} from "../lib/businessTime";
import {
  DEFAULT_COLS,
  DEFAULT_OPTIONS,
  DEFAULT_ROWS,
  deserializeBlocks,
  getSavedForm,
  needsGrid,
  needsOptions,
  QUESTION_KINDS,
  revokeImageSrc,
  serializeBlocks,
  upsertSavedForm,
  type FormBlock,
  type ImageBlock,
  type QuestionBlock,
  type QuestionKind
} from "../lib/savedForms";
import { Button, Card, CardBody, CardHeader, Input, Label, Textarea } from "../ui/primitives";
import { ScrollingMonthCalendarDialog } from "../ui/ScrollingMonthCalendarDialog";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function newId() {
  return crypto.randomUUID();
}

function createDefaultQuestionBlock(): QuestionBlock {
  const options = DEFAULT_OPTIONS();
  return {
    id: newId(),
    kind: "question",
    questionKind: "short_answer",
    prompt: "",
    options,
    rowLabels: DEFAULT_ROWS(),
    colLabels: DEFAULT_COLS(),
    required: false,
    checkboxMaxSelections: undefined,
    gridRequireEachRow: undefined
  };
}

function BlockCardFooter({
  required,
  onRequiredChange,
  onRemove
}: {
  required: boolean;
  onRequiredChange: (v: boolean) => void;
  onRemove: () => void;
}) {
  const requiredId = useId();
  return (
    <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slateGrey/10 px-6 py-3">
      <label
        htmlFor={requiredId}
        className="flex cursor-pointer items-center gap-2 border-r border-slateGrey/15 pr-4 font-display text-[10px] uppercase tracking-pepla text-slateGrey/55"
      >
        <input
          id={requiredId}
          type="checkbox"
          checked={required}
          onChange={(e) => onRequiredChange(e.target.checked)}
          className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slateGrey/35 accent-slateGrey focus:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/25"
        />
        Required
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-deepRed transition hover:bg-deepRed/10 hover:opacity-90"
        aria-label="Remove block"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
          />
        </svg>
      </button>
    </div>
  );
}

function FormBuilderToolbar({
  onAddQuestion,
  onAddImage,
  onAddTitle
}: {
  onAddQuestion: () => void;
  onAddImage: () => void;
  onAddTitle: () => void;
}) {
  const toolBtn =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slateGrey/15 bg-white/70 text-slateGrey transition hover:border-slateGrey/30 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/20";

  return (
    <nav className="flex flex-row flex-wrap justify-start gap-2" aria-label="Add to form">
      <button type="button" className={toolBtn} onClick={onAddQuestion} aria-label="Add question" title="Add question">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      <button type="button" className={toolBtn} onClick={onAddImage} aria-label="Add image" title="Add image">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008H12V8.25Z"
          />
        </svg>
      </button>
      <button type="button" className={toolBtn} onClick={onAddTitle} aria-label="Add description" title="Add description">
        <span className="select-none font-body text-[15px] font-medium leading-none tracking-tight text-current" aria-hidden>
          <span className="text-[17px]">T</span>
          <span className="text-[11px] align-super opacity-80">t</span>
        </span>
      </button>
    </nav>
  );
}

function shouldShowAnswerHint(kind: QuestionKind) {
  return (
    kind !== "multiple_choice" &&
    kind !== "checkboxes" &&
    kind !== "dropdown" &&
    kind !== "multiple_choice_grid" &&
    kind !== "checkbox_grid" &&
    kind !== "date" &&
    kind !== "time"
  );
}

function answerHintForKind(kind: QuestionKind): string {
  switch (kind) {
    case "short_answer":
      return "Short answer text";
    case "long_answer":
      return "Long answer text";
    case "file_upload":
      return "Upload a file or image";
    case "electronic_signature":
      return "Type your name — it appears as your signature";
    default:
      return "Answer";
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatMDY(d: Date) {
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
}

function isoFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateFromISO(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

function parseMDY(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mo = Number(m[1]) - 1;
  const day = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 0 || mo > 11 || day < 1 || day > 31) return null;
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

/** Preview field for date questions (builder only; value not persisted on the block). */
function DateAnswerField() {
  const today = new Date();
  const [iso, setIso] = useState(() => isoFromDate(today));
  const [text, setText] = useState(() => formatMDY(today));
  const [open, setOpen] = useState(false);

  const selected = dateFromISO(iso) ?? today;

  const syncFromIso = (nextIso: string) => {
    setIso(nextIso);
    const d = dateFromISO(nextIso);
    if (d) setText(formatMDY(d));
  };

  return (
    <div className="relative max-w-xs">
      <p className="mb-1 font-display text-[10px] uppercase tracking-pepla text-slateGrey/45">Answer</p>
      <div className="flex items-end gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="mm/dd/yyyy"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const d = parseMDY(text);
            if (d) syncFromIso(isoFromDate(d));
          }}
          className={cx(
            "min-w-0 flex-1 border-0 border-b border-slateGrey/20 bg-transparent py-2 font-body text-sm text-slateGrey outline-none",
            "placeholder:text-slateGrey/35 focus:border-slateGrey/45"
          )}
          aria-label="Date mm/dd/yyyy"
        />
        <button
          type="button"
          className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slateGrey transition hover:bg-slateGrey/10"
          aria-label="Open calendar"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5"
            />
          </svg>
        </button>
      </div>
      <ScrollingMonthCalendarDialog
        open={open}
        selectedDate={selected}
        onClose={() => setOpen(false)}
        onSelectDay={(d) => {
          syncFromIso(isoFromDate(d));
          setOpen(false);
        }}
      />
    </div>
  );
}

function formatTime12Display(hour12: number, minute: number, mer: Meridiem) {
  return `${hour12}:${String(minute).padStart(2, "0")} ${mer}`;
}

function parseTime12hDisplay(s: string): { hour12: number; minute: number; mer: Meridiem } | null {
  let rest = s.trim();
  let mer: Meridiem | null = null;
  const u = rest.toUpperCase();
  if (/\bPM\b/.test(u)) {
    mer = "PM";
    rest = rest.replace(/\bpm\b/i, "").trim();
  } else if (/\bAM\b/.test(u)) {
    mer = "AM";
    rest = rest.replace(/\bam\b/i, "").trim();
  }
  const m = rest.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour12 = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour12) || !Number.isFinite(minute)) return null;
  if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
  const resolvedMer =
    mer ?? inferMeridiemFromBusinessHours(hour12) ?? (hour12 === 12 ? "PM" : "AM");
  return { hour12, minute, mer: resolvedMer };
}

const TIME_SLOTS: Array<{ hour12: number; minute: number; mer: Meridiem }> = businessHour12Options().flatMap((h) =>
  [0, 15, 30, 45].map((minute) => {
    const mer = inferMeridiemFromBusinessHours(h) ?? "AM";
    return { hour12: h, minute, mer };
  })
);

/** Preview field for time questions (builder only): one editable line + chevron time list. */
function TimeAnswerField() {
  const initial24 = timeHHMMRoundedNow(15);
  const parsed = parseHHMM(initial24);
  const h24 = parsed?.hh ?? 11;
  const mm = parsed?.mm ?? 0;
  const h12Init = h24 % 12 || 12;
  const merInit: Meridiem = h24 >= 12 ? "PM" : "AM";
  const mmInit = mm - (mm % 15);

  const [hour12, setHour12] = useState(h12Init);
  const [minute, setMinute] = useState(mmInit);
  const [mer, setMer] = useState<Meridiem>(merInit);
  const [text, setText] = useState(() => formatTime12Display(h12Init, mmInit, merInit));
  const [open, setOpen] = useState(false);
  const timeFieldRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (timeFieldRootRef.current && !timeFieldRootRef.current.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const applySlot = (hour: number, min: number, mdx: Meridiem) => {
    setHour12(hour);
    setMinute(min);
    setMer(mdx);
    setText(formatTime12Display(hour, min, mdx));
    setOpen(false);
  };

  return (
    <div className="max-w-md">
      <p className="mb-1 font-display text-[10px] uppercase tracking-pepla text-slateGrey/45">Answer</p>
      <div ref={timeFieldRootRef} className="relative max-w-xs">
        <div className="flex items-end border-b border-slateGrey/20 focus-within:border-slateGrey/45">
          <label htmlFor="form-editor-time-answer" className="sr-only">
            Time (hh:mm AM or PM)
          </label>
          <input
            id="form-editor-time-answer"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              const p = parseTime12hDisplay(text);
              if (p) {
                setHour12(p.hour12);
                setMinute(p.minute);
                setMer(p.mer);
                setText(formatTime12Display(p.hour12, p.minute, p.mer));
              } else {
                setText(formatTime12Display(hour12, minute, mer));
              }
            }}
            placeholder="hh:mm AM"
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 pr-1 font-body text-sm tabular-nums text-slateGrey outline-none placeholder:text-slateGrey/35"
          />
          <button
            type="button"
            className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slateGrey/60 transition hover:bg-slateGrey/10 hover:text-slateGrey"
            aria-label="Choose time from list"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
        {open ? (
          <div
            className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slateGrey/15 bg-chalk py-1 shadow-pepla"
            role="listbox"
            aria-label="Business hours"
          >
            {TIME_SLOTS.map((slot) => {
              const label = formatTime12Display(slot.hour12, slot.minute, slot.mer);
              const active =
                slot.hour12 === hour12 && slot.minute === minute && slot.mer === mer;
              return (
                <button
                  key={`${slot.hour12}-${slot.minute}-${slot.mer}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cx(
                    "flex w-full px-3 py-2 text-left font-body text-sm tabular-nums transition",
                    active ? "bg-slateGrey/10 text-slateGrey" : "text-slateGrey/90 hover:bg-slateGrey/5"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySlot(slot.hour12, slot.minute, slot.mer)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResponseTypeSelect({
  id,
  value,
  onChange
}: {
  id: string;
  value: QuestionKind;
  onChange: (kind: QuestionKind) => void;
}) {
  return (
    <div className="relative w-full sm:min-w-[11.5rem] sm:max-w-[14rem]">
      <select
        id={id}
        className={cx(
          "w-full cursor-pointer appearance-none border-0 border-b border-slateGrey/20 bg-transparent py-2 pr-7 font-body text-sm text-slateGrey outline-none transition-colors",
          "focus:border-slateGrey/45"
        )}
        value={value}
        onChange={(e) => onChange(e.target.value as QuestionKind)}
      >
        {QUESTION_KINDS.map((q) => (
          <option key={q.value} value={q.value}>
            {q.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute bottom-2.5 right-0 text-slateGrey/50" aria-hidden>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </span>
    </div>
  );
}

function SelectUpToControl({
  id,
  count,
  value,
  onChange
}: {
  id: string;
  count: number;
  value: number;
  onChange: (n: number) => void;
}) {
  if (count < 1) return null;
  const safe = Math.min(Math.max(1, value), count);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label htmlFor={id} className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/55">
        Select up to
      </label>
      <div className="relative w-[3.5rem] shrink-0">
        <select
          id={id}
          className={cx(
            "w-full cursor-pointer appearance-none border-0 border-b border-slateGrey/20 bg-transparent py-2 pr-5 font-body text-sm text-slateGrey outline-none transition-colors",
            "focus:border-slateGrey/45"
          )}
          value={safe}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute bottom-2.5 right-0 text-slateGrey/50" aria-hidden>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </div>
    </div>
  );
}

export default function FormEditorPage() {
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();
  const isNew = formId === "new";
  const outletCtx = useOutletContext<FormDetailOutletContext | null>();
  const embeddedInDetail = outletCtx?.embeddedInFormDetail === true;

  const [formName, setFormName] = useState("");
  const [blocks, setBlocks] = useState<FormBlock[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sendResponsesToInbox, setSendResponsesToInbox] = useState(false);

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  useEffect(() => {
    if (isNew) {
      setFormName("");
      setBlocks([createDefaultQuestionBlock()]);
      setSendResponsesToInbox(false);
      setLoadError(null);
      return;
    }
    if (!formId) return;
    const saved = getSavedForm(formId);
    if (!saved) {
      setLoadError("This form was not found.");
      setFormName("");
      setBlocks([]);
      return;
    }
    setLoadError(null);
    setFormName(saved.name);
    setSendResponsesToInbox(saved.sendResponsesToInbox === true);
    setBlocks(deserializeBlocks(saved.blocks));
  }, [formId, isNew]);

  useEffect(() => {
    return () => {
      blocksRef.current.forEach((b) => {
        if (b.kind === "image") revokeImageSrc(b.src);
      });
    };
  }, []);

  const addTitle = useCallback(() => {
    setBlocks((b) => [...b, { id: newId(), kind: "title_desc", title: "", description: "", required: false }]);
  }, []);

  const addImage = useCallback(() => {
    setBlocks((b) => [...b, { id: newId(), kind: "image", src: null, caption: "", required: false }]);
  }, []);

  const addQuestion = useCallback(() => {
    setBlocks((b) => [...b, createDefaultQuestionBlock()]);
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      const block = prev.find((x) => x.id === id);
      if (block?.kind === "image") revokeImageSrc(block.src);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<FormBlock>) => {
    setBlocks((prev) =>
      prev.map((x) => (x.id === id ? ({ ...x, ...patch } as FormBlock) : x))
    );
  }, []);

  const saveForm = useCallback(async () => {
    if (!formId) return;
    setSaveError(null);
    setSaveBusy(true);
    try {
      const id = isNew ? crypto.randomUUID() : formId;
      const name = formName.trim() || "Untitled form";
      const persistedBlocks = await serializeBlocks(blocks);
      const now = new Date().toISOString();
      const existing = isNew ? undefined : getSavedForm(formId);
      const createdAt = existing?.createdAt ?? now;
      upsertSavedForm({
        id,
        name,
        createdAt,
        updatedAt: now,
        blocks: persistedBlocks,
        sendResponsesToInbox
      });
      if (embeddedInDetail && !isNew && formId) {
        navigate(`/settings/forms/${formId}/preview`);
      } else {
        navigate("/settings/forms");
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save form.");
    } finally {
      setSaveBusy(false);
    }
  }, [blocks, embeddedInDetail, formId, formName, isNew, navigate, sendResponsesToInbox]);

  const formNameInputId = useId();
  const sendInboxCheckboxId = useId();

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slateGrey transition hover:bg-slateGrey/5"
            aria-label="Back to forms"
            onClick={() => navigate("/settings/forms")}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">Form</h1>
        </div>
        <p className="font-body text-sm text-deepRed">{loadError}</p>
      </div>
    );
  }

  return (
    <div className={embeddedInDetail ? "space-y-6" : "space-y-8"}>
      {embeddedInDetail ? (
        <div className="space-y-4">
          <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">Edit Form</h1>
          <div className="max-w-xl">
            <label htmlFor={formNameInputId} className="sr-only">
              Form Name
            </label>
            <input
              id={formNameInputId}
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Form Name"
              autoComplete="off"
              className={cx(
                "w-full border-0 border-b border-slateGrey/20 bg-transparent py-2 font-display text-lg tracking-pepla text-slateGrey outline-none transition-colors",
                "placeholder:font-display placeholder:text-slateGrey/40",
                "focus:border-slateGrey/45"
              )}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slateGrey transition hover:bg-slateGrey/5"
            aria-label="Back to forms"
            onClick={() => navigate("/settings/forms")}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 space-y-4">
            <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">
              {isNew ? "Create New Form" : "Edit Form"}
            </h1>
            <div className="max-w-xl">
              <label htmlFor={formNameInputId} className="sr-only">
                Form Name
              </label>
              <input
                id={formNameInputId}
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Form Name"
                autoComplete="off"
                className={cx(
                  "w-full border-0 border-b border-slateGrey/20 bg-transparent py-2 font-display text-lg tracking-pepla text-slateGrey outline-none transition-colors",
                  "placeholder:font-display placeholder:text-slateGrey/40",
                  "focus:border-slateGrey/45"
                )}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4">
        <ul className="space-y-4">
          {blocks.map((block) => (
            <li key={block.id}>
              <FormBlockEditor block={block} onRemove={() => removeBlock(block.id)} onChange={updateBlock} />
            </li>
          ))}
        </ul>

        {saveError ? <p className="font-body text-sm text-deepRed">{saveError}</p> : null}

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <div className="shrink-0 rounded-2xl border border-slateGrey/15 bg-white/55 p-2 shadow-pepla supports-[backdrop-filter]:backdrop-blur-sm">
            <FormBuilderToolbar onAddQuestion={addQuestion} onAddImage={addImage} onAddTitle={addTitle} />
          </div>
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-4">
            <label
              htmlFor={sendInboxCheckboxId}
              className="flex max-w-[min(100%,18rem)] cursor-pointer items-center gap-2 font-body text-sm text-slateGrey/90"
            >
              <input
                id={sendInboxCheckboxId}
                type="checkbox"
                checked={sendResponsesToInbox}
                onChange={(e) => setSendResponsesToInbox(e.target.checked)}
                className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slateGrey/35 accent-slateGrey focus:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/25"
              />
              Send responses to inbox requests
            </label>
            <Button type="button" disabled={saveBusy} onClick={() => void saveForm()}>
              {saveBusy ? "Saving…" : "Save form"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormBlockEditor({
  block,
  onRemove,
  onChange
}: {
  block: FormBlock;
  onRemove: () => void;
  onChange: (id: string, patch: Partial<FormBlock>) => void;
}) {
  if (block.kind === "title_desc") {
    return (
      <Card className="min-w-0">
        <CardHeader className="pb-0">
          <h2 className="font-display text-xs uppercase tracking-pepla text-slateGrey/70">Title & description</h2>
        </CardHeader>
        <CardBody className="space-y-3 pt-3">
          <div className="grid gap-2">
            <Label htmlFor={`t-${block.id}`}>Title</Label>
            <Input
              id={`t-${block.id}`}
              value={block.title}
              onChange={(e) => onChange(block.id, { title: e.target.value })}
              placeholder="Form title"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`d-${block.id}`}>Description</Label>
            <Textarea
              id={`d-${block.id}`}
              value={block.description}
              onChange={(e) => onChange(block.id, { description: e.target.value })}
              placeholder="Optional description shown under the title"
            />
          </div>
        </CardBody>
        <BlockCardFooter
          required={block.required}
          onRequiredChange={(v) => onChange(block.id, { required: v })}
          onRemove={onRemove}
        />
      </Card>
    );
  }

  if (block.kind === "image") {
    return <ImageBlockEditor block={block} onRemove={onRemove} onChange={onChange} />;
  }

  return <QuestionBlockEditor block={block} onRemove={onRemove} onChange={onChange} />;
}

function ImageBlockEditor({
  block,
  onRemove,
  onChange
}: {
  block: ImageBlock;
  onRemove: () => void;
  onChange: (id: string, patch: Partial<FormBlock>) => void;
}) {
  const inputId = useId();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const nextUrl = URL.createObjectURL(file);
    onChange(block.id, {
      src: nextUrl
    });
    revokeImageSrc(block.src);
    e.target.value = "";
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-0">
        <h2 className="font-display text-xs uppercase tracking-pepla text-slateGrey/70">Image</h2>
      </CardHeader>
      <CardBody className="space-y-3 pt-3">
        <div className="grid gap-2">
          <Label htmlFor={inputId}>Upload</Label>
          <input id={inputId} type="file" accept="image/*" onChange={onPick} className="font-body text-sm text-slateGrey/80 file:mr-3 file:rounded-lg file:border file:border-slateGrey/20 file:bg-white/60 file:px-3 file:py-1.5 file:font-display file:text-[10px] file:uppercase file:tracking-pepla" />
        </div>
        {block.src ? (
          <div className="overflow-hidden rounded-xl border border-slateGrey/15 bg-slateGrey/5">
            <img src={block.src} alt="" className="max-h-56 w-full object-contain" />
          </div>
        ) : (
          <p className="font-body text-sm text-slateGrey/45">No image selected.</p>
        )}
        <div className="grid gap-2">
          <Label htmlFor={`cap-${block.id}`}>Caption (optional)</Label>
          <Input
            id={`cap-${block.id}`}
            value={block.caption}
            onChange={(e) => onChange(block.id, { caption: e.target.value })}
            placeholder="Caption"
          />
        </div>
      </CardBody>
      <BlockCardFooter
        required={block.required}
        onRequiredChange={(v) => onChange(block.id, { required: v })}
        onRemove={onRemove}
      />
    </Card>
  );
}

function QuestionBlockEditor({
  block,
  onRemove,
  onChange
}: {
  block: QuestionBlock;
  onRemove: () => void;
  onChange: (id: string, patch: Partial<FormBlock>) => void;
}) {
  const typeSelectId = useId();
  const questionInputId = useId();
  const selectUpToId = useId();

  const setKind = (questionKind: QuestionKind) => {
    const patch: Partial<QuestionBlock> = { questionKind };
    if (needsOptions(questionKind)) {
      const nextOpts = block.options.length ? [...block.options] : [...DEFAULT_OPTIONS()];
      patch.options = nextOpts;
      if (questionKind === "checkboxes") {
        const n = nextOpts.length;
        patch.checkboxMaxSelections = Math.min(Math.max(1, block.checkboxMaxSelections ?? n), n);
      } else {
        patch.checkboxMaxSelections = undefined;
      }
    } else {
      patch.checkboxMaxSelections = undefined;
    }
    if (needsGrid(questionKind)) {
      patch.rowLabels = block.rowLabels.length ? [...block.rowLabels] : DEFAULT_ROWS();
      patch.colLabels = block.colLabels.length ? [...block.colLabels] : DEFAULT_COLS();
      patch.checkboxMaxSelections = undefined;
    } else {
      patch.gridRequireEachRow = undefined;
    }
    onChange(block.id, patch);
  };

  const setOption = (i: number, v: string) => {
    const options = [...block.options];
    options[i] = v;
    onChange(block.id, { options });
  };

  const addOption = () => {
    const newOptions = [...block.options, ""];
    const patch: Partial<QuestionBlock> = { options: newOptions };
    if (block.questionKind === "checkboxes") {
      patch.checkboxMaxSelections = newOptions.length;
    }
    onChange(block.id, patch);
  };

  const removeOption = (i: number) => {
    if (block.options.length <= 1) return;
    const newOptions = block.options.filter((_, j) => j !== i);
    const patch: Partial<QuestionBlock> = { options: newOptions };
    if (block.questionKind === "checkboxes") {
      const prevMax = block.checkboxMaxSelections ?? block.options.length;
      patch.checkboxMaxSelections = Math.min(Math.max(1, prevMax), newOptions.length);
    }
    onChange(block.id, patch);
  };

  const setRow = (i: number, v: string) => {
    const rowLabels = [...block.rowLabels];
    rowLabels[i] = v;
    onChange(block.id, { rowLabels });
  };
  const setCol = (i: number, v: string) => {
    const colLabels = [...block.colLabels];
    colLabels[i] = v;
    onChange(block.id, { colLabels });
  };
  const addRow = () => onChange(block.id, { rowLabels: [...block.rowLabels, `Row ${block.rowLabels.length + 1}`] });
  const addCol = () => onChange(block.id, { colLabels: [...block.colLabels, `Column ${block.colLabels.length + 1}`] });
  const removeRow = (i: number) => {
    if (block.rowLabels.length <= 1) return;
    onChange(block.id, { rowLabels: block.rowLabels.filter((_, j) => j !== i) });
  };
  const removeCol = (i: number) => {
    if (block.colLabels.length <= 1) return;
    onChange(block.id, { colLabels: block.colLabels.filter((_, j) => j !== i) });
  };

  return (
    <Card className="min-w-0 border-l-[3px] border-l-slateGrey/25">
      <CardBody className="space-y-5 pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
          <div className="shrink-0 sm:w-auto">
            <label htmlFor={typeSelectId} className="sr-only">
              Response type
            </label>
            <ResponseTypeSelect id={typeSelectId} value={block.questionKind} onChange={setKind} />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor={questionInputId} className="sr-only">
              Question
            </label>
            <input
              id={questionInputId}
              type="text"
              value={block.prompt}
              onChange={(e) => onChange(block.id, { prompt: e.target.value })}
              placeholder="Question"
              autoComplete="off"
              className={cx(
                "w-full border-0 border-b border-slateGrey/20 bg-transparent py-2 font-body text-base text-slateGrey outline-none transition-colors",
                "placeholder:text-slateGrey/40 focus:border-slateGrey/45"
              )}
            />
          </div>
        </div>

        {shouldShowAnswerHint(block.questionKind) ? (
          <p className="max-w-xl border-b border-dashed border-slateGrey/20 pb-2 font-body text-sm text-slateGrey/45">
            {answerHintForKind(block.questionKind)}
          </p>
        ) : null}

        {needsOptions(block.questionKind) && (
          <div className="space-y-3">
            <Label>Options</Label>
            <ul className="space-y-2">
              {block.options.map((opt, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className={cx(
                      "min-w-0 flex-1 border-0 border-b border-slateGrey/20 bg-transparent py-1.5 font-body text-sm text-slateGrey outline-none transition-colors",
                      "placeholder:text-slateGrey/35 focus:border-slateGrey/45"
                    )}
                  />
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-deepRed transition hover:bg-deepRed/10 disabled:pointer-events-none disabled:opacity-30"
                    onClick={() => removeOption(i)}
                    disabled={block.options.length <= 1}
                    aria-label={`Remove option ${i + 1}`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-6">
              <button
                type="button"
                className="bg-transparent px-0 py-1 font-display text-[11px] uppercase tracking-pepla text-slateGrey/70 underline decoration-slateGrey/35 underline-offset-4 outline-none transition hover:text-slateGrey hover:decoration-slateGrey/55"
                onClick={addOption}
              >
                Add option
              </button>
              {block.questionKind === "checkboxes" && block.options.length > 0 ? (
                <SelectUpToControl
                  id={selectUpToId}
                  count={block.options.length}
                  value={block.checkboxMaxSelections ?? block.options.length}
                  onChange={(n) => onChange(block.id, { checkboxMaxSelections: n })}
                />
              ) : null}
            </div>
          </div>
        )}

        {needsGrid(block.questionKind) && (
          <div className="space-y-4">
            <p className="font-body text-sm text-slateGrey/65">
              {block.questionKind === "multiple_choice_grid"
                ? "Respondents choose one column per row (a single answer in each row)."
                : "Respondents may select multiple columns in each row."}
            </p>
            <label className="flex cursor-pointer items-center gap-2 font-body text-sm text-slateGrey">
              <input
                type="checkbox"
                checked={block.gridRequireEachRow === true}
                onChange={(e) => onChange(block.id, { gridRequireEachRow: e.target.checked })}
                className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slateGrey/35 accent-slateGrey focus:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/25"
              />
              Require a response for each row
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Label>Rows</Label>
                <ul className="space-y-2">
                  {block.rowLabels.map((row, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row}
                        onChange={(e) => setRow(i, e.target.value)}
                        placeholder={`Row ${i + 1}`}
                        className={cx(
                          "min-w-0 flex-1 border-0 border-b border-slateGrey/20 bg-transparent py-1.5 font-body text-sm text-slateGrey outline-none transition-colors",
                          "placeholder:text-slateGrey/35 focus:border-slateGrey/45"
                        )}
                      />
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-deepRed transition hover:bg-deepRed/10 disabled:pointer-events-none disabled:opacity-30"
                        onClick={() => removeRow(i)}
                        disabled={block.rowLabels.length <= 1}
                        aria-label={`Remove row ${i + 1}`}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="bg-transparent px-0 py-1 font-display text-[11px] uppercase tracking-pepla text-slateGrey/70 underline decoration-slateGrey/35 underline-offset-4 outline-none transition hover:text-slateGrey hover:decoration-slateGrey/55"
                  onClick={addRow}
                >
                  Add row
                </button>
              </div>
              <div className="space-y-3">
                <Label>Columns</Label>
                <ul className="space-y-2">
                  {block.colLabels.map((col, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => setCol(i, e.target.value)}
                        placeholder={`Column ${i + 1}`}
                        className={cx(
                          "min-w-0 flex-1 border-0 border-b border-slateGrey/20 bg-transparent py-1.5 font-body text-sm text-slateGrey outline-none transition-colors",
                          "placeholder:text-slateGrey/35 focus:border-slateGrey/45"
                        )}
                      />
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-deepRed transition hover:bg-deepRed/10 disabled:pointer-events-none disabled:opacity-30"
                        onClick={() => removeCol(i)}
                        disabled={block.colLabels.length <= 1}
                        aria-label={`Remove column ${i + 1}`}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="bg-transparent px-0 py-1 font-display text-[11px] uppercase tracking-pepla text-slateGrey/70 underline decoration-slateGrey/35 underline-offset-4 outline-none transition hover:text-slateGrey hover:decoration-slateGrey/55"
                  onClick={addCol}
                >
                  Add column
                </button>
              </div>
            </div>
          </div>
        )}

        {block.questionKind === "date" ? <DateAnswerField /> : null}
        {block.questionKind === "time" ? <TimeAnswerField /> : null}
      </CardBody>
      <BlockCardFooter
        required={block.required}
        onRequiredChange={(v) => onChange(block.id, { required: v })}
        onRemove={onRemove}
      />
    </Card>
  );
}
