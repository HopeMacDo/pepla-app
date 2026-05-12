const LS_SERVICES = "pepla:studio-services-json";
const LS_BYLINE = "pepla:studio-byline";

export const DEFAULT_STUDIO_SERVICES = [
  "Tattoo appointment",
  "Consultation",
  "Touch-up",
  "Full color + cut",
  "Half sleeve session",
  "Fine line piece"
];

export const DEFAULT_STUDIO_BYLINE = "Your studio";

function parseServices(raw: string | null): string[] {
  if (!raw) return [...DEFAULT_STUDIO_SERVICES];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [...DEFAULT_STUDIO_SERVICES];
    const names = v.map((x) => String(x).trim()).filter(Boolean);
    return names.length ? Array.from(new Set(names)) : [...DEFAULT_STUDIO_SERVICES];
  } catch {
    return [...DEFAULT_STUDIO_SERVICES];
  }
}

export function loadStudioServices(): string[] {
  if (typeof localStorage === "undefined") return [...DEFAULT_STUDIO_SERVICES];
  return parseServices(localStorage.getItem(LS_SERVICES));
}

export function saveStudioServices(names: string[]): void {
  if (typeof localStorage === "undefined") return;
  const uniq = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  localStorage.setItem(LS_SERVICES, JSON.stringify(uniq.length ? uniq : DEFAULT_STUDIO_SERVICES));
}

export function loadStudioByline(): string {
  if (typeof localStorage === "undefined") return DEFAULT_STUDIO_BYLINE;
  const v = localStorage.getItem(LS_BYLINE)?.trim();
  return v || DEFAULT_STUDIO_BYLINE;
}

export function saveStudioByline(line: string): void {
  if (typeof localStorage === "undefined") return;
  const t = line.trim();
  localStorage.setItem(LS_BYLINE, t || DEFAULT_STUDIO_BYLINE);
}
