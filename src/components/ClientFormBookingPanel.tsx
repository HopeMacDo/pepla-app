import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { BookingLink } from "../lib/models";
import { mapFormAnswersToIntakeRequest } from "../lib/formBookingIntake";
import { deserializeBlocks, type FormBlock, type PersistedFormBlock } from "../lib/savedForms";
import { putIntake } from "../lib/storage";
import { loadStudioByline } from "../lib/studioMenu";
import { defaultAnswersForBlocks, FormRespondentView, validateRespondentAnswers } from "./FormRespondentView";

type Props = {
  link: BookingLink;
};

export default function ClientFormBookingPanel({ link }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const blocks: FormBlock[] = useMemo(() => {
    const snap = link.formSnapshot;
    if (snap && Array.isArray(snap) && snap.length > 0) {
      return deserializeBlocks(snap as PersistedFormBlock[]);
    }
    return [];
  }, [link.formSnapshot]);

  useEffect(() => {
    setAnswers(defaultAnswersForBlocks(blocks));
  }, [blocks]);

  const provider = link.providerDisplayName?.trim() || "Your artist";
  const studioLine = loadStudioByline();
  const headerLine = `${provider.toUpperCase()} · ${studioLine.toUpperCase()}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs = validateRespondentAnswers(blocks, answers);
    if (errs.length) {
      setError(errs[0] ?? "Please check the form.");
      return;
    }
    setBusy(true);
    try {
      const row = mapFormAnswersToIntakeRequest(blocks, answers);
      await putIntake(row);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!blocks.length) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f7f6f4] px-4 text-center text-neutral-800">
        <p className="font-body text-lg">Booking form unavailable</p>
        <p className="max-w-sm font-body text-sm text-neutral-500">This link is not set up yet. Ask the studio to publish their booking form.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f7f6f4] px-4 text-center text-neutral-800">
        <p className="font-display text-[10px] uppercase tracking-[0.25em] text-neutral-500">{headerLine}</p>
        <h1 className="font-body text-2xl font-medium text-neutral-900">Request received</h1>
        <p className="max-w-sm font-body text-sm text-neutral-600">
          Thanks — {provider} will follow up with you in their inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6f4] px-4 pb-16 pt-10 text-neutral-900 antialiased sm:px-6">
      <form className="mx-auto max-w-lg" onSubmit={(ev) => void onSubmit(ev)}>
        <p className="font-display text-[10px] uppercase tracking-[0.25em] text-neutral-500">{headerLine}</p>
        <h1
          className="mt-4 text-3xl font-normal italic leading-tight tracking-tight text-neutral-900 sm:text-4xl"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          {link.serviceName || "Booking request"}
        </h1>
        <p className="mt-3 font-body text-sm text-neutral-600">Fill out the form below. We&apos;ll get back to you soon.</p>

        <div className="mt-10">
          <FormRespondentView
            blocks={blocks}
            answers={answers}
            onAnswerChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
          />
        </div>

        {error ? <p className="mt-6 font-body text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-10 w-full rounded-full bg-neutral-900 py-4 font-display text-xs uppercase tracking-[0.2em] text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
