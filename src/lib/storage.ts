import { createStore, del, get, getMany, keys, set } from "idb-keyval";
import type { Appointment, BookingProposal, IntakeAvailability, IntakeRequest, IntakeStatus } from "./models";

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

function normalizeProposal(p: IntakeRequest["proposal"]): IntakeRequest["proposal"] {
  if (!p) return undefined;
  return {
    ...p,
    depositPaid: p.depositPaid ?? false
  };
}

function normalizeIntake(req: IntakeRequest): IntakeRequest {
  const parsed = parseName(req.customerName);
  return {
    ...req,
    firstName: req.firstName ?? parsed.firstName,
    lastName: req.lastName ?? parsed.lastName,
    vision: req.vision ?? "",
    availabilitySelections: req.availabilitySelections ?? emptyAvailability(),
    status: req.status ?? "requests",
    proposal: normalizeProposal(req.proposal)
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

export type BookingProposalInput = Omit<BookingProposal, "sentAt" | "selectedSlotISO" | "depositPaid" | "pendingSlotISO">;

function appointmentsOverlap(start: Date, end: Date, appointments: Appointment[]): boolean {
  return appointments.some((a) => {
    const as = new Date(a.startISO);
    const ae = new Date(a.endISO);
    return start < ae && as < end;
  });
}

export async function sendBookingProposal(id: string, payload: BookingProposalInput): Promise<IntakeRequest | null> {
  const row = await getIntakeById(id);
  if (!row || row.status !== "accepted") return null;
  const uniq = Array.from(new Set(payload.slotStartISOs)).sort((a, b) => a.localeCompare(b));
  if (uniq.length === 0) return null;
  const proposal: BookingProposal = {
    serviceName: payload.serviceName.trim(),
    durationMins: payload.durationMins,
    price: payload.price,
    deposit: payload.deposit,
    slotStartISOs: uniq,
    sentAt: new Date().toISOString(),
    depositPaid: false,
    pendingSlotISO: undefined,
    selectedSlotISO: undefined
  };
  const next = { ...row, proposal };
  await putIntake(next);
  return next;
}

type FinalizeProposalResult =
  | { ok: true; intake: IntakeRequest }
  | { ok: false; error: "no_proposal" | "not_pending" | "incomplete" | "invalid_slot" | "conflict" | "already_finalized" };

async function finalizeProposalBookingFromRow(row: IntakeRequest): Promise<FinalizeProposalResult> {
  if (!row.proposal) return { ok: false, error: "no_proposal" };
  if (row.status !== "accepted") return { ok: false, error: "not_pending" };
  if (row.proposal.selectedSlotISO) return { ok: false, error: "already_finalized" };
  if (!row.proposal.depositPaid || !row.proposal.pendingSlotISO) return { ok: false, error: "incomplete" };

  const slotStartISO = row.proposal.pendingSlotISO;
  if (!row.proposal.slotStartISOs.includes(slotStartISO)) return { ok: false, error: "invalid_slot" };
  const start = new Date(slotStartISO);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "invalid_slot" };

  const end = new Date(start.getTime() + row.proposal.durationMins * 60 * 1000);
  const appointments = await listAppointments();
  if (appointmentsOverlap(start, end, appointments)) {
    return { ok: false, error: "conflict" };
  }

  const appt: Appointment = {
    id: crypto.randomUUID(),
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    customerId: row.id,
    customerName: row.customerName,
    phoneNumber: row.phoneNumber,
    notes: `${row.proposal.serviceName} · $${row.proposal.price} (deposit $${row.proposal.deposit})`
  };
  await putAppointment(appt);

  const next: IntakeRequest = {
    ...row,
    status: "upcoming",
    proposal: { ...row.proposal, selectedSlotISO: slotStartISO, pendingSlotISO: undefined }
  };
  await putIntake(next);
  return { ok: true, intake: next };
}

export type SetProposalPendingSlotResult =
  | { ok: true; intake: IntakeRequest; finalized: boolean }
  | {
      ok: false;
      error: "not_found" | "no_proposal" | "not_pending" | "already_finalized" | "invalid_slot" | "conflict";
    };

/** Records the client’s preferred slot. Calendar block + Upcoming only after deposit is also recorded. */
export async function setProposalPendingSlot(intakeId: string, slotStartISO: string): Promise<SetProposalPendingSlotResult> {
  const row = await getIntakeById(intakeId);
  if (!row) return { ok: false, error: "not_found" };
  if (!row.proposal) return { ok: false, error: "no_proposal" };
  if (row.status !== "accepted") return { ok: false, error: "not_pending" };
  if (row.proposal.selectedSlotISO) return { ok: false, error: "already_finalized" };
  if (!row.proposal.slotStartISOs.includes(slotStartISO)) return { ok: false, error: "invalid_slot" };
  const start = new Date(slotStartISO);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "invalid_slot" };

  const proposalAfterPick = { ...row.proposal, pendingSlotISO: slotStartISO };
  const merged: IntakeRequest = { ...row, proposal: proposalAfterPick };
  await putIntake(merged);

  if (!proposalAfterPick.depositPaid) {
    return { ok: true, intake: merged, finalized: false };
  }

  const fin = await finalizeProposalBookingFromRow(merged);
  if (!fin.ok) {
    if (fin.error === "conflict") return { ok: false, error: "conflict" };
    return { ok: true, intake: merged, finalized: false };
  }
  return { ok: true, intake: fin.intake, finalized: true };
}

export type SetProposalDepositPaidResult =
  | { ok: true; intake: IntakeRequest; finalized: boolean }
  | { ok: false; error: "not_found" | "no_proposal" | "conflict" };

/** Studio-side (or future payment webhook): marks deposit received; finalizes booking if client already chose a slot. */
export async function setProposalDepositPaid(intakeId: string, paid: boolean): Promise<SetProposalDepositPaidResult> {
  const row = await getIntakeById(intakeId);
  if (!row) return { ok: false, error: "not_found" };
  if (!row.proposal) return { ok: false, error: "no_proposal" };

  const proposalAfterDeposit = { ...row.proposal, depositPaid: paid };
  const merged: IntakeRequest = { ...row, proposal: proposalAfterDeposit };
  await putIntake(merged);

  if (!paid || !proposalAfterDeposit.pendingSlotISO) {
    return { ok: true, intake: merged, finalized: false };
  }

  const fin = await finalizeProposalBookingFromRow(merged);
  if (!fin.ok) {
    if (fin.error === "conflict") return { ok: false, error: "conflict" };
    return { ok: true, intake: merged, finalized: false };
  }
  return { ok: true, intake: fin.intake, finalized: true };
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
