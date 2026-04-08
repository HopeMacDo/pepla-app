import { createStore, del, get, getMany, keys, set } from "idb-keyval";
import type {
  Appointment,
  BookingProposal,
  InboxBookingDetails,
  InboxMessage,
  InboxSlot,
  IntakeAvailability,
  IntakeRequest,
  IntakeStatus
} from "./models";

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

function slotsFromProposal(row: IntakeRequest): InboxSlot[] {
  const p = row.proposal;
  if (!p) return [];
  return p.slotStartISOs.map((startISO) => ({
    id: `offer:${startISO}`,
    startISO,
    durationMins: p.durationMins,
    status:
      p.selectedSlotISO === startISO || p.pendingSlotISO === startISO ? ("selected" as const) : ("pending" as const)
  }));
}

function derivedBookingDetails(row: IntakeRequest): InboxBookingDetails | undefined {
  const p = row.proposal;
  if (!p) return undefined;
  return {
    serviceLabel: p.serviceName,
    depositAmount: p.deposit,
    paymentStatus: p.depositPaid ? "paid" : "unpaid",
    selectedSlotId: p.pendingSlotISO ? `offer:${p.pendingSlotISO}` : p.selectedSlotISO ? `offer:${p.selectedSlotISO}` : undefined
  };
}

function normalizeIntake(req: IntakeRequest): IntakeRequest {
  const parsed = parseName(req.customerName);
  const proposal = normalizeProposal(req.proposal);
  const withCore: IntakeRequest = {
    ...req,
    firstName: req.firstName ?? parsed.firstName,
    lastName: req.lastName ?? parsed.lastName,
    vision: req.vision ?? "",
    availabilitySelections: req.availabilitySelections ?? emptyAvailability(),
    status: req.status ?? "requests",
    proposal,
    messages: req.messages ?? [],
    updatedAt: req.updatedAt ?? req.createdAt,
    customerId: req.customerId,
    slots: req.slots ?? [],
    bookingDetails: req.bookingDetails ?? (proposal ? derivedBookingDetails({ ...req, proposal }) : undefined)
  };
  const slots = proposal ? slotsFromProposal(withCore) : withCore.slots.length ? withCore.slots : [];
  return { ...withCore, slots };
}

function seedIntake(now = new Date()): IntakeRequest[] {
  const mkDate = (deltaDays: number) => new Date(now.getTime() - deltaDays * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(0),
      updatedAt: mkDate(0),
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
      status: "requests",
      messages: [],
      slots: []
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(1),
      updatedAt: mkDate(1),
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
      status: "requests",
      messages: [],
      slots: []
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(4),
      updatedAt: mkDate(4),
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
      status: "accepted",
      messages: [],
      slots: []
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(7),
      updatedAt: mkDate(7),
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
      status: "upcoming",
      messages: [],
      slots: []
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(10),
      updatedAt: mkDate(2),
      firstName: "Noah",
      lastName: "Park",
      customerName: "Noah Park",
      phoneNumber: "(555) 441-2290",
      vision: "Editorial shoot — bold liner and dewy skin.",
      availability: "Mornings: FRI | Afternoons: SAT",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: false, fri: true, sat: false },
        afternoons: { tue: false, wed: false, thu: false, fri: false, sat: true }
      },
      photoDataUrls: [],
      status: "denied",
      messages: [],
      slots: []
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(14),
      updatedAt: mkDate(1),
      firstName: "Elise",
      lastName: "Chen",
      customerName: "Elise Chen",
      phoneNumber: "(555) 112-8834",
      vision: "Corporate headshots — minimal, mattified, camera-ready.",
      availability: "Mornings: THU | Afternoons: none",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: true, fri: false, sat: false },
        afternoons: { tue: false, wed: false, thu: false, fri: false, sat: false }
      },
      photoDataUrls: [],
      status: "completed",
      messages: [],
      slots: []
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
    const normalized = seeds.map((req) => normalizeIntake(req));
    await Promise.all(normalized.map((req) => putIntake(req)));
    return normalized.sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
  }
  const items = (await getMany(allKeys, appStore)) as Array<IntakeRequest | undefined>;
  const normalized = (items.filter(Boolean) as IntakeRequest[]).map(normalizeIntake);
  await Promise.all(normalized.map((req) => putIntake(req)));
  return normalized.sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
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
  const now = new Date().toISOString();
  const next = { ...row, status, updatedAt: now };
  await putIntake(next);
  return next;
}

export async function appendInboxMessage(
  id: string,
  partial: Omit<InboxMessage, "id" | "at"> & { id?: string; at?: string }
): Promise<IntakeRequest | null> {
  const row = await getIntakeById(id);
  if (!row) return null;
  const at = partial.at ?? new Date().toISOString();
  const message: InboxMessage = {
    id: partial.id ?? crypto.randomUUID(),
    at,
    sender: partial.sender,
    contentType: partial.contentType,
    body: partial.body ?? ""
  };
  const next = { ...row, messages: [...(row.messages ?? []), message], updatedAt: at };
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
  const sentAt = new Date().toISOString();
  const proposal: BookingProposal = {
    serviceName: payload.serviceName.trim(),
    durationMins: payload.durationMins,
    price: payload.price,
    deposit: payload.deposit,
    slotStartISOs: uniq,
    sentAt,
    depositPaid: false,
    pendingSlotISO: undefined,
    selectedSlotISO: undefined
  };
  const offerMessage: InboxMessage = {
    id: crypto.randomUUID(),
    sender: "provider",
    at: sentAt,
    contentType: "slot_offer",
    body: `Offered ${uniq.length} time option(s).`
  };
  const bookingDetails: InboxBookingDetails = {
    serviceLabel: payload.serviceName.trim(),
    depositAmount: payload.deposit,
    paymentStatus: "unpaid"
  };
  const next = {
    ...row,
    proposal,
    bookingDetails,
    messages: [...(row.messages ?? []), offerMessage],
    updatedAt: sentAt
  };
  await putIntake(next);
  return normalizeIntake(next);
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
    kind: "appointment",
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
    proposal: { ...row.proposal, selectedSlotISO: slotStartISO, pendingSlotISO: undefined },
    updatedAt: new Date().toISOString()
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
  const merged: IntakeRequest = { ...row, proposal: proposalAfterPick, updatedAt: new Date().toISOString() };
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
  const merged: IntakeRequest = { ...row, proposal: proposalAfterDeposit, updatedAt: new Date().toISOString() };
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
