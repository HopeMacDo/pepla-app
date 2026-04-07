"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CUSTOMERS_TABLE, toTrimmedString, type Customer } from "@/lib/customers";
import { formatSupabaseError, supabase } from "@/lib/supabase";

export default function CustomerDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : null;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Invalid customer.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from(CUSTOMERS_TABLE)
          .select("id, first_name, last_name, phone_number")
          .eq("id", id)
          .maybeSingle();

        if (cancelled) return;
        if (fetchError) throw fetchError;
        setCustomer((data as Customer) ?? null);
      } catch (e) {
        if (!cancelled) {
          console.error("[customers] detail", e);
          setError(formatSupabaseError(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-chalk px-4 py-8 text-slateGrey">
      <div className="mx-auto max-w-lg">
        <Link
          href="/customers"
          className="font-display text-xs uppercase tracking-pepla text-slateGrey/70 underline underline-offset-4 decoration-slateGrey/25 hover:decoration-slateGrey/50"
        >
          Customers
        </Link>

        {loading ? (
          <p className="mt-8 font-body text-sm text-slateGrey/70">Loading…</p>
        ) : error ? (
          <p className="mt-8 font-body text-sm text-deepRed">{error}</p>
        ) : !customer ? (
          <p className="mt-8 font-body text-sm text-slateGrey/70">Customer not found.</p>
        ) : (
          <div className="mt-8 rounded-2xl border border-slateGrey/15 bg-white/50 p-6 shadow-pepla">
            <h1 className="font-body text-2xl font-bold">
              {[toTrimmedString(customer.first_name), toTrimmedString(customer.last_name)]
                .filter(Boolean)
                .join(" ") || "—"}
            </h1>
            <p className="mt-3 font-body text-sm text-slateGrey/70">
              {toTrimmedString(customer.phone_number) || "No phone on file"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
