import { useCallback, useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Navigate, Route, Routes } from "react-router-dom"
import AccountMenu from "./layout/AccountMenu"
import Activity from "./staff/Activity"
import Calendar from "./calendar/Calendar"
import Dashboard from "./dashboard/Dashboard"
import { getAdminAccess, isConfigured, recordSignIn, signOutAdmin, usingSeedData, watchAdminUser } from "./lib/firebase"
import IdleWarningModal from "./layout/IdleWarningModal"
import { MenuIcon } from "./ui/icons"
import Loader from "./ui/Loader"
import Login from "./layout/Login"
import Messages from "./messages/Messages"
import Applicants from "./applicants/Applicants"
import PatientChart from "./patients/PatientChart"
import Patients from "./patients/Patients"
import { ROLE_LABELS, canOpen } from "./staff/roles"
import Staff from "./staff/Staff"
import ThemeSwitch from "./layout/ThemeSwitch"
import Todo from "./patients/Todo"
import { readLastViewedMessagesAt, writeLastViewedMessagesAt } from "./messages/recentMessages"
import Security from "./staff/Security"
import Sidebar from "./layout/Sidebar"
import SiteTraffic from "./analytics/SiteTraffic"
import { useAdminTheme } from "./lib/useAdminTheme"
import { useIdleTimeout } from "./lib/useIdleTimeout"

// Chart access sits behind these two on top of the password: idle staff get
// signed out automatically rather than leaving an open session on a shared
// or unattended machine for however long the browser tab stays open.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const IDLE_WARNING_MS = 60 * 1000

// A page the role can't open shows this instead of loading data the rules
// would refuse anyway (the sidebar already hides its link).
function Guard({ page, role, children }) {
  if (canOpen(page, role)) return children
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
        <p className="font-serif text-2xl text-ink-950">Not available for your role</p>
        <p className="mt-3 text-sm text-ink-950/60">Your role can't open this page. Ask an admin if you need access.</p>
      </div>
    </div>
  )
}

function AdminRoutes({ role, signerName, user, displayName, onDisplayNameChange, messagesViewedAt, onMessagesViewed }) {
  // Who is acting, for chart admission, note signing and staff changes.
  // name is the staff record's (getAdminAccess), not the editable display
  // name: it is what gets stamped on signed notes, and the rules check it.
  // In demo mode (no user) each role acts as its seeded staff member
  // (seedCharts.js), so "My schedule" and authorship line up with the demo data.
  const demo = DEMO_ACTORS[role] ?? { uid: "demo", name: "Demo admin" }
  const actor = { uid: user?.uid ?? demo.uid, name: signerName || demo.name, role }
  const guard = (page, element) => (
    <Guard page={page} role={role}>
      {element}
    </Guard>
  )
  return (
    <Routes>
      <Route path="/admin" element={guard("dashboard", <Dashboard />)} />
      <Route path="/admin/applicants" element={guard("applicants", <Applicants role={role} actor={actor} />)} />
      <Route path="/admin/patients" element={guard("patients", <Patients actor={actor} />)} />
      <Route path="/admin/patients/:chartId" element={guard("patients", <PatientChart actor={actor} />)} />
      <Route path="/admin/todo" element={guard("todo", <Todo actor={actor} />)} />
      <Route path="/admin/calendar" element={guard("calendar", <Calendar actor={actor} />)} />
      <Route
        path="/admin/queries"
        element={guard(
          "messages",
          <Messages role={role} messagesViewedAt={messagesViewedAt} onMessagesViewed={onMessagesViewed} />,
        )}
      />
      <Route path="/admin/analytics" element={guard("analytics", <SiteTraffic />)} />
      <Route path="/admin/traffic" element={<Navigate to="/admin/analytics" replace />} />
      {/* Messages were renamed Queries (Louie, 2026-10-02); old links still work. */}
      <Route path="/admin/messages" element={<Navigate to="/admin/queries" replace />} />
      <Route path="/admin/staff" element={guard("staff", <Staff actor={actor} />)} />
      <Route path="/admin/activity" element={guard("activity", <Activity role={role} />)} />
      <Route
        path="/admin/security"
        element={<Security user={user} role={role} displayName={displayName} onDisplayNameChange={onDisplayNameChange} />}
      />
    </Routes>
  )
}

const COLLAPSED_KEY = "corephia-admin-sidebar-collapsed"

function AdminChrome({ user, role, displayName, messagesViewedAt, theme, onToggleTheme, onSignOut, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1"
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0")
      } catch {
        /* private browsing / storage disabled */
      }
      return next
    })
  }

  return (
    // h-screen + overflow-hidden at the root, rather than min-h-screen, so
    // the document itself never grows taller than the viewport and shows
    // its own native scrollbar — all scrolling happens inside <main> below
    // instead, which individual pages (like Patients) can further subdivide
    // so only part of their own content scrolls.
    <div className="h-screen overflow-hidden bg-paper-50">
      <Sidebar
        role={role}
        messagesViewedAt={messagesViewedAt}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={`relative flex h-full flex-col transition-[padding] duration-300 ease-out-smooth ${
          collapsed ? "lg:pl-18" : "lg:pl-64"
        }`}
      >
        {/* Sits over the right end of the first bar: the mobile top bar on
            phones, each page's sticky PageHeader on desktop. */}
        <div className="absolute top-2 right-4 z-20 flex items-center gap-2 sm:right-6">
          <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
          <AccountMenu user={user} role={role} displayName={displayName} onSignOut={onSignOut} />
        </div>
        <div className="flex shrink-0 items-center gap-3 border-b border-ink-950/10 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            className="rounded-lg p-1.5 text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/5"
          >
            <MenuIcon className="size-5" />
          </button>
          <p className="font-serif text-base leading-none text-ink-950">CorePhia Admin</p>
        </div>

        {/* No top padding: PageHeader owns its own top spacing directly
            (plain padding, not a negative margin trying to cancel this
            element's), so there's exactly one place that math lives. */}
        <main className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-6 sm:px-6 sm:pb-8">{children}</main>
      </div>
    </div>
  )
}

function NoAccessScreen({ email, onSignOut }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-ink-950/10 bg-white p-8">
        <p className="font-serif text-2xl text-ink-950">No access assigned</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-950/60">
          You are signed in as <span className="font-medium text-ink-950">{email}</span>, but this account has
          no admin role yet, so it cannot read patient records. A super admin needs to assign one.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-ink-900"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function NotConfiguredScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-ink-950/10 bg-white p-8">
        <p className="font-serif text-2xl text-ink-950">Admin is not configured</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-950/60">
          This build has no Firebase credentials, so there is nothing to sign in to and no records to read.
          Set the <code className="text-ink-950">VITE_FIREBASE_*</code> variables listed in{" "}
          <code className="text-ink-950">.env.example</code> and rebuild.
        </p>
      </div>
    </div>
  )
}

const DEMO_ACTORS = {
  superAdmin: { uid: "demo-super", name: "Hyacinth team" },
  admin: { uid: "demo-admin", name: "Dr. Antonious" },
  provider: { uid: "demo-provider", name: "Jordan Lee, NP" },
  dietitian: { uid: "demo-dietitian", name: "Sam Rivera, RD" },
}

// Demo mode only: open /admin?demoRole=dietitian (or provider, coAdmin, admin)
// to preview the admin as that role for the rest of the tab. Without it the
// demo runs as super admin, as before.
function demoRoleFromUrl() {
  try {
    const asked = new URLSearchParams(window.location.search).get("demoRole")
    if (asked) sessionStorage.setItem("corephia-demo-role", asked)
    const role = sessionStorage.getItem("corephia-demo-role")
    return ROLE_LABELS[role] ? role : "superAdmin"
  } catch {
    return "superAdmin"
  }
}

export default function AdminApp() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [demoRole] = useState(demoRoleFromUrl)
  const [signerName, setSignerName] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(isConfigured)
  const [demoSignedOut, setDemoSignedOut] = useState(false)
  // updateProfile() mutates auth.currentUser in place rather than handing back
  // a new object, so passing that same reference back into setUser() would be
  // a no-op render-wise. Tracked separately so Security's save shows up on
  // the sidebar immediately instead of waiting for the next sign-in.
  const [displayName, setDisplayName] = useState(null)
  const [theme, toggleTheme] = useAdminTheme()
  // Lives here rather than inside Messages/Sidebar because both need it: the
  // sidebar badge has to react the instant the Messages page marks itself
  // viewed, and that only happens through shared state, not by each reading
  // localStorage independently.
  const [messagesViewedAt, setMessagesViewedAt] = useState(readLastViewedMessagesAt)
  const markMessagesViewed = () => {
    const now = Date.now()
    setMessagesViewedAt(now)
    writeLastViewedMessagesAt(now)
  }

  const idleEnabled = isConfigured && !usingSeedData && !checkingAuth && Boolean(user) && Boolean(role)
  const handleIdle = useCallback(() => {
    signOutAdmin()
  }, [])
  const idleWarningSecondsLeft = useIdleTimeout({
    enabled: idleEnabled,
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onIdle: handleIdle,
  })

  useEffect(() => {
    if (!isConfigured) return
    return watchAdminUser(async (nextUser) => {
      // setUser and the awaited setRole land as two separate renders, not one
      // batched update — without re-arming checkingAuth here, sign-in briefly
      // renders with a user but last render's stale (null) role, which used
      // to flash the "No access assigned" screen for every admin on every
      // sign-in until the real role arrived.
      setCheckingAuth(true)
      setUser(nextUser)
      setDisplayName(nextUser?.displayName ?? null)
      const access = nextUser ? await getAdminAccess(nextUser) : { role: null, name: null }
      if (nextUser && access.role) recordSignIn(nextUser.uid)
      setRole(access.role)
      setSignerName(access.name)
      setCheckingAuth(false)
    })
  }, [])

  // The admin must never be indexed or followed, wherever it is hosted.
  const head = (
    <Helmet>
      <title>CorePhia Admin</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  )

  // Every branch below is collected into one `body` value and wrapped once,
  // at the very end, in the element that carries the "dark" class (see
  // useAdminTheme) — that keeps the theme scoped to this one subtree rather
  // than document.documentElement, so the public marketing site (rendered
  // from a completely different part of the tree) can never inherit it.
  let body

  if (usingSeedData) {
    // Demo mode has no real session to end, but "Sign out" should still show
    // what a signed-out admin sees rather than doing nothing when clicked.
    if (demoSignedOut) {
      body = (
        <Login
          theme={theme}
          onToggleTheme={toggleTheme}
          notice={
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-ink-950/10 bg-paper-100 px-4 py-3 text-sm text-ink-950/70">
              <span>
                <strong className="font-semibold text-ink-950">Demo preview.</strong> Firebase isn't configured,
                so this just previews the signed-out screen.
              </span>
              <button
                type="button"
                onClick={() => setDemoSignedOut(false)}
                className="shrink-0 font-semibold text-accent-text transition-opacity duration-200 hover:opacity-70"
              >
                Back
              </button>
            </div>
          }
        />
      )
    } else {
      body = (
        <AdminChrome
          user={null}
          role={demoRole}
          displayName={displayName}
          messagesViewedAt={messagesViewedAt}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignOut={() => setDemoSignedOut(true)}
        >
          <AdminRoutes
            role={demoRole}
            user={null}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            messagesViewedAt={messagesViewedAt}
            onMessagesViewed={markMessagesViewed}
          />
        </AdminChrome>
      )
    }
  } else if (!isConfigured) {
    body = <NotConfiguredScreen />
  } else if (checkingAuth) {
    body = (
      <div className="flex min-h-screen items-center justify-center bg-paper-50">
        <Loader />
      </div>
    )
  } else if (!user) {
    body = <Login theme={theme} onToggleTheme={toggleTheme} />
  } else if (!role) {
    body = <NoAccessScreen email={user.email} onSignOut={signOutAdmin} />
  } else {
    body = (
      <AdminChrome
        user={user}
        role={role}
        // The account button shows a name, never the email: the display name,
        // else the staff record's (getAdminAccess falls back to the email).
        displayName={displayName || (signerName !== user.email ? signerName : null)}
        messagesViewedAt={messagesViewedAt}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        <AdminRoutes
          role={role}
          signerName={signerName}
          user={user}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          messagesViewedAt={messagesViewedAt}
          onMessagesViewed={markMessagesViewed}
        />
      </AdminChrome>
    )
  }

  return (
    <>
      {head}
      {/* id targeted by portalRoot.js — modals/dialogs portal here instead
          of document.body so they stay inside the dark-mode scope. */}
      <div id="admin-portal-root" className={theme === "dark" ? "dark" : undefined}>
        {body}
        {idleWarningSecondsLeft != null && <IdleWarningModal secondsLeft={idleWarningSecondsLeft} />}
      </div>
    </>
  )
}
