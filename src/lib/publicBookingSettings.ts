const LS_KEY = "pepla-public-booking-settings-v1";

export type PublicBookingSettings = {
  /** Stable token for the studio’s public `/book/:token` link. */
  token: string;
  /** Saved form id (default booking request). */
  linkedFormId: string;
};

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function loadPublicBookingSettings(): PublicBookingSettings | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.token !== "string" || typeof o.linkedFormId !== "string") return null;
    return { token: o.token, linkedFormId: o.linkedFormId };
  } catch {
    return null;
  }
}

export function savePublicBookingSettings(s: PublicBookingSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export function defaultOrMigratePublicBookingSettings(linkedFormId: string): PublicBookingSettings {
  const existing = loadPublicBookingSettings();
  if (existing?.token && existing.linkedFormId) return existing;
  const token = existing?.token && existing.token.length >= 8 ? existing.token : randomToken();
  const next: PublicBookingSettings = { token, linkedFormId: existing?.linkedFormId || linkedFormId };
  savePublicBookingSettings(next);
  return next;
}
