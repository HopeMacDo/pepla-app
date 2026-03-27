import { Card, CardBody } from "../ui/primitives";

const DISPLAY_NAME = "Hope";

const STATS = [
  {
    value: "6",
    label: "Appointments",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" />
      </svg>
    )
  },
  {
    value: "$1,180",
    label: "Est. revenue",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-9h4.5a2.25 2.25 0 010 4.5H9a2.25 2.25 0 100 4.5h7.5" />
      </svg>
    )
  },
  {
    value: "2",
    label: "Walk-ins",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    )
  }
] as const;

const APPOINTMENTS = [
  { firstName: "Alex", service: "Full balayage", time: "9:00 AM" },
  { firstName: "Jordan", service: "Cut & color", time: "11:30 AM" },
  { firstName: "Sam", service: "Express root touch-up", time: "2:00 PM" },
  { firstName: "Riley", service: "Blowout & style", time: "4:15 PM" },
  { firstName: "Casey", service: "Consultation", time: "5:30 PM" }
] as const;

function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatTodayLong(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(d);
}

export default function TodayPage() {
  const now = new Date();
  const greeting = greetingForHour(now.getHours());

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-body text-2xl font-normal text-slateGrey sm:text-3xl">
          {greeting}, {DISPLAY_NAME}
        </h1>
        <p className="font-body text-sm text-slateGrey/60 sm:text-base">{formatTodayLong(now)}</p>
      </header>

      <section aria-labelledby="today-stats-heading" className="space-y-3">
        <h2 id="today-stats-heading" className="sr-only">
          Today at a glance
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {STATS.map(({ value, label, icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-slateGrey/15 bg-white/55 px-5 py-4 shadow-pepla"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-3xl tabular-nums tracking-tight text-slateGrey sm:text-4xl">{value}</p>
                  <p className="mt-1.5 font-display text-[11px] uppercase tracking-pepla text-slateGrey/65">{label}</p>
                </div>
                <span className="shrink-0 text-slateGrey/35">{icon}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="today-appointments-heading" className="space-y-3">
        <h2
          id="today-appointments-heading"
          className="font-display text-xs uppercase tracking-pepla text-slateGrey/70"
        >
          Today&apos;s appointments
        </h2>
        <Card>
          <CardBody className="pt-6">
            <ul className="divide-y divide-slateGrey/12" role="list">
              {APPOINTMENTS.map((row) => (
                <li
                  key={`${row.firstName}-${row.time}`}
                  className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-body text-[15px] text-slateGrey">
                      <span className="font-medium">{row.firstName}</span>
                      <span className="text-slateGrey/50"> · </span>
                      <span className="text-slateGrey/85">{row.service}</span>
                    </p>
                  </div>
                  <p className="shrink-0 font-body text-sm tabular-nums text-slateGrey/60 sm:text-right">{row.time}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
