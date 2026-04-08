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
  slotStartISOs: z.array(z.string()).min(1),
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
  bookingDetails: InboxBookingDetailsSchema.optional()
});
export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;

/** Inbox thread aggregate — persisted as an intake row in IndexedDB. */
export const InboxThreadSchema = IntakeRequestSchema;
export type InboxThread = IntakeRequest;

export const AppointmentSchema = z.object({
  id: z.string(),
  startISO: z.string(),
  endISO: z.string(),
  kind: z.enum(["appointment", "block"]).default("appointment"),
  customerId: z.string().optional(),
  customerName: z.string().min(1),
  phoneNumber: z.string().optional(),
  serviceName: z.string().optional(),
  price: z.number().nonnegative().optional(),
  notes: z.string().optional()
});
export type Appointment = z.infer<typeof AppointmentSchema>;

