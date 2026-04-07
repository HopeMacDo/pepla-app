import { useEffect, useId, useRef, useState } from "react";
import {
  businessHour12Options,
  inferMeridiemFromBusinessHours,
  parseHHMM,
  timeHHMMRoundedNow,
  type Meridiem
} from "../lib/businessTime";
import type { FormBlock, QuestionBlock } from "../lib/savedForms";
import { ScrollingMonthCalendarDialog } from "../ui/ScrollingMonthCalendarDialog";
import { Card, CardBody, Textarea } from "../ui/primitives";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
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

function optionLabel(opt: string, i: number) {
  const t = opt.trim();
  return t || `Option ${i + 1}`;
}

function parseGridMc(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(o)) {
    if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
  }
  return out;
}

function parseGridCb(v: unknown): Record<string, number[]> {
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

function RespondentDateField({
  valueIso,
  onChangeIso,
  inputId
}: {
  valueIso: string;
  onChangeIso: (iso: string) => void;
  inputId: string;
}) {
  const today = new Date();
  const d0 = dateFromISO(valueIso) ?? today;
  const [text, setText] = useState(() => formatMDY(d0));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dateFromISO(valueIso);
    if (d) setText(formatMDY(d));
  }, [valueIso]);

  const syncFromIso = (nextIso: string) => {
    onChangeIso(nextIso);
    const d = dateFromISO(nextIso);
    if (d) setText(formatMDY(d));
  };

  return (
    <div className="relative max-w-xs">
      <div className="flex items-end gap-2">
        <input
          id={inputId}
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
        selectedDate={d0}
        onClose={() => setOpen(false)}
        onSelectDay={(d) => {
          syncFromIso(isoFromDate(d));
          setOpen(false);
        }}
      />
    </div>
  );
}

function RespondentTimeField({
  value,
  onChange,
  inputId
}: {
  value: string;
  onChange: (s: string) => void;
  inputId: string;
}) {
  const initial24 = timeHHMMRoundedNow(15);
  const parsed = parseHHMM(initial24);
  const h24 = parsed?.hh ?? 11;
  const mm0 = parsed?.mm ?? 0;
  const h12Init = h24 % 12 || 12;
  const merInit: Meridiem = h24 >= 12 ? "PM" : "AM";
  const mmInit = mm0 - (mm0 % 15);

  const parsedInit = value.trim() ? parseTime12hDisplay(value) : null;
  const [hour12, setHour12] = useState(parsedInit?.hour12 ?? h12Init);
  const [minute, setMinute] = useState(parsedInit?.minute ?? mmInit);
  const [mer, setMer] = useState<Meridiem>(parsedInit?.mer ?? merInit);
  const [text, setText] = useState(() => (value.trim() ? value : formatTime12Display(h12Init, mmInit, merInit)));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parseTime12hDisplay(value);
    if (p) {
      setHour12(p.hour12);
      setMinute(p.minute);
      setMer(p.mer);
      setText(formatTime12Display(p.hour12, p.minute, p.mer));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const applySlot = (hour: number, min: number, mdx: Meridiem) => {
    setHour12(hour);
    setMinute(min);
    setMer(mdx);
    const s = formatTime12Display(hour, min, mdx);
    setText(s);
    onChange(s);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative max-w-xs">
      <div className="flex items-end border-b border-slateGrey/20 focus-within:border-slateGrey/45">
        <label htmlFor={inputId} className="sr-only">
          Time
        </label>
        <input
          id={inputId}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const p = parseTime12hDisplay(text);
            if (p) {
              setHour12(p.hour12);
              setMinute(p.minute);
              setMer(p.mer);
              const s = formatTime12Display(p.hour12, p.minute, p.mer);
              setText(s);
              onChange(s);
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
        >
          {TIME_SLOTS.map((slot) => {
            const label = formatTime12Display(slot.hour12, slot.minute, slot.mer);
            const active = slot.hour12 === hour12 && slot.minute === minute && slot.mer === mer;
            return (
              <button
                key={`${slot.hour12}-${slot.minute}-${slot.mer}`}
                type="button"
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
  );
}

function QuestionRespondent({
  block,
  value,
  onChange
}: {
  block: QuestionBlock;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const base = cx(
    "w-full border-0 border-b border-slateGrey/20 bg-transparent py-2 font-body text-sm text-slateGrey outline-none transition-colors",
    "placeholder:text-slateGrey/35 focus:border-slateGrey/45"
  );
  const id = useId();

  const prompt = block.prompt.trim() || "Question";

  const header = (
    <div className="space-y-1">
      <p className="font-body text-base text-slateGrey">{prompt}</p>
      {block.required ? (
        <p className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/45">Required</p>
      ) : null}
    </div>
  );

  switch (block.questionKind) {
    case "short_answer":
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-3 pt-5">
            {header}
            <input
              type="text"
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
              className={base}
              placeholder="Your answer"
              autoComplete="off"
            />
          </CardBody>
        </Card>
      );
    case "long_answer":
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-3 pt-5">
            {header}
            <Textarea
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Your answer"
              rows={4}
            />
          </CardBody>
        </Card>
      );
    case "multiple_choice": {
      const sel = typeof value === "number" ? value : -1;
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-3 pt-5">
            {header}
            <ul className="space-y-2">
              {block.options.map((opt, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-center gap-3 font-body text-sm text-slateGrey">
                    <input
                      type="radio"
                      name={`q-${block.id}`}
                      checked={sel === i}
                      onChange={() => onChange(i)}
                      className="h-4 w-4 shrink-0 border-slateGrey/35 text-slateGrey accent-slateGrey"
                    />
                    <span>{optionLabel(opt, i)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      );
    }
    case "checkboxes": {
      const max = block.checkboxMaxSelections ?? block.options.length;
      const arr = Array.isArray(value) ? (value as number[]).filter((x) => Number.isFinite(x)) : [];
      const set = new Set(arr);
      const toggle = (i: number) => {
        const next = new Set(set);
        if (next.has(i)) next.delete(i);
        else if (next.size < max) next.add(i);
        onChange([...next].sort((a, b) => a - b));
      };
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-3 pt-5">
            {header}
            {max < block.options.length ? (
              <p className="font-body text-xs text-slateGrey/55">Select up to {max}</p>
            ) : null}
            <ul className="space-y-2">
              {block.options.map((opt, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-center gap-3 font-body text-sm text-slateGrey">
                    <input
                      type="checkbox"
                      checked={set.has(i)}
                      disabled={!set.has(i) && set.size >= max}
                      onChange={() => toggle(i)}
                      className="h-4 w-4 shrink-0 rounded border-slateGrey/35 accent-slateGrey"
                    />
                    <span>{optionLabel(opt, i)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      );
    }
    case "dropdown": {
      const sel = typeof value === "number" ? value : -1;
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-3 pt-5">
            {header}
            <div className="relative max-w-md">
              <select
                className={cx(
                  "w-full cursor-pointer appearance-none border-0 border-b border-slateGrey/20 bg-transparent py-2 pr-8 font-body text-sm text-slateGrey outline-none",
                  "focus:border-slateGrey/45"
                )}
                value={sel >= 0 ? sel : ""}
                onChange={(e) => onChange(e.target.value === "" ? -1 : Number(e.target.value))}
              >
                <option value="">Choose…</option>
                {block.options.map((opt, i) => (
                  <option key={i} value={i}>
                    {optionLabel(opt, i)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute bottom-2.5 right-0 text-slateGrey/50" aria-hidden>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </span>
            </div>
          </CardBody>
        </Card>
      );
    }
    case "file_upload": {
      const meta = value as { name?: string } | undefined;
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-3 pt-5">
            {header}
            <input
              type="file"
              className="font-body text-sm text-slateGrey/80 file:mr-3 file:rounded-lg file:border file:border-slateGrey/20 file:bg-white/60 file:px-3 file:py-1.5 file:font-display file:text-[10px] file:uppercase file:tracking-pepla"
              onChange={(e) => {
                const f = e.target.files?.[0];
                onChange(f ? { name: f.name, size: f.size } : null);
              }}
            />
            {meta?.name ? <p className="font-body text-xs text-slateGrey/60">Selected: {meta.name}</p> : null}
          </CardBody>
        </Card>
      );
    }
    case "multiple_choice_grid": {
      const g = parseGridMc(value);
      const setCol = (row: number, col: number) => {
        onChange({ ...g, [String(row)]: col });
      };
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-4 pt-5">
            {header}
            <p className="font-body text-sm text-slateGrey/65">Choose one column per row.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[16rem] border-collapse text-left font-body text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slateGrey/15 pb-2 pr-2 font-display text-[10px] uppercase tracking-pepla text-slateGrey/50" />
                    {block.colLabels.map((c, ci) => (
                      <th
                        key={ci}
                        className="border-b border-slateGrey/15 px-1 pb-2 text-center font-body text-xs font-normal text-slateGrey"
                      >
                        {c.trim() || `Column ${ci + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rowLabels.map((row, ri) => (
                    <tr key={ri}>
                      <td className="border-b border-slateGrey/10 py-2 pr-2 align-middle font-body text-sm text-slateGrey">
                        {row.trim() || `Row ${ri + 1}`}
                      </td>
                      {block.colLabels.map((_, ci) => (
                        <td key={ci} className="border-b border-slateGrey/10 px-1 py-2 text-center align-middle">
                          <input
                            type="radio"
                            name={`grid-mc-${block.id}-r${ri}`}
                            checked={g[String(ri)] === ci}
                            onChange={() => setCol(ri, ci)}
                            className="h-4 w-4 border-slateGrey/35 accent-slateGrey"
                            aria-label={`${row} — ${block.colLabels[ci]}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      );
    }
    case "checkbox_grid": {
      const g = parseGridCb(value);
      const toggle = (row: number, col: number) => {
        const key = String(row);
        const cur = new Set(g[key] ?? []);
        if (cur.has(col)) cur.delete(col);
        else cur.add(col);
        onChange({ ...g, [key]: [...cur].sort((a, b) => a - b) });
      };
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-4 pt-5">
            {header}
            <p className="font-body text-sm text-slateGrey/65">You may select multiple columns per row.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[16rem] border-collapse text-left font-body text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slateGrey/15 pb-2 pr-2 font-display text-[10px] uppercase tracking-pepla text-slateGrey/50" />
                    {block.colLabels.map((c, ci) => (
                      <th
                        key={ci}
                        className="border-b border-slateGrey/15 px-1 pb-2 text-center font-body text-xs font-normal text-slateGrey"
                      >
                        {c.trim() || `Column ${ci + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rowLabels.map((row, ri) => (
                    <tr key={ri}>
                      <td className="border-b border-slateGrey/10 py-2 pr-2 align-middle font-body text-sm text-slateGrey">
                        {row.trim() || `Row ${ri + 1}`}
                      </td>
                      {block.colLabels.map((_, ci) => (
                        <td key={ci} className="border-b border-slateGrey/10 px-1 py-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={(g[String(ri)] ?? []).includes(ci)}
                            onChange={() => toggle(ri, ci)}
                            className="h-4 w-4 rounded border-slateGrey/35 accent-slateGrey"
                            aria-label={`${row} — ${block.colLabels[ci]}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      );
    }
    case "date": {
      const iso = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : isoFromDate(new Date());
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-3 pt-5">
            {header}
            <RespondentDateField valueIso={iso} onChangeIso={(next) => onChange(next)} inputId={`${id}-date`} />
          </CardBody>
        </Card>
      );
    }
    case "time": {
      const s = typeof value === "string" ? value : formatTime12Display(9, 0, "AM");
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-3 pt-5">
            {header}
            <RespondentTimeField value={s} onChange={onChange} inputId={`${id}-time`} />
          </CardBody>
        </Card>
      );
    }
    case "electronic_signature":
      return (
        <Card className="min-w-0 border-l-[3px] border-l-slateGrey/20">
          <CardBody className="space-y-3 pt-5">
            {header}
            <input
              type="text"
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
              className={cx(base, "font-['Times_New_Roman',Times,serif] text-lg italic")}
              placeholder="Type your full name"
              autoComplete="name"
            />
          </CardBody>
        </Card>
      );
    default:
      return null;
  }
}

export function validateRespondentAnswers(blocks: FormBlock[], answers: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const b of blocks) {
    if (b.kind !== "question" || !b.required) continue;
    const label = b.prompt.trim() || "A question";
    const v = answers[b.id];
    switch (b.questionKind) {
      case "short_answer":
      case "long_answer":
      case "electronic_signature":
        if (typeof v !== "string" || !v.trim()) errors.push(`${label}: an answer is required.`);
        break;
      case "multiple_choice":
        if (typeof v !== "number" || v < 0 || v >= b.options.length) errors.push(`${label}: choose an option.`);
        break;
      case "checkboxes": {
        if (!Array.isArray(v) || v.length === 0) errors.push(`${label}: select at least one option.`);
        break;
      }
      case "dropdown":
        if (typeof v !== "number" || v < 0 || v >= b.options.length) errors.push(`${label}: choose from the list.`);
        break;
      case "file_upload": {
        const m = v as { name?: string } | null;
        if (!m || typeof m !== "object" || !m.name) errors.push(`${label}: upload a file.`);
        break;
      }
      case "date":
        if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push(`${label}: enter a date.`);
        break;
      case "time":
        if (typeof v !== "string" || !parseTime12hDisplay(v)) errors.push(`${label}: enter a valid time.`);
        break;
      case "multiple_choice_grid": {
        const g = parseGridMc(v);
        if (b.gridRequireEachRow) {
          for (let ri = 0; ri < b.rowLabels.length; ri++) {
            const c = g[String(ri)];
            if (typeof c !== "number" || c < 0 || c >= b.colLabels.length) {
              errors.push(`${label}: answer each row.`);
              break;
            }
          }
        } else if (Object.keys(g).length === 0) {
          errors.push(`${label}: select at least one cell.`);
        }
        break;
      }
      case "checkbox_grid": {
        const g = parseGridCb(v);
        if (b.gridRequireEachRow) {
          for (let ri = 0; ri < b.rowLabels.length; ri++) {
            const cols = g[String(ri)];
            if (!cols || cols.length === 0) {
              errors.push(`${label}: answer each row.`);
              break;
            }
          }
        } else {
          const any = Object.values(g).some((arr) => arr.length > 0);
          if (!any) errors.push(`${label}: select at least one option.`);
        }
        break;
      }
      default:
        break;
    }
  }
  return errors;
}

export function defaultAnswersForBlocks(blocks: FormBlock[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const b of blocks) {
    if (b.kind !== "question") continue;
    switch (b.questionKind) {
      case "short_answer":
      case "long_answer":
      case "electronic_signature":
        out[b.id] = "";
        break;
      case "multiple_choice":
        out[b.id] = -1;
        break;
      case "checkboxes":
        out[b.id] = [];
        break;
      case "dropdown":
        out[b.id] = -1;
        break;
      case "file_upload":
        out[b.id] = null;
        break;
      case "multiple_choice_grid":
      case "checkbox_grid":
        out[b.id] = {};
        break;
      case "date":
        out[b.id] = isoFromDate(new Date());
        break;
      case "time":
        out[b.id] = formatTime12Display(9, 0, "AM");
        break;
      default:
        break;
    }
  }
  return out;
}

export function FormRespondentView({
  blocks,
  answers,
  onAnswerChange
}: {
  blocks: FormBlock[];
  answers: Record<string, unknown>;
  onAnswerChange: (blockId: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        if (block.kind === "title_desc") {
          return (
            <div key={block.id} className="space-y-2">
              {block.title.trim() ? (
                <h2 className="font-display text-xl tracking-pepla text-slateGrey sm:text-2xl">{block.title}</h2>
              ) : null}
              {block.description.trim() ? (
                <p className="max-w-2xl font-body text-sm leading-relaxed text-slateGrey/85">{block.description}</p>
              ) : null}
            </div>
          );
        }
        if (block.kind === "image") {
          return (
            <figure key={block.id} className="space-y-2">
              {block.src ? (
                <div className="overflow-hidden rounded-xl border border-slateGrey/15 bg-slateGrey/5">
                  <img src={block.src} alt="" className="max-h-72 w-full object-contain" />
                </div>
              ) : (
                <p className="font-body text-sm text-slateGrey/45">Image</p>
              )}
              {block.caption.trim() ? (
                <figcaption className="text-center font-body text-sm text-slateGrey/70">{block.caption}</figcaption>
              ) : null}
            </figure>
          );
        }
        return (
          <QuestionRespondent
            key={block.id}
            block={block}
            value={answers[block.id]}
            onChange={(v) => onAnswerChange(block.id, v)}
          />
        );
      })}
    </div>
  );
}
