import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  ActivityIcon,
  ApplicantsIcon,
  CalendarIcon,
  ChevronLeftIcon,
  CloseIcon,
  DashboardIcon,
  MailIcon,
  PatientsIcon,
  StaffIcon,
  TodoIcon,
  TrafficIcon,
} from "../ui/icons"
import { canOpen } from "../staff/roles"
import { isNewMessage } from "../messages/recentMessages"
import { useContactMessages } from "../messages/useContactMessages"

// `page` keys into roles.js, which mirrors firestore.rules rather than adding
// a second source of truth: someone following a URL directly is still refused
// by Firestore (and by the route guard); this keeps links they can't use out
// of their sidebar.
const NAV_ITEMS = [
  { label: "Dashboard", icon: DashboardIcon, to: "/admin", page: "dashboard" },
  // Intake submissions awaiting admit/decline. Admitting one starts their
  // chart under Patients.
  { label: "Applicants", icon: ApplicantsIcon, to: "/admin/applicants", page: "applicants" },
  { label: "Patients", icon: PatientsIcon, to: "/admin/patients", page: "patients" },
  { label: "To-do", icon: TodoIcon, to: "/admin/todo", page: "todo" },
  { label: "Calendar", icon: CalendarIcon, to: "/admin/calendar", page: "calendar" },
  { label: "Queries", icon: MailIcon, to: "/admin/queries", page: "messages" },
  { label: "Analytics", icon: TrafficIcon, to: "/admin/analytics", page: "analytics" },
  { label: "Staff", icon: StaffIcon, to: "/admin/staff", page: "staff" },
  { label: "Activity", icon: ActivityIcon, to: "/admin/activity", page: "activity" },
]

// Shared by every collapsible label (nav items, the brand wordmark, footer
// rows). display:none (what a plain `lg:hidden` toggle uses) can't be
// transitioned by CSS at all — it just pops — so this fades opacity and
// collapses max-width instead, both of which animate properly. Paired with
// a constant justify-content on the parent row (never swapped for
// justify-center) so icons don't jump sideways either — that property can't
// animate smoothly any more than display can.
function collapsibleLabelClass(collapsed, maxWidthClass = "lg:max-w-40") {
  return `overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out-smooth ${
    collapsed ? "lg:max-w-0 lg:opacity-0" : `${maxWidthClass} lg:opacity-100`
  }`
}

export default function Sidebar({
  role,
  messagesViewedAt = 0,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}) {
  const location = useLocation()

  // Live — useContactMessages subscribes rather than fetching once, unlike
  // every other list in this admin, so a message submitted elsewhere while
  // this admin is signed in still updates the badge without a reload. `now`
  // is still a fixed mount-time snapshot (a bare Date.now() in the render
  // body would be an impure call during render) — it only needs to be
  // roughly current for the 24-hour window, not live-ticking.
  // messagesViewedAt, by contrast, IS a live prop — it comes from AdminApp
  // and updates the moment the Messages page marks itself viewed, so this
  // count drops to zero without a reload either.
  const { messages } = useContactMessages({ enabled: canOpen("messages", role) })
  const [now] = useState(() => Date.now())
  const newMessageCount = messages?.filter((message) => isNewMessage(message, now, messagesViewedAt)).length ?? 0

  return (
    <>
      {/* Mobile scrim. Hidden from assistive tech; the panel below owns focus. */}
      <div
        aria-hidden="true"
        onClick={onCloseMobile}
        className={`fixed inset-0 z-30 bg-scrim/50 transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Collapsing is a desktop affordance, so every collapsed style is
          lg-scoped: the mobile drawer is always full width with full labels,
          whatever the saved desktop state is. */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-950/10 bg-white transition-[width,transform] duration-300 ease-out-smooth ${
          collapsed ? "lg:w-18" : "lg:w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-ink-950/10 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {/* The real Corephia infinity mark, in its original colours —
                cropped from cp-logo.webp. CLAUDE.md keeps this logo's orange
                off the public marketing site pending an orange-free asset
                from the client, but this admin is internal-only (noindex,
                nofollow, never linked from the public site), so it's shown
                as-is here rather than flattened to one colour. Always
                visible, and always at the same position — the row's
                justify-content never changes, so the icon doesn't shift
                sideways as the label beside it collapses away. */}
            <img src="/cp-mark.webp" alt="" className="size-7 shrink-0 object-contain" />

            <div className={`min-w-0 ${collapsibleLabelClass(collapsed)}`}>
              <p className="truncate font-serif text-base leading-none text-ink-950">CorePhia Admin</p>
              
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="shrink-0 rounded-lg p-1.5 text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 lg:hidden"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <nav aria-label="Admin" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {NAV_ITEMS.filter((item) => canOpen(item.page, role)).map((item) => {
              // A chart (/admin/patients/:id) keeps Patients highlighted.
              const current =
                location.pathname === item.to || (item.to !== "/admin" && location.pathname.startsWith(`${item.to}/`))
              const count = item.to === "/admin/queries" ? newMessageCount : 0
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    aria-current={current ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={onCloseMobile}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                      current
                        ? "bg-accent-dark text-oncolor"
                        : "text-ink-950/70 hover:bg-ink-950/5 hover:text-ink-950"
                    }`}
                  >
                    {/* Two shapes for one count, swapped by width: the collapsed rail has no
                        room for a number beside the icon, so it degrades to a
                        dot on the icon's corner. On the active row the pill
                        inverts — an accent badge on the accent fill would be
                        invisible. */}
                    <span className="relative shrink-0">
                      <item.icon className="size-5" />
                      {count > 0 && (
                        <span
                          className={`absolute -top-0.5 -right-0.5 hidden size-2 rounded-full ring-2 ${
                            current ? "bg-oncolor ring-accent-dark" : "bg-accent-dark ring-white"
                          } ${collapsed ? "lg:block" : ""}`}
                        />
                      )}
                    </span>
                    <span className={collapsibleLabelClass(collapsed, "lg:max-w-28")}>{item.label}</span>
                    {count > 0 && (
                      <span
                        className={`ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                          current ? "bg-oncolor text-accent-dark" : "bg-accent-dark text-oncolor"
                        } ${collapsed ? "lg:hidden" : ""}`}
                      >
                        {count > 9 ? "9+" : count}
                        <span className="sr-only"> new</span>
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Collapsing is a desktop affordance (see the note above on the
            sidebar's own width classes), so this row never shows on the
            mobile drawer. The theme switch and the account (profile,
            password, sign out) live top right: ThemeSwitch.jsx and
            AccountMenu.jsx. */}
        <div className="hidden border-t border-ink-950/10 p-3 lg:block">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
          >
            <ChevronLeftIcon
              className={`size-5 shrink-0 transition-transform duration-300 ease-out-smooth ${
                collapsed ? "rotate-180" : ""
              }`}
            />
            <span className={collapsibleLabelClass(collapsed, "lg:max-w-28")}>Collapse</span>
          </button>
        </div>
      </div>
    </>
  )
}
