import { createStore, del, get, getMany, keys, set } from "idb-keyval";
import type { Appointment, IntakeAvailability, IntakeRequest, IntakeStatus } from "./models";

const appStore = createStore("pepla-booking", "app");

type KVKey = `intake:${string}` | `appt:${string}`;

function emptyAvailability(): IntakeAvailability {
  return {
    mornings: { tue: false, wed: false, thu: false, fri: false, sat: false },
    afternoons: { tue: false, wed: false, thu: false, fri: false, sat: false }
  };
}

function parseName(customerName: string) {
  const parts = customerName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

function normalizeIntake(req: IntakeRequest): IntakeRequest {
  const parsed = parseName(req.customerName);
  return {
    ...req,
    firstName: req.firstName ?? parsed.firstName,
    lastName: req.lastName ?? parsed.lastName,
    vision: req.vision ?? "",
    availabilitySelections: req.availabilitySelections ?? emptyAvailability(),
    status: req.status ?? "requests"
  };
}

function seedIntake(now = new Date()): IntakeRequest[] {
  const mkDate = (deltaDays: number) => new Date(now.getTime() - deltaDays * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(0),
      firstName: "Jane",
      lastName: "Smith",
      customerName: "Jane Smith",
      phoneNumber: "(555) 103-4002",
      vision: "Soft glam for engagement photos, neutral tones with a subtle glow.",
      availability: "Mornings: THU, FRI | Afternoons: SAT",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: true, fri: true, sat: false },
        afternoons: { tue: false, wed: false, thu: false, fri: false, sat: true }
      },
      photoDataUrls: [],
      status: "requests"
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(1),
      firstName: "Maya",
      lastName: "Johnson",
      customerName: "Maya Johnson",
      phoneNumber: "(555) 203-1948",
      vision: "Bridal trial with natural skin and soft rose lips for a June wedding.",
      availability: "Mornings: WED | Afternoons: THU, FRI",
      availabilitySelections: {
        mornings: { tue: false, wed: true, thu: false, fri: false, sat: false },
        afternoons: { tue: false, wed: false, thu: true, fri: true, sat: false }
      },
      photoDataUrls: [],
      status: "requests"
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(4),
      firstName: "Amber",
      lastName: "Adams",
      customerName: "Amber Adams",
      phoneNumber: "(555) 839-0092",
      vision: "Birthday dinner glam with lifted liner and a warm shimmer eye.",
      availability: "Mornings: none | Afternoons: WED, SAT",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: false, fri: false, sat: false },
        afternoons: { tue: false, wed: true, thu: false, fri: false, sat: true }
      },
      photoDataUrls: [],
      status: "accepted"
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(7),
      firstName: "Rylie",
      lastName: "Holt",
      customerName: "Rylie Holt",
      phoneNumber: "(555) 994-1038",
      vision: "Everyday polished look lesson focused on quick skin + brows.",
      availability: "Mornings: TUE, THU | Afternoons: none",
      availabilitySelections: {
        mornings: { tue: true, wed: false, thu: true, fri: false, sat: false },
        afternoons: { tue: false, wed: false, thu: false, fri: false, sat: false }
      },
      photoDataUrls: [],
      status: "upcoming"
    }
  ];
}

export async function putIntake(req: IntakeRequest) {
  await set(`intake:${req.id}` satisfies KVKey, normalizeIntake(req), appStore);
}
export async function listIntake(): Promise<IntakeRequest[]> {
  const allKeys = (await keys(appStore)).filter((k) => typeof k === "string" && k.startsWith("intake:")) as string[];
  if (allKeys.length === 0) {
    const seeds = seedIntake();
    await Promise.all(seeds.map((req) => putIntake(req)));
    return seeds;
  }
  const items = (await getMany(allKeys, appStore)) as Array<IntakeRequest | undefined>;
  const normalized = (items.filter(Boolean) as IntakeRequest[]).map(normalizeIntake);
  await Promise.all(normalized.map((req) => putIntake(req)));
  return normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getIntakeById(id: string): Promise<IntakeRequest | null> {
  const row = (await get(`intake:${id}` satisfies KVKey, appStore)) as IntakeRequest | undefined;
  if (!row) return null;
  const normalized = normalizeIntake(row);
  await putIntake(normalized);
  return normalized;
}

export async function updateIntakeStatus(id: string, status: IntakeStatus): Promise<IntakeRequest | null> {
  const row = await getIntakeById(id);
  if (!row) return null;
  const next = { ...row, status };
  await putIntake(next);
  return next;
}

export async function putAppointment(appt: Appointment) {
  await set(`appt:${appt.id}` satisfies KVKey, appt, appStore);
}
export async function listAppointments(): Promise<Appointment[]> {
  const allKeys = (await keys(appStore)).filter((k) => typeof k === "string" && k.startsWith("appt:")) as string[];
  const items = (await getMany(allKeys, appStore)) as Array<Appointment | undefined>;
  return items.filter(Boolean) as Appointment[];
}
export async function deleteAppointment(id: string) {
  await del(`appt:${id}` satisfies KVKey, appStore);
}
