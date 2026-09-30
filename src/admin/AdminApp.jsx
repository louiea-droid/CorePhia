import { useCallback, useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Navigate, Route, Routes } from "react-router-dom"
import Activity from "./Activity"
import Dashboard from "./Dashboard"
import { getAdminRole, isConfigured, signOutAdmin, usingSeedData, watchAdminUser } from "./firebase"
import IdleWarningModal from "./IdleWarningModal"
import { MenuIcon } from "./icons"
import Loader from "./Loader"
import Login from "./Login"
import Messages from "./Messages"
import Patients from "./Patients"
import { readLastViewedMessagesAt, writeLastViewedMessagesAt } from "./recentMessages"
import Security from "./Security"
import Sidebar from "./Sidebar"
import SiteTraffic from "./SiteTraffic"
import { useAdminTheme } from "./useAdminTheme"
import { useIdleTimeout } from "./useIdleTimeout"

// Chart access sits behind these two on top of the password: idle staff get
// signed out automatically rather than leaving an open session on a shared
// or unattended machine for however long the browser tab stays open.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const IDLE_WARNING_MS = 60 * 1000

function AdminRoutes({ role, user, displayName, onDisplayNameChange, messagesViewedAt, onMessagesViewed }) {
  return (
    <Routes>
      <Route path="/admin" element={<Dashboard />} />
      <Route path="/admin/patients" element={<Patients role={role} />} />
      <Route
        path="/admin/messages"
        element={<Messages role={role} messagesViewedAt={messagesViewedAt} onMessagesViewed={onMessagesViewed} />}
      />
      <Route path="/admin/analytics" element={<SiteTraffic />} />
      <Route path="/admin/traffic" element={<Navigate to="/admin/analytics" replace />} />
      <Route path="/admin/activity" element={<Activity role={role} />} />
      <Route
        path="/admin/security"
        element={<Security user={user} displayName={displayName} onDisplayNameChange={onDisplayNameChange} />}
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
        user={user}
        role={role}
        displayName={displayName}
        messagesViewedAt={messagesViewedAt}
        theme={theme}
        onToggleTheme={onToggleTheme}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onSignOut={onSignOut}
      />

      <div
        className={`flex h-full flex-col transition-[padding] duration-300 ease-out-smooth ${
          collapsed ? "lg:pl-18" : "lg:pl-64"
        }`}
      >
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
          <p className="font-serif text-base leading-none text-ink-950">Corephia Admin</p>
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

export default function AdminApp() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
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
      setRole(nextUser ? await getAdminRole(nextUser) : null)
      setCheckingAuth(false)
    })
  }, [])

  // The admin must never be indexed or followed, wherever it is hosted.
  const head = (
    <Helmet>
      <title>Corephia Admin</title>
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
                className="shrink-0 font-semibold text-accent-dark transition-opacity duration-200 hover:opacity-70"
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
          role="superAdmin"
          displayName={displayName}
          messagesViewedAt={messagesViewedAt}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignOut={() => setDemoSignedOut(true)}
        >
          <AdminRoutes
            role="superAdmin"
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
        displayName={displayName}
        messagesViewedAt={messagesViewedAt}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        <AdminRoutes
          role={role}
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
