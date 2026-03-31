import { NavLink, Outlet, useMatch } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../ui/primitives";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const MENU = [
  {
    to: "transactions",
    label: "Transactions",
    icon: (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-9h4.5a2.25 2.25 0 010 4.5H9a2.25 2.25 0 100 4.5h7.5" />
      </svg>
    )
  },
  {
    to: "notifications",
    label: "Notifications",
    icon: (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
    )
  },
  {
    to: "reports",
    label: "Reports",
    icon: (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    )
  }
] as const;

const TRANSACTION_ROWS = [
  { id: "tx-8841", date: "Mar 24, 2025", description: "Client payment — Jordan Lee", amount: 185, status: "Paid" as const },
  { id: "tx-8836", date: "Mar 23, 2025", description: "Stripe payout", amount: -1200, status: "Transfer" as const },
  { id: "tx-8828", date: "Mar 22, 2025", description: "Client payment — Sam Rivera", amount: 95, status: "Paid" as const },
  { id: "tx-8811", date: "Mar 20, 2025", description: "Refund — partial color", amount: -45, status: "Refund" as const },
  { id: "tx-8799", date: "Mar 18, 2025", description: "Client payment — Alex Kim", amount: 240, status: "Paid" as const }
] as const;

const NOTIFICATION_ITEMS = [
  {
    id: "n1",
    title: "New booking request",
    body: "Morgan P. requested Full balayage on Sat, Mar 29 at 10:00 AM.",
    time: "12 min ago",
    unread: true
  },
  {
    id: "n2",
    title: "Booking confirmed",
    body: "Riley Chen’s Cut & color on Fri, Mar 28 is confirmed.",
    time: "2 hr ago",
    unread: true
  },
  {
    id: "n3",
    title: "Reminder sent",
    body: "Automatic reminder sent to Casey Liu for tomorrow’s consultation.",
    time: "Yesterday",
    unread: false
  },
  {
    id: "n4",
    title: "Cancellation",
    body: "Jamie W. cancelled their Mon, Mar 31 appointment.",
    time: "Yesterday",
    unread: false
  }
] as const;

const MONTHLY_REPORT = [
  { month: "Oct", earnings: 4200 },
  { month: "Nov", earnings: 5100 },
  { month: "Dec", earnings: 6800 },
  { month: "Jan", earnings: 5950 },
  { month: "Feb", earnings: 7200 },
  { month: "Mar", earnings: 6400 }
] as const;

function SettingsMenu() {
  const linkBase =
    "flex items-center gap-3 rounded-xl border border-slateGrey/15 bg-white/40 px-4 py-3 font-display text-xs uppercase tracking-pepla text-slateGrey transition hover:border-slateGrey/25 hover:bg-white/70";
  const linkActive = "border-slateGrey/30 bg-slateGrey text-chalk shadow-pepla hover:bg-slateGrey hover:text-chalk";

  return (
    <nav className="space-y-1.5" aria-label="Settings sections">
      {MENU.map(({ to, label, icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => cx(linkBase, isActive && linkActive)} end={false}>
          {icon}
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function formatMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString()}`;
}

export function SettingsTransactionsSection() {
  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <h2 className="font-display text-lg uppercase tracking-pepla text-slateGrey">Transaction history</h2>
        <p className="mt-1 font-body text-sm text-slateGrey/65">Sample activity for this workspace (demo data).</p>
      </CardHeader>
      <CardBody className="overflow-x-auto pt-0">
        <table className="w-full min-w-[32rem] border-collapse text-left font-body text-sm">
          <thead>
            <tr className="border-b border-slateGrey/15 text-[11px] uppercase tracking-pepla text-slateGrey/55">
              <th className="pb-3 pr-4 font-display font-normal">Date</th>
              <th className="pb-3 pr-4 font-display font-normal">Description</th>
              <th className="pb-3 pr-4 font-display font-normal">Reference</th>
              <th className="pb-3 pr-4 text-right font-display font-normal">Amount</th>
              <th className="pb-3 font-display font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="text-slateGrey">
            {TRANSACTION_ROWS.map((row) => (
              <tr key={row.id} className="border-b border-slateGrey/10 last:border-0">
                <td className="py-3 pr-4 align-top text-slateGrey/80">{row.date}</td>
                <td className="py-3 pr-4 align-top">{row.description}</td>
                <td className="py-3 pr-4 align-top font-mono text-xs text-slateGrey/60">{row.id}</td>
                <td className="py-3 pr-4 align-top text-right tabular-nums">{formatMoney(row.amount)}</td>
                <td className="py-3 align-top">
                  <span
                    className={cx(
                      "inline-block rounded-full px-2 py-0.5 font-display text-[10px] uppercase tracking-pepla",
                      row.status === "Paid" && "bg-skyBlue/40 text-slateGrey",
                      row.status === "Transfer" && "bg-slateGrey/10 text-slateGrey/80",
                      row.status === "Refund" && "bg-deepRed/15 text-deepRed"
                    )}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

export function SettingsNotificationsSection() {
  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <h2 className="font-display text-lg uppercase tracking-pepla text-slateGrey">Booking notifications</h2>
        <p className="mt-1 font-body text-sm text-slateGrey/65">Recent alerts tied to your calendar (demo data).</p>
      </CardHeader>
      <CardBody className="space-y-3 pt-0">
        <ul className="divide-y divide-slateGrey/10 rounded-xl border border-slateGrey/15 bg-sand/30">
          {NOTIFICATION_ITEMS.map((n) => (
            <li key={n.id} className="flex gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl">
              <span
                className={cx(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  n.unread ? "bg-slateGrey" : "bg-slateGrey/25"
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-xs uppercase tracking-pepla text-slateGrey">{n.title}</h3>
                  <time className="font-body text-xs text-slateGrey/50">{n.time}</time>
                </div>
                <p className="mt-1 font-body text-sm text-slateGrey/80">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export function SettingsReportsSection() {
  const max = Math.max(...MONTHLY_REPORT.map((m) => m.earnings));

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <h2 className="font-display text-lg uppercase tracking-pepla text-slateGrey">Monthly earnings</h2>
        <p className="mt-1 font-body text-sm text-slateGrey/65">Last six months — illustrative report (demo data).</p>
      </CardHeader>
      <CardBody className="space-y-8 pt-0">
        <div>
          <p className="mb-4 font-display text-[11px] uppercase tracking-pepla text-slateGrey/55">Revenue by month</p>
          <div className="flex gap-2 sm:gap-3" role="img" aria-label="Bar chart of monthly earnings">
            {MONTHLY_REPORT.map(({ month, earnings }) => {
              const h = Math.round((earnings / max) * 100);
              return (
                <div key={month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-44 w-full items-end justify-center border-b border-slateGrey/15">
                    <div
                      className="w-[72%] max-w-full min-h-[4px] rounded-t-md bg-slateGrey/85"
                      style={{ height: `${h}%` }}
                      title={`${month}: $${earnings.toLocaleString()}`}
                    />
                  </div>
                  <span className="font-display text-[10px] uppercase tracking-pepla text-slateGrey/60">{month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-4 font-display text-[11px] uppercase tracking-pepla text-slateGrey/55">Detail</p>
          <div className="overflow-x-auto rounded-xl border border-slateGrey/15 bg-sand/30">
            <table className="w-full min-w-[20rem] border-collapse text-left font-body text-sm">
              <thead>
                <tr className="border-b border-slateGrey/15 text-[11px] uppercase tracking-pepla text-slateGrey/55">
                  <th className="px-4 py-3 font-display font-normal">Month</th>
                  <th className="px-4 py-3 text-right font-display font-normal">Gross</th>
                  <th className="px-4 py-3 text-right font-display font-normal">Avg / day</th>
                </tr>
              </thead>
              <tbody className="text-slateGrey">
                {MONTHLY_REPORT.map(({ month, earnings }) => (
                  <tr key={month} className="border-b border-slateGrey/10 last:border-0">
                    <td className="px-4 py-3 text-slateGrey/80">{month} 2024–25</td>
                    <td className="px-4 py-3 text-right tabular-nums">${earnings.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slateGrey/70">
                      ${Math.round(earnings / 22).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-white/40 font-medium">
                  <td className="px-4 py-3 font-display text-[11px] uppercase tracking-pepla">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    ${MONTHLY_REPORT.reduce((s, m) => s + m.earnings, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slateGrey/50">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/** Index route: no detail panel; layout hides the outlet column on `/settings`. */
export function SettingsHomeSection() {
  return null;
}

export default function SettingsPage() {
  const atSettingsRoot = useMatch({ path: "/settings", end: true });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl uppercase tracking-pepla text-slateGrey sm:text-3xl">Settings</h1>
        <p className="mt-1 max-w-xl font-body text-sm text-slateGrey/65">Manage reports, money movement, and alerts.</p>
      </header>

      <div
        className={cx(
          "flex flex-col gap-6 lg:items-start",
          atSettingsRoot ? "" : "lg:flex-row"
        )}
      >
        <aside className={cx("shrink-0", atSettingsRoot ? "w-full max-w-sm" : "lg:w-56")}>
          <SettingsMenu />
        </aside>
        <div className={cx("min-w-0", atSettingsRoot ? "hidden" : "flex-1")}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
