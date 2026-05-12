import { z } from "zod";

export const IntakeStatusSchema = z.enum(["requests", "accepted", "upcoming", "completed", "denied"]);
export type IntakeStatus = z.infer<typeof IntakeStatusSchema>;

/** Message in an inbox thread timeline. */
export const InboxMessageSenderSchema = z.enum(["provider", "client"]);
export type InboxMessageSender = z.infer<typeof InboxMessageSenderSchema>;

export const InboxMessageContentTypeSchema = z.enum([
  "text",
  "slot_offer",
  "booking_confirmation",
  "payment_status"
]);
export type InboxMessageContentType = z.infer<typeof InboxMessageContentTypeSchema>;

export const InboxMessageSchema = z.object({
  id: z.string(),
  sender: InboxMessageSenderSchema,
  at: z.string(),
  contentType: InboxMessageContentTypeSchema,
  body: z.string().default("")
});
export type InboxMessage = z.infer<typeof InboxMessageSchema>;

export const InboxSlotStatusSchema = z.enum(["pending", "selected", "expired"]);
export type InboxSlotStatus = z.infer<typeof InboxSlotStatusSchema>;

export const InboxSlotSchema = z.object({
  id: z.string(),
  startISO: z.string(),
  durationMins: z.number().int().positive(),
  status: InboxSlotStatusSchema
});
export type InboxSlot = z.infer<typeof InboxSlotSchema>;

export const InboxPaymentStatusSchema = z.enum(["unpaid", "paid", "waived"]);
export type InboxPaymentStatus = z.infer<typeof InboxPaymentStatusSchema>;

export const InboxBookingDetailsSchema = z.object({
  selectedSlotId: z.string().optional(),
  serviceLabel: z.string(),
  depositAmount: z.number().nonnegative(),
  paymentStatus: InboxPaymentStatusSchema
});
export type InboxBookingDetails = z.infer<typeof InboxBookingDetailsSchema>;

export const IntakeAvailabilitySchema = z.object({
  mornings: z.object({
    tue: z.boolean(),
    wed: z.boolean(),
    thu: z.boolean(),
    fri: z.boolean(),
    sat: z.boolean()
  }),
  afternoons: z.object({
    tue: z.boolean(),
    wed: z.boolean(),
    thu: z.boolean(),
    fri: z.boolean(),
    sat: z.boolean()
  })
});
export type IntakeAvailability = z.infer<typeof IntakeAvailabilitySchema>;

export const BookingProposalSchema = z.object({
  serviceName: z.string().min(1),
  durationMins: z.number().int().positive(),
  price: z.number().nonnegative(),
  deposit: z.number().nonnegative(),
  slotStartISOs: z.array(z.string()).min(1).max(5),
  sentAt: z.string(),
  /** Studio has recorded deposit received (or payment integration, later). */
  depositPaid: z.boolean().default(false),
  /** Client’s chosen slot before deposit + selection finalize the calendar hold. */
  pendingSlotISO: z.string().optional(),
  /** Set when booking is finalized — appointment exists and time is blocked. */
  selectedSlotISO: z.string().optional()
});
export type BookingProposal = z.infer<typeof BookingProposalSchema>;

export const IntakeRequestSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  /** Last activity on the thread (messages, status changes, etc.). */
  updatedAt: z.string().optional(),
  /** Optional `Customer.id` from `lib/customers.ts` (Supabase CRM). */
  customerId: z.string().optional(),
  customerName: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().min(1),
  vision: z.string().optional(),
  availability: z.string().min(1),
  availabilitySelections: IntakeAvailabilitySchema.optional(),
  photoDataUrls: z.array(z.string()).default([]),
  status: IntakeStatusSchema.default("requests"),
  proposal: BookingProposalSchema.optional(),
  messages: z.array(InboxMessageSchema).default([]),
  slots: z.array(InboxSlotSchema).default([]),
  bookingDetails: InboxBookingDetailsSchema.optional(),
  /** Demo: last card digits saved when client opts in during deposit (Stripe later). */
  clientPaymentMethodStub: z
    .object({
      last4: z.string().min(4).max(4),
      brand: z.string().optional(),
      savedAt: z.string()
    })
    .optional()
});
export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;

/** Inbox thread aggregate — persisted as an intake row in IndexedDB. */
export const InboxThreadSchema = IntakeRequestSchema;
export type InboxThread = IntakeRequest;

export const AppointmentSchema = z.object({
  id: z.string(),
  startISO: z.string(),
  endISO: z.string(),
  kind: z.enum(["appointment", "block", "spot_hold"]).default("appointment"),
  /** When `kind` is `spot_hold`, ties the calendar block to a shareable Spot link. */
  bookingLinkId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().min(1),
  phoneNumber: z.string().optional(),
  serviceName: z.string().optional(),
  price: z.number().nonnegative().optional(),
  notes: z.string().optional()
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const BookingLinkKindSchema = z.enum(["spot", "offer", "form"]);
export type BookingLinkKind = z.infer<typeof BookingLinkKindSchema>;

export const BookingLinkStatusSchema = z.enum(["active", "fulfilled", "expired", "cancelled"]);
export type BookingLinkStatus = z.infer<typeof BookingLinkStatusSchema>;

/** Saved studio service for offers, booking, and public spots. */
export const ServiceCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  durationMins: z.number().int().positive(),
  price: z.number().nonnegative(),
  /** When false, price may be hidden on client-facing surfaces (future). */
  priceDisplayOnline: z.boolean().default(true),
  description: z.string().default(""),
  /** Default deposit amount in dollars when prefilling offers / spots. */
  depositAmount: z.number().nonnegative().default(0),
  /** Policy copy (non-refundable, due at booking, etc.). */
  depositRequirements: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ServiceCatalogItem = z.infer<typeof ServiceCatalogItemSchema>;

/** Shareable Spot (public opening) or Offer (private options for one client). */
export const BookingLinkSchema = z.object({
  id: z.string(),
  /** URL segment for `/book/:token` — not derived from intake ids. */
  token: z.string().min(8),
  kind: BookingLinkKindSchema,
  status: BookingLinkStatusSchema.default("active"),
  /** Offer links always point at an inbox thread in `accepted` with a proposal. */
  intakeId: z.string().optional(),
  /** After a Spot is claimed, the new inbox thread id. */
  fulfilledIntakeId: z.string().optional(),
  /** Public form booking: which saved form (Settings → Forms). */
  formId: z.string().optional(),
  /** Serialized form blocks so `/book/:token` works without the respondent’s localStorage. */
  formSnapshot: z.array(z.unknown()).optional(),
  providerDisplayName: z.string().min(1),
  serviceName: z.string().min(1),
  durationMins: z.number().int().positive(),
  price: z.number().nonnegative(),
  deposit: z.number().nonnegative(),
  /** Spot/offer: offered times. Form links may use an empty array. */
  slotStartISOs: z.array(z.string()).max(5).default([]),
  /** Link expiry (optional). */
  expiresAt: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  /** Spot: calendar hold id; cleared when fulfilled or expired. */
  holdAppointmentId: z.string().optional(),
  /** Client picked slot (spot) or pending confirmation (offer deposit step). */
  pendingSlotISO: z.string().optional(),
  /** Spot/offer: deposit collected (or waived when deposit is 0). */
  depositPaid: z.boolean().optional(),
  spotClaimFirstName: z.string().optional(),
  spotClaimLastName: z.string().optional(),
  spotClaimPhone: z.string().optional()
});
export type BookingLink = z.infer<typeof BookingLinkSchema>;

