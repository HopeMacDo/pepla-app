# Pepla Booking (MVP)

Three-step booking flow for an independent tattoo artist, styled to the Pepla brand guidelines.

## Run locally

```bash
cd pepla-booking
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Data

- Customers are read and written via Supabase (`lib/supabase.ts`, `lib/customers.ts`).
- Intake requests and appointments are stored locally in IndexedDB.

