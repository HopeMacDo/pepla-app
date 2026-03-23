import { z } from "zod";

export const IntakeStatusSchema = z.enum(["requests", "accepted", "upcoming"]);
export type IntakeStatus = z.infer<typeof IntakeStatusSchema>;

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

export const IntakeRequestSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  customerName: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().min(1),
  vision: z.string().optional(),
  availability: z.string().min(1),
  availabilitySelections: IntakeAvailabilitySchema.optional(),
  photoDataUrls: z.array(z.string()).default([]),
  status: IntakeStatusSchema.default("requests")
});
export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;

export const AppointmentSchema = z.object({
  id: z.string(),
  startISO: z.string(),
  endISO: z.string(),
  customerId: z.string().optional(),
  customerName: z.string().min(1),
  phoneNumber: z.string().optional(),
  notes: z.string().optional()
});
export type Appointment = z.infer<typeof AppointmentSchema>;

