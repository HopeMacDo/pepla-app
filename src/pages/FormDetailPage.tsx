import { Navigate, NavLink, Outlet, useParams } from "react-router-dom";
import { getSavedForm } from "../lib/savedForms";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const tabClass =
  "rounded-lg px-3 py-2 font-display text-[11px] uppercase tracking-pepla text-slateGrey/70 transition hover:bg-slateGrey/10 hover:text-slateGrey";
const tabActive = "bg-slateGrey/10 text-slateGrey";

export type FormDetailOutletContext = {
  embeddedInFormDetail: true;
};

export default function FormDetailPage() {
  const { formId } = useParams<{ formId: string }>();
  if (!formId || formId === "new") {
    return <Navigate to="/settings/forms" replace />;
  }

  const saved = getSavedForm(formId);
  if (!saved) {
    return <Navigate to="/settings/forms" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <NavLink
            to="/settings/forms"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slateGrey transition hover:bg-slateGrey/5"
            aria-label="Back to forms"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </NavLink>
          <div className="min-w-0">
            <h1 className="font-display text-2xl tracking-pepla text-slateGrey sm:text-3xl">{saved.name || "Untitled form"}</h1>
          </div>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slateGrey/15 pb-px" aria-label="Form sections">
        <NavLink
          to="submissions"
          className={({ isActive }) => cx(tabClass, isActive && tabActive)}
        >
          Submissions
        </NavLink>
        <NavLink
          to="preview"
          className={({ isActive }) => cx(tabClass, isActive && tabActive)}
        >
          Preview
        </NavLink>
        <NavLink to="edit" className={({ isActive }) => cx(tabClass, isActive && tabActive)}>
          Edit
        </NavLink>
      </nav>

      <Outlet context={{ embeddedInFormDetail: true } satisfies FormDetailOutletContext} />
    </div>
  );
}
