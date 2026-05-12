import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BOOKING_REQUEST_FORM_ID } from "../lib/bookingRequestFormSeed";
import { listSavedForms, type SavedForm } from "../lib/savedForms";
import {
  defaultOrMigratePublicBookingSettings,
  loadPublicBookingSettings,
  savePublicBookingSettings
} from "../lib/publicBookingSettings";
import { ensurePublicFormBookingLink, syncPublicFormBookingLinkContent } from "../lib/storage";
import { Button, Input, Label } from "../ui/primitives";

export default function OnlineBookingSettingsPanel() {
  const [forms, setForms] = useState<SavedForm[]>([]);
  const [linkedFormId, setLinkedFormId] = useState(BOOKING_REQUEST_FORM_ID);
  const [bookingUrl, setBookingUrl] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshForms = useCallback(() => {
    setForms(listSavedForms());
  }, []);

  useEffect(() => {
    refreshForms();
  }, [refreshForms]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const settings = defaultOrMigratePublicBookingSettings(BOOKING_REQUEST_FORM_ID);
        if (!cancelled) setLinkedFormId(settings.linkedFormId);
        const { bookingUrl: url } = await ensurePublicFormBookingLink();
        if (!cancelled) setBookingUrl(url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLinkedFormChange(nextId: string) {
    setLinkedFormId(nextId);
    const cur = loadPublicBookingSettings();
    const token = cur?.token ?? defaultOrMigratePublicBookingSettings(BOOKING_REQUEST_FORM_ID).token;
    savePublicBookingSettings({ token, linkedFormId: nextId });
    setBusy(true);
    try {
      const { bookingUrl: url } = await ensurePublicFormBookingLink();
      setBookingUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function onSyncFormToLink() {
    setBusy(true);
    try {
      await syncPublicFormBookingLinkContent();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="font-display text-lg uppercase tracking-pepla text-slateGrey">Public booking link</h2>
        <p className="mt-2 font-body text-sm text-slateGrey/65">
          Default: clients use a <strong className="font-medium text-slateGrey">booking request form</strong> (first
          name, last name, phone, message, and availability). The form is saved as{" "}
          <Link to={`/settings/forms/${BOOKING_REQUEST_FORM_ID}`} className="text-slateGrey underline decoration-slateGrey/30 underline-offset-2">
            Booking Request
          </Link>{" "}
          under Forms — edit questions there anytime.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="booking-form-select">Form for this link</Label>
        <select
          id="booking-form-select"
          value={linkedFormId}
          disabled={busy}
          onChange={(e) => void onLinkedFormChange(e.target.value)}
          className="rounded-xl border border-slateGrey/20 bg-slateGrey/5 px-3 py-2 font-body text-sm text-slateGrey outline-none focus:border-slateGrey/40"
        >
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name.trim() || "Untitled form"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="booking-public-url">Shareable URL</Label>
        <div className="flex flex-wrap gap-2">
          <Input id="booking-public-url" readOnly value={bookingUrl} className="min-w-0 flex-1 font-mono text-xs" />
          <Button type="button" variant="ghost" size="sm" disabled={!bookingUrl || busy} onClick={() => void copyUrl()}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void onSyncFormToLink()}>
          Refresh embedded form on link
        </Button>
        <span className="font-body text-xs text-slateGrey/55">
          Use after editing the form so clients see your latest version.
        </span>
      </div>

      {error ? <p className="font-body text-sm text-deepRed">{error}</p> : null}
    </div>
  );
}
