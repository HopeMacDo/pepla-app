import { z } from "zod";

export const IntakeRequestSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  customerName: z.string().min(1),
  phoneNumber: z.string().min(1),
  availability: z.string().min(1),
  photoDataUrls: z.array(z.string()).default([])
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

