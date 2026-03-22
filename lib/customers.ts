/**
 * PostgREST table name (`public.<name>`). In `.env.local` set
 * `NEXT_PUBLIC_CUSTOMERS_TABLE` (and optionally `CUSTOMERS_TABLE` for server-only use).
 * Defaults to `customers`.
 */
export const CUSTOMERS_TABLE = (
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CUSTOMERS_TABLE?.trim()) ||
  (typeof process !== "undefined" && process.env.CUSTOMERS_TABLE?.trim()) ||
  "customers"
);

export type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
};

/** Safe for DB/JSON values that may be numbers or other non-strings. */
export function toTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}
