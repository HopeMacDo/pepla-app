import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo } from "react";

import MainLayout from "./layout/MainLayout";
import SettingsPage, {
  SettingsHomeSection,
  SettingsNotificationsSection,
  SettingsReportsSection,
  SettingsTransactionsSection
} from "./pages/SettingsPage";
import TodayPage from "./pages/TodayPage";
import IntakeStep from "./steps/IntakeStep";
import CalendarStep from "./steps/CalendarStep";
import CustomerDetailStep from "./steps/CustomerDetailStep";
import CustomersListStep from "./steps/CustomersListStep";
import AdminDashboardStep from "./steps/AdminDashboardStep";
import IntakeDetailStep from "./steps/IntakeDetailStep";
import ClientProposalStep from "./steps/ClientProposalStep";

function RedirectCrmCustomer() {
  const { id } = useParams();
  if (!id) return <Navigate to="/customers" replace />;
  return <Navigate to={`/customers/${id}`} replace />;
}

function RedirectAdminIntake() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const qs = sp.toString();
  if (!id) return <Navigate to="/inbox" replace />;
  return <Navigate to={`/inbox/intake/${id}${qs ? `?${qs}` : ""}`} replace />;
}

function RedirectLegacySettingsIntake() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const qs = sp.toString();
  if (!id) return <Navigate to="/inbox" replace />;
  return <Navigate to={`/inbox/intake/${id}${qs ? `?${qs}` : ""}`} replace />;
}

function RedirectScheduleToCalendar() {
  const [sp] = useSearchParams();
  const qs = sp.toString();
  return <Navigate to={`/calendar${qs ? `?${qs}` : ""}`} replace />;
}

const LEGACY_START: Record<string, string> = {
  intake: "intake",
  calendar: "calendar",
  schedule: "calendar",
  crm: "customers",
  customers: "customers",
  admin: "inbox",
  settings: "settings",
  today: "today",
  inbox: "inbox"
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();

  const initialRoute = useMemo(() => sp.get("start")?.toLowerCase() ?? null, [sp]);
  const clientProposalView = location.pathname.startsWith("/proposal/");

  useEffect(() => {
    if (!initialRoute) return;
    const mapped = LEGACY_START[initialRoute] ?? initialRoute;
    const next = new URLSearchParams(sp);
    next.delete("start");
    const qs = next.toString();
    navigate(`/${mapped}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [initialRoute, navigate, sp]);

  if (clientProposalView) {
    return (
      <div className="min-h-screen bg-[#0c0a08] text-white antialiased">
        <Routes>
          <Route path="/proposal/:id" element={<ClientProposalStep />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/schedule" element={<RedirectScheduleToCalendar />} />

      <Route path="/crm" element={<Navigate to="/customers" replace />} />
      <Route path="/crm/:id" element={<RedirectCrmCustomer />} />
      <Route path="/admin" element={<Navigate to="/inbox" replace />} />
      <Route path="/admin/intake/:id" element={<RedirectAdminIntake />} />

      <Route
        path="/intake"
        element={
          <div className="min-h-screen bg-sand text-slateGrey">
            <div className="mx-auto max-w-5xl px-4 py-8">
              <IntakeStep />
            </div>
          </div>
        }
      />

      <Route path="/" element={<Navigate to="/today" replace />} />

      <Route element={<MainLayout />}>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/inbox" element={<AdminDashboardStep />} />
        <Route path="/inbox/intake/:id" element={<IntakeDetailStep />} />
        <Route path="/calendar" element={<CalendarStep />} />
        <Route path="/customers" element={<CustomersListStep />} />
        <Route path="/customers/:id" element={<CustomerDetailStep />} />
        <Route path="/settings" element={<SettingsPage />}>
          <Route index element={<SettingsHomeSection />} />
          <Route path="transactions" element={<SettingsTransactionsSection />} />
          <Route path="notifications" element={<SettingsNotificationsSection />} />
          <Route path="reports" element={<SettingsReportsSection />} />
        </Route>
        <Route path="/settings/intake/:id" element={<RedirectLegacySettingsIntake />} />
      </Route>

      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
