import { createStore, del, get, getMany, keys, set } from "idb-keyval";
import type {
  Appointment,
  BookingLink,
  BookingProposal,
  InboxBookingDetails,
  InboxMessage,
  InboxSlot,
  IntakeAvailability,
  IntakeRequest,
  IntakeStatus,
  ServiceCatalogItem
} from "./models";
import { ServiceCatalogItemSchema } from "./models";
import { loadStudioServices, loadStudioByline } from "./studioMenu";
import { BOOKING_REQUEST_FORM_ID } from "./bookingRequestFormSeed";
import { getSavedForm } from "./savedForms";
import { defaultOrMigratePublicBookingSettings, loadPublicBookingSettings, savePublicBookingSettings } from "./publicBookingSettings";

const appStore = createStore("pepla-booking", "app");

type KVKey =
  | `intake:${string}`
  | `appt:${string}`
  | `booklink:${string}`
  | `booklinkbyintake:${string}`
  | `svc:${string}`
  | "meta:catalog-legacy-import";

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
      createdAt: mkDate(0),
      updatedAt: mkDate(0),
      firstName: "Skye",
      lastName: "Torres",
      customerName: "Skye Torres",
      phoneNumber: "(555) 310-7721",
      vision: "Fine-line floral band wrapping the forearm, mostly blackwork with one soft gray accent.",
      availability: "Mornings: SAT | Afternoons: THU, FRI",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: false, fri: false, sat: true },
        afternoons: { tue: false, wed: false, thu: true, fri: true, sat: false }
      },
      photoDataUrls: [],
      status: "requests",
      messages: [],
      slots: []
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(3),
      updatedAt: mkDate(3),
      firstName: "Dante",
      lastName: "Vega",
      customerName: "Dante Vega",
      phoneNumber: "(555) 904-1183",
      vision: "Cover-up consult on an old tribal armband — open to blackout or heavy rework.",
      availability: "Mornings: TUE, WED | Afternoons: none",
      availabilitySelections: {
        mornings: { tue: true, wed: true, thu: false, fri: false, sat: false },
        afternoons: { tue: false, wed: false, thu: false, fri: false, sat: false }
      },
      photoDataUrls: [],
      status: "requests",
      messages: [],
      slots: []
    },
    {
      id: crypto.randomUUID(),
      createdAt: mkDate(2),
      updatedAt: mkDate(2),
      firstName: "Priya",
      lastName: "Nair",
      customerName: "Priya Nair",
      phoneNumber: "(555) 661-4409",
      vision: "Small script on inner bicep — three words, delicate single needle if possible.",
      availability: "Mornings: none | Afternoons: WED, SAT",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: false, fri: false, sat: false },
        afternoons: { tue: false, wed: true, thu: false, fri: false, sat: true }
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

/** Stable demo rows — written in dev when IndexedDB has intakes but none in `requests` (cold seed only runs on empty store). */
function fakePendingIntakesForDev(now = new Date()): IntakeRequest[] {
  const iso = now.toISOString();
  const row = (
    id: string,
    patch: Pick<
      IntakeRequest,
      | "firstName"
      | "lastName"
      | "customerName"
      | "phoneNumber"
      | "vision"
      | "availability"
      | "availabilitySelections"
    >
  ): IntakeRequest => ({
    id,
    createdAt: iso,
    updatedAt: iso,
    photoDataUrls: [],
    status: "requests",
    messages: [],
    slots: [],
    ...patch
  });
  return [
    row("dev-fake-pending-1", {
      firstName: "Rex",
      lastName: "Morales",
      customerName: "Rex Morales",
      phoneNumber: "(555) 201-0091",
      vision: "American traditional panther on outer calf, midsize.",
      availability: "Mornings: THU | Afternoons: FRI",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: true, fri: false, sat: false },
        afternoons: { tue: false, wed: false, thu: false, fri: true, sat: false }
      }
    }),
    row("dev-fake-pending-2", {
      firstName: "Ivy",
      lastName: "Kwon",
      customerName: "Ivy Kwon",
      phoneNumber: "(555) 772-4410",
      vision: "Micro realism moth with moon phase, upper back.",
      availability: "Mornings: SAT | Afternoons: none",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: false, fri: false, sat: true },
        afternoons: { tue: false, wed: false, thu: false, fri: false, sat: false }
      }
    }),
    row("dev-fake-pending-3", {
      firstName: "Omar",
      lastName: "Hassan",
      customerName: "Omar Hassan",
      phoneNumber: "(555) 448-2201",
      vision: "Geometric sleeve continuation — wrist to elbow, dotwork.",
      availability: "Mornings: none | Afternoons: TUE, WED",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: false, fri: false, sat: false },
        afternoons: { tue: true, wed: true, thu: false, fri: false, sat: false }
      }
    }),
    row("dev-fake-pending-4", {
      firstName: "Cleo",
      lastName: "James",
      customerName: "Cleo James",
      phoneNumber: "(555) 903-6612",
      vision: "Walk-in flash sheet piece — smallest snake design, behind ear.",
      availability: "Mornings: FRI | Afternoons: SAT",
      availabilitySelections: {
        mornings: { tue: false, wed: false, thu: false, fri: true, sat: false },
        afternoons: { tue: false, wed: false, thu: false, fri: false, sat: true }
      }
    })
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
  let normalized = (items.filter(Boolean) as IntakeRequest[]).map(normalizeIntake);
  if (import.meta.env.DEV && normalized.filter((r) => r.status === "requests").length === 0) {
    const demos = fakePendingIntakesForDev(new Date());
    await Promise.all(demos.map((req) => putIntake(normalizeIntake(req))));
    const keys2 = (await keys(appStore)).filter((k) => typeof k === "string" && k.startsWith("intake:")) as string[];
    const items2 = (await getMany(keys2, appStore)) as Array<IntakeRequest | undefined>;
    normalized = (items2.filter(Boolean) as IntakeRequest[]).map(normalizeIntake);
  }
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
  return appointmentsOverlapExcluding(start, end, appointments, undefined);
}

function appointmentsOverlapExcluding(
  start: Date,
  end: Date,
  appointments: Appointment[],
  excludeApptId?: string
): boolean {
  return appointments.some((a) => {
    if (excludeApptId && a.id === excludeApptId) return false;
    const as = new Date(a.startISO);
    const ae = new Date(a.endISO);
    return start < ae && as < end;
  });
}

export async function sendBookingProposal(id: string, payload: BookingProposalInput): Promise<IntakeRequest | null> {
  const row = await getIntakeById(id);
  if (!row || row.status !== "accepted") return null;
  const uniq = Array.from(new Set(payload.slotStartISOs))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 5);
  if (uniq.length === 0) return null;
  const sentAt = new Date().toISOString();
  const proposal: BookingProposal = {
    serviceName: payload.serviceName.trim(),
    durationMins: payload.durationMins,
    price: payload.price,
    deposit: payload.deposit,
    slotStartISOs: uniq,
    sentAt,
    depositPaid: payload.deposit <= 0,
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
    customerId: row.customerId ?? row.id,
    customerName: row.customerName,
    phoneNumber: row.phoneNumber,
    serviceName: row.proposal.serviceName,
    price: row.proposal.price,
    notes: `${row.proposal.serviceName} · $${row.proposal.price} (deposit $${row.proposal.deposit})`
  };
  await putAppointment(appt);

  const next: IntakeRequest = {
    ...row,
    status: "upcoming",
    proposal: { ...row.proposal, selectedSlotISO: slotStartISO, pendingSlotISO: undefined },
    updatedAt: new Date().toISOString(),
    bookingDetails: row.bookingDetails
      ? { ...row.bookingDetails, paymentStatus: "paid" as const }
      : row.bookingDetails
  };
  await putIntake(next);

  const offerTok = (await get(`booklinkbyintake:${row.id}` satisfies KVKey, appStore)) as string | undefined;
  if (offerTok) {
    const bl = (await get(`booklink:${offerTok}` satisfies KVKey, appStore)) as BookingLink | undefined;
    if (bl?.kind === "offer" && bl.status === "active") {
      const nowIso = new Date().toISOString();
      await set(
        `booklink:${offerTok}` satisfies KVKey,
        { ...bl, status: "fulfilled", fulfilledIntakeId: row.id, updatedAt: nowIso },
        appStore
      );
    }
  }

  return { ok: true, intake: next };
}

export type SetProposalPendingSlotResult =
  | { ok: true; intake: IntakeRequest; finalized: boolean }
  | {
      ok: false;
      error: "not_found" | "no_proposal" | "not_pending" | "already_finalized" | "invalid_slot" | "conflict";
    };

/** Records the client’s chosen slot from the offer link and finalizes: calendar appointment, thread → upcoming, link fulfilled. Marks deposit received when they confirm (demo); use `setProposalDepositPaid` from a payment webhook if deposit must wait on real payment. */
export async function setProposalPendingSlot(intakeId: string, slotStartISO: string): Promise<SetProposalPendingSlotResult> {
  const row = await getIntakeById(intakeId);
  if (!row) return { ok: false, error: "not_found" };
  if (!row.proposal) return { ok: false, error: "no_proposal" };
  if (row.status !== "accepted") return { ok: false, error: "not_pending" };
  if (row.proposal.selectedSlotISO) return { ok: false, error: "already_finalized" };
  if (!row.proposal.slotStartISOs.includes(slotStartISO)) return { ok: false, error: "invalid_slot" };
  const start = new Date(slotStartISO);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "invalid_slot" };

  const proposalReady = {
    ...row.proposal,
    pendingSlotISO: slotStartISO,
    depositPaid: true
  };
  const mergedReady: IntakeRequest = {
    ...row,
    proposal: proposalReady,
    updatedAt: new Date().toISOString()
  };

  const fin = await finalizeProposalBookingFromRow(mergedReady);
  if (!fin.ok) {
    if (fin.error === "conflict") return { ok: false, error: "conflict" };
    if (fin.error === "invalid_slot") return { ok: false, error: "invalid_slot" };
    return { ok: false, error: "not_pending" };
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

function randomBookingToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function allocBookingToken(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const t = randomBookingToken();
    const existing = await get(`booklink:${t}` satisfies KVKey, appStore);
    if (!existing) return t;
  }
  return crypto.randomUUID().replace(/-/g, "");
}

/** Marks expired links and removes Spot calendar holds. */
export async function sweepExpiredBookingLinks(): Promise<void> {
  const allKeys = (await keys(appStore)).filter(
    (k) => typeof k === "string" && k.startsWith("booklink:") && !k.startsWith("booklinkbyintake:")
  ) as string[];
  const now = Date.now();
  for (const k of allKeys) {
    const link = (await get(k, appStore)) as BookingLink | undefined;
    if (!link || link.status !== "active") continue;
    if (!link.expiresAt) continue;
    if (new Date(link.expiresAt).getTime() >= now) continue;
    const updated: BookingLink = { ...link, status: "expired", updatedAt: new Date().toISOString() };
    await set(k, updated, appStore);
    if (link.kind === "spot" && link.holdAppointmentId) {
      await del(`appt:${link.holdAppointmentId}` satisfies KVKey, appStore);
    }
  }
}

export async function getBookingLinkByToken(token: string): Promise<BookingLink | null> {
  await sweepExpiredBookingLinks();
  const link = (await get(`booklink:${token}` satisfies KVKey, appStore)) as BookingLink | undefined;
  return link ?? null;
}

/** Ensure the studio’s public `/book/:token` link exists (form mode) and embed the latest form snapshot. */
export async function ensurePublicFormBookingLink(): Promise<{ token: string; bookingUrl: string }> {
  const settings = defaultOrMigratePublicBookingSettings(BOOKING_REQUEST_FORM_ID);
  const form = getSavedForm(settings.linkedFormId);
  if (!form) throw new Error("Public booking form not found");

  let token = settings.token;
  const existing = await getBookingLinkByToken(token);
  if (existing && existing.kind !== "form") {
    const fresh = await allocBookingToken();
    const nextSettings = { ...settings, token: fresh };
    savePublicBookingSettings(nextSettings);
    token = fresh;
  }

  const now = new Date().toISOString();
  const byline = loadStudioByline();
  const snap = form.blocks as unknown as BookingLink["formSnapshot"];
  const at = await getBookingLinkByToken(token);
  if (!at) {
    const link: BookingLink = {
      id: crypto.randomUUID(),
      token,
      kind: "form",
      status: "active",
      providerDisplayName: byline.trim() || "Your studio",
      serviceName: "Booking request",
      durationMins: 60,
      price: 0,
      deposit: 0,
      slotStartISOs: [],
      formId: settings.linkedFormId,
      formSnapshot: snap,
      createdAt: now,
      updatedAt: now
    };
    await set(`booklink:${token}` satisfies KVKey, link, appStore);
  } else if (at.kind === "form") {
    const next: BookingLink = {
      ...at,
      formId: settings.linkedFormId,
      formSnapshot: snap,
      providerDisplayName: byline.trim() || at.providerDisplayName,
      updatedAt: now
    };
    await set(`booklink:${token}` satisfies KVKey, next, appStore);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return { token, bookingUrl: `${origin}/book/${token}` };
}

export async function syncPublicFormBookingLinkContent(): Promise<void> {
  const s = loadPublicBookingSettings();
  if (!s?.token) return;
  const form = getSavedForm(s.linkedFormId);
  if (!form) return;
  const link = await getBookingLinkByToken(s.token);
  if (!link || link.kind !== "form") return;
  const next: BookingLink = {
    ...link,
    formId: s.linkedFormId,
    formSnapshot: form.blocks as unknown as BookingLink["formSnapshot"],
    updatedAt: new Date().toISOString()
  };
  await set(`booklink:${s.token}` satisfies KVKey, next, appStore);
}

export async function getActiveOfferTokenForIntake(intakeId: string): Promise<string | null> {
  const tok = (await get(`booklinkbyintake:${intakeId}` satisfies KVKey, appStore)) as string | undefined;
  return tok ?? null;
}

export async function createSpotBookingLink(input: {
  providerDisplayName: string;
  serviceName: string;
  durationMins: number;
  price: number;
  deposit: number;
  slotStartISO: string;
  expiresAt?: string;
}): Promise<{ token: string; link: BookingLink } | { error: "overlap" | "bad_slot" }> {
  await sweepExpiredBookingLinks();
  const start = new Date(input.slotStartISO);
  if (Number.isNaN(start.getTime())) return { error: "bad_slot" };
  const end = new Date(start.getTime() + input.durationMins * 60 * 1000);
  const appointments = await listAppointments();
  if (appointmentsOverlap(start, end, appointments)) return { error: "overlap" };

  const linkId = crypto.randomUUID();
  const token = await allocBookingToken();
  const holdId = crypto.randomUUID();
  const now = new Date().toISOString();
  const depositPaid = input.deposit <= 0;

  const link: BookingLink = {
    id: linkId,
    token,
    kind: "spot",
    status: "active",
    providerDisplayName: input.providerDisplayName.trim() || "Your artist",
    serviceName: input.serviceName.trim(),
    durationMins: input.durationMins,
    price: input.price,
    deposit: input.deposit,
    slotStartISOs: [start.toISOString()],
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
    depositPaid,
    holdAppointmentId: holdId
  };

  const hold: Appointment = {
    id: holdId,
    kind: "spot_hold",
    bookingLinkId: linkId,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    customerName: "Open · Spot",
    serviceName: input.serviceName.trim(),
    price: input.price,
    notes: "Public opening — share link to fill"
  };
  await putAppointment(hold);
  await set(`booklink:${token}` satisfies KVKey, link, appStore);
  return { token, link };
}

export async function sendOfferWithShareableLink(
  intakeId: string,
  payload: BookingProposalInput,
  meta: { providerDisplayName: string; expiresAt?: string }
): Promise<{ token: string; intake: IntakeRequest } | null> {
  const row = await sendBookingProposal(intakeId, payload);
  if (!row?.proposal) return null;

  const oldTok = (await get(`booklinkbyintake:${intakeId}` satisfies KVKey, appStore)) as string | undefined;
  if (oldTok) await del(`booklink:${oldTok}` satisfies KVKey, appStore);

  const token = await allocBookingToken();
  const now = new Date().toISOString();
  const p = row.proposal;
  const link: BookingLink = {
    id: crypto.randomUUID(),
    token,
    kind: "offer",
    status: "active",
    intakeId,
    providerDisplayName: meta.providerDisplayName.trim() || "Your artist",
    serviceName: p.serviceName,
    durationMins: p.durationMins,
    price: p.price,
    deposit: p.deposit,
    slotStartISOs: [...p.slotStartISOs],
    expiresAt: meta.expiresAt,
    createdAt: now,
    updatedAt: now,
    depositPaid: p.deposit <= 0
  };
  await set(`booklink:${token}` satisfies KVKey, link, appStore);
  await set(`booklinkbyintake:${intakeId}` satisfies KVKey, token, appStore);
  return { token, intake: row };
}

export type FinalizeSpotResult =
  | { ok: true; link: BookingLink; intake: IntakeRequest }
  | { ok: false; error: "not_found" | "inactive" | "incomplete" | "conflict" | "needs_claim" | "bad_slot" };

export async function tryFinalizeSpotBookingLink(token: string): Promise<FinalizeSpotResult> {
  await sweepExpiredBookingLinks();
  const link = (await get(`booklink:${token}` satisfies KVKey, appStore)) as BookingLink | undefined;
  if (!link || link.kind !== "spot") return { ok: false, error: "not_found" };
  if (link.status !== "active") return { ok: false, error: "inactive" };
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return { ok: false, error: "inactive" };

  const slotISO = link.pendingSlotISO;
  if (!slotISO || !link.slotStartISOs.includes(slotISO)) return { ok: false, error: "bad_slot" };
  const fn = (link.spotClaimFirstName ?? "").trim();
  const ln = (link.spotClaimLastName ?? "").trim();
  const phone = (link.spotClaimPhone ?? "").trim();
  if (!phone || (!fn && !ln)) return { ok: false, error: "needs_claim" };
  if (link.deposit > 0 && !link.depositPaid) return { ok: false, error: "incomplete" };

  const start = new Date(slotISO);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "bad_slot" };
  const end = new Date(start.getTime() + link.durationMins * 60 * 1000);
  const appointments = await listAppointments();
  const holdId = link.holdAppointmentId;
  if (appointmentsOverlapExcluding(start, end, appointments, holdId)) {
    return { ok: false, error: "conflict" };
  }
  if (holdId) await del(`appt:${holdId}` satisfies KVKey, appStore);

  const now = new Date().toISOString();
  const intakeId = crypto.randomUUID();
  const name = `${fn} ${ln}`.trim() || "Client";
  const proposal: BookingProposal = {
    serviceName: link.serviceName,
    durationMins: link.durationMins,
    price: link.price,
    deposit: link.deposit,
    slotStartISOs: link.slotStartISOs,
    sentAt: link.createdAt ?? now,
    depositPaid: link.deposit <= 0 ? true : Boolean(link.depositPaid),
    pendingSlotISO: undefined,
    selectedSlotISO: slotISO
  };
  const intakeRow: IntakeRequest = {
    id: intakeId,
    createdAt: now,
    updatedAt: now,
    customerName: name,
    firstName: fn || undefined,
    lastName: ln || undefined,
    phoneNumber: phone,
    vision: `Spot: ${link.serviceName}`,
    availability: "—",
    photoDataUrls: [],
    status: "upcoming",
    messages: [
      {
        id: crypto.randomUUID(),
        sender: "provider",
        at: now,
        contentType: "booking_confirmation",
        body: `You booked ${link.providerDisplayName}'s open spot — ${link.serviceName}.`
      }
    ],
    proposal,
    slots: []
  };
  await putIntake(normalizeIntake(intakeRow));

  const appt: Appointment = {
    id: crypto.randomUUID(),
    kind: "appointment",
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    customerId: intakeId,
    customerName: name,
    phoneNumber: phone,
    serviceName: link.serviceName,
    price: link.price,
    notes: `${link.serviceName} · spot claim · $${link.price} (deposit $${link.deposit})`
  };
  await putAppointment(appt);

  const fulfilledLink: BookingLink = {
    ...link,
    status: "fulfilled",
    fulfilledIntakeId: intakeId,
    holdAppointmentId: undefined,
    updatedAt: now
  };
  await set(`booklink:${token}` satisfies KVKey, fulfilledLink, appStore);

  const saved = await getIntakeById(intakeId);
  if (!saved) return { ok: false, error: "not_found" };
  return { ok: true, link: fulfilledLink, intake: saved };
}

export async function claimSpotBookingLink(
  token: string,
  client: { firstName: string; lastName: string; phone: string }
): Promise<
  | { ok: true; link: BookingLink; autoFinalized: boolean; intake?: IntakeRequest }
  | { ok: false; error: string }
> {
  await sweepExpiredBookingLinks();
  const link = (await get(`booklink:${token}` satisfies KVKey, appStore)) as BookingLink | undefined;
  if (!link || link.kind !== "spot") return { ok: false, error: "not_found" };
  if (link.status !== "active") return { ok: false, error: "inactive" };
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return { ok: false, error: "expired" };
  const slotISO = link.slotStartISOs[0];
  if (!slotISO) return { ok: false, error: "bad_slot" };

  const updated: BookingLink = {
    ...link,
    spotClaimFirstName: client.firstName.trim(),
    spotClaimLastName: client.lastName.trim(),
    spotClaimPhone: client.phone.trim(),
    pendingSlotISO: slotISO,
    updatedAt: new Date().toISOString()
  };
  await set(`booklink:${token}` satisfies KVKey, updated, appStore);

  if (updated.deposit <= 0) {
    const fin = await tryFinalizeSpotBookingLink(token);
    if (!fin.ok) {
      const msg =
        fin.error === "conflict"
          ? "That time is no longer available."
          : fin.error === "needs_claim"
            ? "Please add your name and phone."
            : "Could not complete booking.";
      return { ok: false, error: msg };
    }
    return { ok: true, link: fin.link, autoFinalized: true, intake: fin.intake };
  }
  return { ok: true, link: updated, autoFinalized: false };
}

export async function patchSpotBookingLinkDepositPaid(token: string, paid: boolean): Promise<BookingLink | null> {
  await sweepExpiredBookingLinks();
  const link = (await get(`booklink:${token}` satisfies KVKey, appStore)) as BookingLink | undefined;
  if (!link || link.kind !== "spot") return null;
  const next: BookingLink = { ...link, depositPaid: paid, updatedAt: new Date().toISOString() };
  await set(`booklink:${token}` satisfies KVKey, next, appStore);
  return next;
}

/** Demo: store masked card reference when client opts in during deposit (Stripe later). */
export async function saveClientPaymentMethodStub(
  intakeId: string,
  stub: { last4: string; brand?: string }
): Promise<IntakeRequest | null> {
  const row = await getIntakeById(intakeId);
  if (!row) return null;
  const digits = stub.last4.replace(/\D/g, "");
  if (digits.length < 4) return null;
  const last4 = digits.slice(-4);
  const now = new Date().toISOString();
  const next: IntakeRequest = {
    ...row,
    clientPaymentMethodStub: { last4, brand: stub.brand?.trim() || "Card", savedAt: now },
    updatedAt: now
  };
  await putIntake(normalizeIntake(next));
  return getIntakeById(intakeId);
}

function parseCatalogService(raw: unknown): ServiceCatalogItem | null {
  const r = ServiceCatalogItemSchema.safeParse(raw);
  return r.success ? r.data : null;
}

async function ensureLegacyCatalogImport(): Promise<void> {
  const marked = (await get("meta:catalog-legacy-import" satisfies KVKey, appStore)) as boolean | undefined;
  if (marked) return;
  const svcKeys = (await keys(appStore)).filter((k) => typeof k === "string" && k.startsWith("svc:")) as string[];
  if (svcKeys.length > 0) {
    await set("meta:catalog-legacy-import" satisfies KVKey, true, appStore);
    return;
  }
  const names = loadStudioServices();
  const now = new Date().toISOString();
  for (const name of names) {
    const item: ServiceCatalogItem = {
      id: crypto.randomUUID(),
      name,
      durationMins: 60,
      price: 0,
      priceDisplayOnline: true,
      description: "",
      depositAmount: 0,
      depositRequirements: "",
      createdAt: now,
      updatedAt: now
    };
    await set(`svc:${item.id}` satisfies KVKey, item, appStore);
  }
  await set("meta:catalog-legacy-import" satisfies KVKey, true, appStore);
}

export async function listCatalogServices(): Promise<ServiceCatalogItem[]> {
  await ensureLegacyCatalogImport();
  const allKeys = (await keys(appStore)).filter((k) => typeof k === "string" && k.startsWith("svc:")) as string[];
  const items = (await getMany(allKeys, appStore)) as unknown[];
  const out: ServiceCatalogItem[] = [];
  for (const raw of items) {
    const p = parseCatalogService(raw);
    if (p) out.push(p);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCatalogService(id: string): Promise<ServiceCatalogItem | null> {
  await ensureLegacyCatalogImport();
  const raw = await get(`svc:${id}` satisfies KVKey, appStore);
  return parseCatalogService(raw);
}

export async function putCatalogService(item: ServiceCatalogItem): Promise<void> {
  const parsed = ServiceCatalogItemSchema.parse(item);
  await set(`svc:${parsed.id}` satisfies KVKey, parsed, appStore);
}

export async function deleteCatalogService(id: string): Promise<void> {
  await del(`svc:${id}` satisfies KVKey, appStore);
}
