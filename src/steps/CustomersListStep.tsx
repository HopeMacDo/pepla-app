import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { CUSTOMERS_TABLE, toTrimmedString, type Customer } from "@/lib/customers";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function normalizeDigits(s: string) {
  return s.replace(/\D/g, "");
}

function matchesSearch(c: Customer, raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const first = toTrimmedString(c.first_name).toLowerCase();
  const last = toTrimmedString(c.last_name).toLowerCase();
  const phone = toTrimmedString(c.phone_number);
  const phoneDigits = normalizeDigits(phone);
  const qDigits = normalizeDigits(raw);
  return (
    first.includes(q) ||
    last.includes(q) ||
    phone.toLowerCase().includes(q) ||
    (qDigits.length > 0 && phoneDigits.includes(qDigits))
  );
}

function sortCustomers(a: Customer, b: Customer) {
  const an = `${toTrimmedString(a.last_name)} ${toTrimmedString(a.first_name)}`.trim().toLowerCase();
  const bn = `${toTrimmedString(b.last_name)} ${toTrimmedString(b.first_name)}`.trim().toLowerCase();
  return an.localeCompare(bn);
}

export default function CustomersListStep() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const createDialogRef = useRef<HTMLDialogElement>(null);

  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from(CUSTOMERS_TABLE)
      .select("id, first_name, last_name, phone_number")
      .order("last_name", { ascending: true });

    if (fetchError) throw fetchError;
    setRows((data as Customer[]) ?? []);
  }, []);

  useEffect(() => {
    const qName = sp.get("name")?.trim() ?? "";
    const qPhone = sp.get("phone")?.trim() ?? "";
    const parts = [qName, qPhone].filter(Boolean);
    if (parts.length) setQuery(parts.join(" "));
  }, [sp]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadCustomers();
      } catch (e) {
        if (!cancelled) {
          console.error("[customers] loadCustomers", e);
          setError((e as { message?: string })?.message ?? "Something went wrong. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCustomers]);

  useEffect(() => {
    const channel = supabase
      .channel("customers-list-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CUSTOMERS_TABLE },
        () => {
          void loadCustomers();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadCustomers]);

  const resetCreateForm = useCallback(() => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setCreateError(null);
  }, []);

  const openCreateModal = useCallback(() => {
    setCreateError(null);
    createDialogRef.current?.showModal();
  }, []);

  const closeCreateModal = useCallback(() => {
    createDialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) return;

    function onDialogClose() {
      resetCreateForm();
    }

    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, [resetCreateForm]);

  async function onCreateSubmit(e: FormEvent) {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn && !ln) {
      setCreateError("Enter a first or last name.");
      return;
    }

    setCreateError(null);
    setCreateBusy(true);
    try {
      const { data, error: insertError } = await supabase
        .from(CUSTOMERS_TABLE)
        .insert({
          first_name: fn || null,
          last_name: ln || null,
          phone_number: phone.trim() || null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      const newId =
        data && typeof data === "object" && "id" in data ? String((data as { id: string }).id) : null;
      closeCreateModal();
      if (newId) navigate(`/customers/${newId}`);
      else await loadCustomers();
    } catch (err) {
      console.error("[customers] insert", err);
      setCreateError((err as { message?: string })?.message ?? "Something went wrong. Please try again.");
    } finally {
      setCreateBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const list = rows.filter((c) => matchesSearch(c, query));
    return [...list].sort(sortCustomers);
  }, [rows, query]);

  return (
    <div className="flex max-h-[min(100vh-10rem,52rem)] flex-col overflow-hidden rounded-2xl border border-slateGrey/15 bg-sand text-slateGrey shadow-pepla">
      <header
        className={cn(
          "shrink-0 border-b border-slateGrey/15 bg-sand/95 px-4 py-3 backdrop-blur",
          "supports-[backdrop-filter]:bg-sand/80"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <label className="sr-only" htmlFor="customer-search">
            Search customers
          </label>
          <Input
            id="customer-search"
            type="search"
            placeholder="Search customers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-lg border-slateGrey/20 bg-white/90 text-base shadow-pepla focus-visible:ring-slateGrey/40"
          />
          <button
            type="button"
            onClick={openCreateModal}
            disabled={loading}
            aria-label="Create new client"
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slateGrey/20 bg-slateGrey font-body text-xl leading-none text-chalk shadow-pepla",
              "transition hover:bg-slateGrey/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/40 focus-visible:ring-offset-2 focus-visible:ring-offset-sand",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            +
          </button>
        </div>
      </header>

      <dialog
        ref={createDialogRef}
        className="customer-modal"
        aria-labelledby="create-client-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeCreateModal();
        }}
      >
        <div
          className="rounded-2xl border border-slateGrey/15 bg-sand p-6 shadow-pepla"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="create-client-title" className="font-body text-lg font-bold text-slateGrey">
            Create New Client
          </h2>
          <form className="mt-5 grid gap-4" onSubmit={onCreateSubmit}>
            <div className="grid gap-2">
              <label htmlFor="create-first" className="font-body text-sm text-slateGrey/80">
                First name
              </label>
              <Input
                id="create-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                disabled={createBusy}
                className="rounded-lg border-slateGrey/20 bg-white/90 text-base shadow-pepla focus-visible:ring-slateGrey/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="create-last" className="font-body text-sm text-slateGrey/80">
                Last name
              </label>
              <Input
                id="create-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                disabled={createBusy}
                className="rounded-lg border-slateGrey/20 bg-white/90 text-base shadow-pepla focus-visible:ring-slateGrey/40"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="create-phone" className="font-body text-sm text-slateGrey/80">
                Phone <span className="text-slateGrey/50">(optional)</span>
              </label>
              <Input
                id="create-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                disabled={createBusy}
                placeholder="+1…"
                className="rounded-lg border-slateGrey/20 bg-white/90 text-base shadow-pepla focus-visible:ring-slateGrey/40"
              />
            </div>
            {createError && (
              <p className="rounded-lg border border-deepRed/30 bg-white/60 px-3 py-2 font-body text-sm text-deepRed">
                {createError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={createBusy}
                className={cn(
                  "rounded-lg border border-slateGrey/20 bg-white/80 px-4 py-2.5 font-display text-xs uppercase tracking-pepla text-slateGrey",
                  "transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/30",
                  "disabled:opacity-50"
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createBusy}
                className={cn(
                  "rounded-lg border border-slateGrey/20 bg-slateGrey px-4 py-2.5 font-display text-xs uppercase tracking-pepla text-chalk shadow-pepla",
                  "transition hover:bg-slateGrey/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/40 focus-visible:ring-offset-2 focus-visible:ring-offset-sand",
                  "disabled:pointer-events-none disabled:opacity-50"
                )}
              >
                {createBusy ? "Saving…" : "Create client"}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-6 font-body text-sm text-slateGrey/70">Loading customers…</p>
        ) : error ? (
          <p className="px-4 py-6 font-body text-sm text-deepRed">{error}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 font-body text-sm text-slateGrey/70">No customers yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 font-body text-sm text-slateGrey/70">No matches.</p>
        ) : (
          <ul className="divide-y divide-slateGrey/10">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/customers/${c.id}`}
                  className={cn(
                    "grid grid-cols-1 gap-2 px-4 py-4 transition sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-baseline sm:gap-6",
                    "hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slateGrey/25 focus-visible:ring-inset"
                  )}
                >
                  <span className="font-body text-base font-bold text-slateGrey">
                    {toTrimmedString(c.first_name) || "—"}
                  </span>
                  <span className="font-body text-base font-bold text-slateGrey">
                    {toTrimmedString(c.last_name) || "—"}
                  </span>
                  <span className="font-body text-sm text-slateGrey/60 sm:text-right">
                    {toTrimmedString(c.phone_number) || "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
