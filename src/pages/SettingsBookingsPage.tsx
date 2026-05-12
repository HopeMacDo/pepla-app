import { NavLink, Navigate, useNavigate, useParams } from "react-router-dom";
import BusinessHoursSettingsPanel from "../components/BusinessHoursSettingsPanel";
import OnlineBookingSettingsPanel from "../components/OnlineBookingSettingsPanel";
import { Card, CardBody, CardHeader } from "../ui/primitives";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const BOOKINGS_MENU = [
  { slug: "business-hours", label: "Business Hours" },
  { slug: "my-notifications", label: "My Notifications" },
  { slug: "customer-notifications", label: "Customer Notifications" },
  { slug: "online-booking", label: "Online Booking" }
] as const;

type BookingSlug = (typeof BOOKINGS_MENU)[number]["slug"];

function isBookingSlug(s: string | undefined): s is BookingSlug {
  return BOOKINGS_MENU.some((item) => item.slug === s);
}

export default function SettingsBookingsPage() {
  const navigate = useNavigate();
  const linkBase =
    "flex items-center gap-3 rounded-xl border border-slateGrey/15 bg-white/40 px-4 py-3 font-display text-xs uppercase tracking-pepla text-slateGrey transition hover:border-slateGrey/25 hover:bg-white/70";
  const linkActive = "border-sky/50 bg-sky text-slateGrey shadow-pepla hover:bg-sky/90 hover:text-slateGrey";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
          aria-label="Back to settings"
          onClick={() => navigate("/settings")}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">Bookings</h1>
      </div>
      <nav className="max-w-md space-y-1.5" aria-label="Booking settings">
        {BOOKINGS_MENU.map(({ slug, label }) => (
          <NavLink
            key={slug}
            to={`/settings/bookings/${slug}`}
            className={({ isActive }) => cx(linkBase, isActive && linkActive)}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function SettingsBookingsSubPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  if (!isBookingSlug(slug)) {
    return <Navigate to="/settings/bookings" replace />;
  }

  if (slug === "business-hours") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
            aria-label="Back to Bookings"
            onClick={() => navigate("/settings/bookings")}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">Business Hours</h1>
        </div>
        <BusinessHoursSettingsPanel />
      </div>
    );
  }

  if (slug === "online-booking") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
            aria-label="Back to Bookings"
            onClick={() => navigate("/settings/bookings")}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">Online Booking</h1>
        </div>
        <OnlineBookingSettingsPanel />
      </div>
    );
  }

  const titles: Record<Exclude<BookingSlug, "business-hours" | "online-booking">, string> = {
    "my-notifications": "My Notifications",
    "customer-notifications": "Customer Notifications"
  };

  const blurbs: Record<Exclude<BookingSlug, "business-hours" | "online-booking">, string> = {
    "my-notifications": "Choose how you are alerted about new requests, changes, and reminders.",
    "customer-notifications": "Control confirmation messages, reminders, and follow-ups clients receive."
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slateGrey/20 text-slateGrey transition hover:bg-slateGrey/5"
          aria-label="Back to Bookings"
          onClick={() => navigate("/settings/bookings")}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">{titles[slug]}</h1>
      </div>
      <Card className="min-w-0 max-w-xl flex-1">
        <CardHeader>
          <h2 className="font-display text-lg uppercase tracking-pepla text-slateGrey">{titles[slug]}</h2>
          <p className="mt-1 font-body text-sm text-slateGrey/65">{blurbs[slug]}</p>
        </CardHeader>
        <CardBody className="pt-0 font-body text-sm text-slateGrey/70">Coming soon.</CardBody>
      </Card>
    </div>
  );
}
