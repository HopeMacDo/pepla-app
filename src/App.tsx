import { NavLink, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import IntakeStep from "./steps/IntakeStep";
import CalendarStep from "./steps/CalendarStep";
import CustomerDetailStep from "./steps/CustomerDetailStep";
import CustomersListStep from "./steps/CustomersListStep";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function TopNav() {
  const linkBase =
    "px-3 py-2 text-xs tracking-pepla uppercase font-display border-b border-transparent hover:border-slateGrey/30";
  const active = "border-slateGrey/60";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slateGrey/15 bg-sand/80 backdrop-blur supports-[backdrop-filter]:bg-sand/60 sticky top-0 z-10">
      <div className="flex items-center gap-3 px-4 py-3">
        <img src="/logo.svg" alt="Pepla" className="h-8 w-auto" />
        <div className="leading-tight">
          <div className="font-display tracking-pepla text-xs uppercase">Pepla</div>
          <div className="font-body text-sm opacity-80">Booking</div>
        </div>
      </div>
      <div className="flex items-center gap-1 px-4">
        <NavLink to="/intake" className={({ isActive }) => cx(linkBase, isActive && active)}>
          Intake
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => cx(linkBase, isActive && active)}>
          Calendar
        </NavLink>
        <NavLink to="/crm" className={({ isActive }) => cx(linkBase, isActive && active)}>
          Customers
        </NavLink>
      </div>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const initialRoute = useMemo(() => sp.get("start") ?? null, [sp]);

  useEffect(() => {
    if (initialRoute) navigate(`/${initialRoute}`, { replace: true });
  }, [initialRoute, navigate]);

  return (
    <div className="min-h-screen bg-sand text-slateGrey">
      <TopNav />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<IntakeStep />} />
          <Route path="/intake" element={<IntakeStep />} />
          <Route path="/calendar" element={<CalendarStep />} />
          <Route path="/crm" element={<CustomersListStep />} />
          <Route path="/crm/:id" element={<CustomerDetailStep />} />
        </Routes>
      </div>
    </div>
  );
}

