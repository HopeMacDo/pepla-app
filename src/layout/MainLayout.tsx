import { NavLink, Outlet, useLocation } from "react-router-dom";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const NAV_ITEMS = [
  { to: "/today", label: "Today" },
  { to: "/inbox", label: "Inbox" },
  { to: "/calendar", label: "Calendar" },
  { to: "/customers", label: "Customers" },
  { to: "/settings", label: "Settings" }
] as const;

export default function MainLayout() {
  const { pathname } = useLocation();
  const sidebarLink =
    "block rounded-lg border border-transparent px-3 py-2.5 font-display text-xs uppercase tracking-pepla transition hover:border-slateGrey/15 hover:bg-white/50";
  const sidebarInactive = "text-slateGrey";
  const sidebarActive =
    "border-slateGrey/20 bg-slateGrey text-white shadow-pepla hover:bg-slateGrey hover:text-white";
  const bottomLink =
    "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center px-1.5 py-2 text-center font-display text-[10px] uppercase tracking-pepla leading-tight text-slateGrey transition sm:text-xs";
  const bottomActive = "bg-white/65 text-slateGrey";

  return (
    <div className="min-h-screen bg-sand text-slateGrey">
      <aside
        className={cx(
          "fixed left-0 top-0 z-20 flex h-screen w-56 flex-col border-r border-slateGrey/15 bg-sand/95 backdrop-blur",
          "supports-[backdrop-filter]:bg-sand/80",
          "hidden sm:flex"
        )}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slateGrey/15 px-4 py-4">
          <img src="/logo.svg" alt="Pepla" className="h-8 w-auto" />
          <div className="min-w-0 leading-tight">
            <div className="font-display text-xs uppercase tracking-pepla">Pepla</div>
            <div className="font-body text-sm opacity-80">Booking</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Main">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cx(
                  sidebarLink,
                  isActive || (to === "/calendar" && pathname.startsWith("/calendar")) ? sidebarActive : sidebarInactive
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col sm:pl-56">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-8 sm:pb-8">
          <Outlet />
        </main>
      </div>

      <nav
        className={cx(
          "fixed bottom-0 left-0 right-0 z-20 flex border-t border-slateGrey/15 bg-sand/95 backdrop-blur pb-[env(safe-area-inset-bottom)]",
          "supports-[backdrop-filter]:bg-sand/80",
          "sm:hidden"
        )}
        aria-label="Main"
      >
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cx(bottomLink, (isActive || (to === "/calendar" && pathname.startsWith("/calendar"))) && bottomActive)
            }
          >
            <span className="max-w-[4.5rem]">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
