import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ServiceCatalogItem } from "../lib/models";
import { listCatalogServices } from "../lib/storage";
import {
  DEFAULT_STUDIO_BYLINE,
  loadStudioByline,
  saveStudioByline
} from "../lib/studioMenu";
import { Button, Card, CardBody, CardHeader, Input, Label } from "../ui/primitives";

function formatDurationLabel(mins: number) {
  if (mins % 60 === 0) {
    const h = mins / 60;
    return h === 1 ? "1 hr" : `${h} hr`;
  }
  if (mins > 60) {
    const h = Math.floor(mins / 60);
    const mm = mins % 60;
    return mm ? `${h}h ${mm}m` : `${h} hr`;
  }
  return `${mins} min`;
}

function StudioBylineCard() {
  const [byline, setByline] = useState(DEFAULT_STUDIO_BYLINE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setByline(loadStudioByline());
  }, []);

  function onSave() {
    saveStudioByline(byline);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card className="min-w-0 max-w-xl">
      <CardHeader>
        <h2 className="font-display text-lg uppercase tracking-pepla text-slateGrey">Studio header</h2>
        <p className="mt-1 font-body text-sm text-slateGrey/65">Shown on client booking links (e.g. your name · studio).</p>
      </CardHeader>
      <CardBody className="grid gap-4 pt-0">
        <div className="grid gap-2">
          <Label htmlFor="studio-byline-services">Header line</Label>
          <Input
            id="studio-byline-services"
            value={byline}
            onChange={(e) => setByline(e.target.value)}
            placeholder={DEFAULT_STUDIO_BYLINE}
            className="rounded-xl border border-slateGrey/20 bg-white/50 px-3 py-2 font-body text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onSave}>
            Save header
          </Button>
          {saved && <span className="font-body text-sm text-slateGrey/70">Saved.</span>}
        </div>
      </CardBody>
    </Card>
  );
}

export default function ServicesListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setItems(await listCatalogServices());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => {
      const blob = `${s.name}\n${s.description}\n${s.depositRequirements}`.toLowerCase();
      return blob.includes(q);
    });
  }, [items, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
          aria-label="Back to settings"
          onClick={() => navigate("/settings")}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">Services</h1>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
          aria-label="Create a new service"
          onClick={() => navigate("/settings/services/new")}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      <div className="max-w-xl">
        <label htmlFor="services-search" className="sr-only font-display text-[11px] uppercase tracking-pepla opacity-80">
          Search services
        </label>
        <Input
          id="services-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or description…"
          className="rounded-xl border border-slateGrey/20 bg-white/50 px-3 py-2 font-body text-sm"
        />
      </div>

      {loading ? (
        <p className="font-body text-sm text-slateGrey/65">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="max-w-xl rounded-2xl border border-slateGrey/15 bg-white/40 px-5 py-8 text-center">
          <p className="font-body text-sm text-slateGrey/75">
            {items.length === 0 ? "No services yet. Add your first one with the + button." : "No matches for that search."}
          </p>
          {items.length === 0 && (
            <Button type="button" className="mt-4" onClick={() => navigate("/settings/services/new")}>
              Create service
            </Button>
          )}
        </div>
      ) : (
        <ul className="max-w-xl space-y-2" aria-label="Service list">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                to={`/settings/services/${s.id}`}
                className="flex flex-col gap-1 rounded-xl border border-slateGrey/15 bg-white/45 px-4 py-3 transition hover:border-slateGrey/25 hover:bg-white/70 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="font-display text-xs uppercase tracking-pepla text-slateGrey">{s.name}</span>
                  {s.description.trim() ? (
                    <p className="mt-0.5 line-clamp-2 font-body text-xs text-slateGrey/65">{s.description.trim()}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 font-body text-xs text-slateGrey/70 sm:text-right">
                  <span>{formatDurationLabel(s.durationMins)}</span>
                  <span className="tabular-nums">${s.price.toLocaleString()}</span>
                  {!s.priceDisplayOnline ? (
                    <span className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/50">Price hidden online</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <StudioBylineCard />
    </div>
  );
}
