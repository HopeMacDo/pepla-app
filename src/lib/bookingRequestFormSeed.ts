import type { PersistedFormBlock, SavedForm } from "./savedForms";

export const BOOKING_REQUEST_FORM_ID = "pepla-booking-request";

function newId() {
  return crypto.randomUUID();
}

/** Default form: booking request with intake-compatible availability grid. */
export function createDefaultBookingRequestForm(): SavedForm {
  const now = new Date().toISOString();
  const blocks: PersistedFormBlock[] = [
    {
      id: newId(),
      kind: "title_desc",
      title: "Booking Request",
      description: "Tell us a bit about you and when you’d like to come in. We’ll follow up in your inbox.",
      required: false
    },
    {
      id: newId(),
      kind: "question",
      questionKind: "short_answer",
      prompt: "First name",
      options: ["", ""],
      rowLabels: [""],
      colLabels: ["", ""],
      required: true,
      fieldKey: "firstName"
    },
    {
      id: newId(),
      kind: "question",
      questionKind: "short_answer",
      prompt: "Last name",
      options: ["", ""],
      rowLabels: [""],
      colLabels: ["", ""],
      required: true,
      fieldKey: "lastName"
    },
    {
      id: newId(),
      kind: "question",
      questionKind: "short_answer",
      prompt: "Phone number",
      options: ["", ""],
      rowLabels: [""],
      colLabels: ["", ""],
      required: true,
      fieldKey: "phone"
    },
    {
      id: newId(),
      kind: "question",
      questionKind: "long_answer",
      prompt: "Message / description",
      options: ["", ""],
      rowLabels: [""],
      colLabels: ["", ""],
      required: true,
      fieldKey: "message"
    },
    {
      id: newId(),
      kind: "question",
      questionKind: "checkbox_grid",
      prompt: "When are you generally available?",
      options: ["", ""],
      rowLabels: ["Mornings (9am–12pm)", "Afternoons (12pm–5pm)"],
      colLabels: ["Tue", "Wed", "Thu", "Fri", "Sat"],
      required: true,
      gridRequireEachRow: false,
      gridSyncBusinessHours: true,
      gridColumnDayKeys: ["tue", "wed", "thu", "fri", "sat"],
      fieldKey: "availability"
    }
  ];

  return {
    id: BOOKING_REQUEST_FORM_ID,
    name: "Booking Request",
    createdAt: now,
    updatedAt: now,
    sendResponsesToInbox: true,
    blocks
  };
}
