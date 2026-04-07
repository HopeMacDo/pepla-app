import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo } from "react";

import MainLayout from "./layout/MainLayout";
import SettingsPage, { SettingsSectionPage } from "./pages/SettingsPage";
import FormDetailPage from "./pages/FormDetailPage";
import FormEditorPage from "./pages/FormEditorPage";
import FormPreviewTab from "./pages/FormPreviewTab";
import FormSubmissionsTab from "./pages/FormSubmissionsTab";
import TodayPage from "./pages/TodayPage";
import IntakeStep from "./steps/IntakeStep";
import CalendarStep from "./steps/CalendarStep";
import CalendarNewBookingPage from "./pages/CalendarNewBookingPage";
import CalendarBlockTimePage from "./pages/CalendarBlockTimePage";
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
          <div className="min-h-screen bg-chalk text-slateGrey">
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
        <Route path="/calendar/new" element={<CalendarNewBookingPage />} />
        <Route path="/calendar/block" element={<CalendarBlockTimePage />} />
        <Route path="/customers" element={<CustomersListStep />} />
        <Route path="/customers/:id" element={<CustomerDetailStep />} />
        <Route path="/settings/intake/:id" element={<RedirectLegacySettingsIntake />} />
        <Route path="/settings/forms/new" element={<FormEditorPage />} />
        <Route path="/settings/forms/:formId" element={<FormDetailPage />}>
          <Route index element={<Navigate to="submissions" replace />} />
          <Route path="submissions" element={<FormSubmissionsTab />} />
          <Route path="preview" element={<FormPreviewTab />} />
          <Route path="edit" element={<FormEditorPage />} />
        </Route>
        <Route path="/settings/:section" element={<SettingsSectionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
