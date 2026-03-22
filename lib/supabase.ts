import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/** Readable message for PostgREST / Supabase client errors (includes hint when present). */
export function formatSupabaseError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const o = err as { message: unknown; hint?: string | null };
    const msg = String(o.message);
    if (o.hint) return `${msg} (${o.hint})`;
    return msg;
  }
  if (err instanceof Error) return err.message;
  return "Failed to load data";
}
