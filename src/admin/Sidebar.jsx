import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import ConfirmDialog from "./ConfirmDialog"
import {
  ActivityIcon,
  ChevronLeftIcon,
  CloseIcon,
  DashboardIcon,
  MailIcon,
  PatientsIcon,
  PersonIcon,
  SignOutIcon,
} from "./icons"
import { signOutAdmin } from "./firebase"
import { isNewMessage } from "./recentMessages"
import { useContactMessages } from "./useContactMessages"

// `superAdminOnly` mirrors firestore.rules rather than adding a second source
// of truth: a plain admin following the URL directly still gets refused by
// Firestore, this just keeps a link they can't use out of their sidebar.
const NAV_ITEMS = [
  { label: "Dashboard", icon: DashboardIcon, to: "/admin" },
  { label: "Patients", icon: PatientsIcon, to: "/admin/patients" },
  { label: "Messages", icon: MailIcon, to: "/admin/messages" },
  { label: "Activity", icon: ActivityIcon, to: "/admin/activity", superAdminOnly: true },
]

const ROLE_LABELS = {
  superAdmin: "Super admin",
  admin: "Admin",
}

function roleLabel(role) {
  return ROLE_LABELS[role] ?? "No role assigned"
}

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
  user,
  role,
  displayName,
  messagesViewedAt = 0,
  theme,
  onToggleTheme,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  onSignOut = signOutAdmin,
}) {
  const location = useLocation()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const accountLabel = displayName || user?.email || "Demo admin (preview)"

  // Live — useContactMessages subscribes rather than fetching once, unlike
  // every other list in this admin, so a message submitted elsewhere while
  // this admin is signed in still updates the badge without a reload. `now`
  // is still a fixed mount-time snapshot (a bare Date.now() in the render
  // body would be an impure call during render) — it only needs to be
  // roughly current for the 24-hour window, not live-ticking.
  // messagesViewedAt, by contrast, IS a live prop — it comes from AdminApp
  // and updates the moment the Messages page marks itself viewed, so this
  // count drops to zero without a reload either.
  const { messages } = useContactMessages()
  const [now] = useState(() => Date.now())
  const newMessageCount = messages?.filter((message) => isNewMessage(message, now, messagesViewedAt)).length ?? 0

  return (
    <>
      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out of Corephia Admin?"
        description="You'll need to sign in again to view patient records."
        confirmLabel="Sign out"
        onConfirm={() => {
          setConfirmingSignOut(false)
          onSignOut()
        }}
        onCancel={() => setConfirmingSignOut(false)}
      />

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
              <p className="truncate font-serif text-base leading-none text-ink-950">Corephia Admin</p>
              
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
            {NAV_ITEMS.filter((item) => !item.superAdminOnly || role === "superAdmin").map((item) => {
              const current = location.pathname === item.to
              const count = item.to === "/admin/messages" ? newMessageCount : 0
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
                    {/* Two shapes for one count, swapped by width the same way
                        the theme control below is: the collapsed rail has no
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

        <div className="border-t border-ink-950/10 p-3">
          {/* Two controls for one setting, swapped by width rather than by
              a JS branch: `collapsed` is a desktop-only state (the mobile
              drawer is always full width), so the switch has to stay put
              below lg even when collapsed is true. The collapsed rail is
              72px wide — 24px of it usable once the paddings are taken out
              — which no pill switch fits, so it falls back to a plain icon
              button there, like every other row in the rail.

              A <label> rather than a <button> — it wraps a real checkbox
              (see index.css's .theme-toggle rules), and interactive content
              like an <input> can't legally nest inside a <button>. */}
          <label
            htmlFor="admin-theme-toggle"
            className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            <span className="theme-toggle shrink-0" data-mode={theme}>
              <span className="theme-toggle__wrap">
                <input
                  id="admin-theme-toggle"
                  className="theme-toggle__input"
                  type="checkbox"
                  role="switch"
                  checked={theme === "dark"}
                  onChange={onToggleTheme}
                />
                <span className="theme-toggle__icon" aria-hidden="true">
                  <span className="theme-toggle__icon-part" />
                  <span className="theme-toggle__icon-part" />
                  <span className="theme-toggle__icon-part" />
                  <span className="theme-toggle__icon-part" />
                  <span className="theme-toggle__icon-part" />
                  <span className="theme-toggle__icon-part" />
                  <span className="theme-toggle__icon-part" />
                  <span className="theme-toggle__icon-part" />
                  <span className="theme-toggle__icon-part" />
                </span>
              </span>
            </span>
          
          </label>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={`hidden w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 hover:bg-ink-950/5 ${
              collapsed ? "lg:flex" : ""
            }`}
          >
            <span className="theme-knob shrink-0" data-mode={theme}>
              <span className="theme-toggle__icon" aria-hidden="true">
                <span className="theme-toggle__icon-part" />
                <span className="theme-toggle__icon-part" />
                <span className="theme-toggle__icon-part" />
                <span className="theme-toggle__icon-part" />
                <span className="theme-toggle__icon-part" />
                <span className="theme-toggle__icon-part" />
                <span className="theme-toggle__icon-part" />
                <span className="theme-toggle__icon-part" />
                <span className="theme-toggle__icon-part" />
              </span>
            </span>
          </button>

          {/* Collapsing is a desktop affordance (see the note above on the
              sidebar's own width classes), so this never renders on the
              mobile drawer. */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="mt-1 hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 lg:flex"
          >
            <ChevronLeftIcon
              className={`size-5 shrink-0 transition-transform duration-300 ease-out-smooth ${
                collapsed ? "rotate-180" : ""
              }`}
            />
            <span className={collapsibleLabelClass(collapsed, "lg:max-w-28")}>Collapse</span>
          </button>

          {/* The account row doubles as the way into this account's own
              settings — the conventional place to look for them, and it keeps
              a per-account page out of the main nav, which lists data
              sections. */}
          <Link
            to="/admin/security"
            onClick={onCloseMobile}
            title={collapsed && user ? `${accountLabel} — ${roleLabel(role)}` : undefined}
            className="mt-1 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-ink-950/5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-100 text-ink-950/70">
              <PersonIcon className="size-4" />
            </span>
            <div className={`min-w-0 flex-1 ${collapsibleLabelClass(collapsed)}`}>
              <p className="truncate text-sm font-medium text-ink-950">{accountLabel}</p>
              <p className={`truncate text-xs ${role ? "text-ink-950/50" : "text-brand-dark"}`}>
                {roleLabel(role)}
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setConfirmingSignOut(true)}
            title={collapsed ? "Sign out" : undefined}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
          >
            <SignOutIcon className="size-5 shrink-0" />
            <span className={collapsibleLabelClass(collapsed, "lg:max-w-28")}>Sign out</span>
          </button>
        </div>
      </div>
    </>
  )
}
