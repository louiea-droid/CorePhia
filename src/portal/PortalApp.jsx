import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, Route, Routes, useSearchParams } from "react-router-dom"
import IdleWarningModal from "../admin/layout/IdleWarningModal"
import { PORTAL_ACTIVITY_KEY, useIdleTimeout } from "../admin/lib/useIdleTimeout"
import LoginPanel from "../components/LoginPanel"
import { ChevronRightIcon } from "../components/icons"
import { Loading, Skeleton } from "./Skeleton"
import { isMember } from "../admin/patients/chartMath"
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "../lib/siteContact"
import { getMyPortalLink, signOutPatient, watchPatientUser } from "./lib/patientAuth"
import { listenMyChart } from "./lib/messageStore"
import PlanChoice from "./membership/PlanChoice"
import MessagesPage from "./messages/MessagesPage"
import PortalHome from "./PortalHome"
import PortalLayout from "./PortalLayout"
import ProgressPage from "./progress/ProgressPage"
import UpdatesPage from "./updates/UpdatesPage"

const cardClass = "rounded-3xl border border-ink-950/10 bg-white p-8"
const primaryButton =
  "inline-flex rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
const secondaryButton =
  "rounded-full border border-ink-950/15 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
const inlineLink = "font-medium text-ink-950 underline underline-offset-2"
// Weights, messages and updates are health information: sign out after 15
// quiet minutes, with a minute's warning, the same as the admin.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const IDLE_WARNING_MS = 60 * 1000
const signOut = () => signOutPatient()

// Back from Stripe Checkout (?checkout=done) the webhook may not have marked
// the membership yet: wait for it, and past 30 seconds say how to get help.
function Confirming() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 30_000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className={cardClass} role="status">
      <h1 className="font-serif text-3xl text-ink-950">Confirming your payment…</h1>
      {slow && (
        <p className="mt-3 max-w-prose text-ink-950/70">
          This is taking longer than usual. Refresh in a minute, or call us at{" "}
          <a href={SUPPORT_PHONE_HREF} className={inlineLink}>
            {SUPPORT_PHONE}
          </a>
          .
        </p>
      )}
    </div>
  )
}

// A linked patient: unpaid ones see only the plan choice; members get the portal.
export function LinkedPortal({ user, link, chart }) {
  const [params, setParams] = useSearchParams()
  const returning = params.get("checkout") === "done"
  if (chart === undefined) return <Loading label="Opening your portal…" className={cardClass} />
  if (chart === null)
    return (
      <div className={cardClass} role="alert">
        <h1 className="font-serif text-3xl text-ink-950">We couldn't load your portal.</h1>
        <p className="mt-3 max-w-prose text-ink-950/70">
          Refresh the page, or call us at{" "}
          <a href={SUPPORT_PHONE_HREF} className={inlineLink}>
            {SUPPORT_PHONE}
          </a>
          .
        </p>
      </div>
    )
  if (!isMember(chart)) return returning ? <Confirming /> : <PlanChoice chart={chart} link={link} />
  if (returning)
    return (
      <div className={cardClass} role="status">
        <h1 className="font-serif text-3xl text-ink-950">You're all set.</h1>
        <p className="mt-3 max-w-prose text-ink-950/70">Our staff will contact you to book your first visit.</p>
        <button type="button" onClick={() => setParams({}, { replace: true })} className={`mt-6 ${primaryButton}`}>
          Go to your portal
        </button>
      </div>
    )
  return (
    <Routes>
      <Route element={<PortalLayout user={user} link={link} chart={chart} />}>
        <Route index element={<PortalHome />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:topicId" element={<MessagesPage />} />
        <Route path="updates" element={<UpdatesPage />} />
      </Route>
    </Routes>
  )
}

// The patient portal (/account/*). Invite-only (Louie, 2026-10-02): a login
// only opens the portal once patientAccounts/{uid} links it to an intake
// record. This handles signing in and the link once; the pages under it get
// { user, link }.
export default function PortalApp() {
  const [user, setUser] = useState(undefined) // undefined = auth not known yet
  const [attempt, setAttempt] = useState(0)
  // The answer for one (user, attempt) pair: { key, link } or { key, failed }.
  // A result whose key isn't the current one is stale, which reads as loading.
  const [result, setResult] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => watchPatientUser(setUser), [])

  const key = user ? `${user.uid}:${attempt}` : null

  useEffect(() => {
    if (!key) return
    let live = true
    getMyPortalLink(user.uid).then(
      (link) => live && setResult({ key, link }),
      (cause) => {
        console.error("Could not load portal link:", cause.code ?? cause.message)
        if (live) setResult({ key, failed: true })
      },
    )
    return () => {
      live = false
    }
  }, [key, user])

  // The chart, live: undefined until the first snapshot (a payment lands here),
  // null when it can't be read (an error or a missing doc, never "unpaid").
  const [chartState, setChartState] = useState({ id: null, chart: undefined })
  const intakeId = link?.intakeId
  useEffect(() => {
    if (!intakeId) return
    return listenMyChart(
      intakeId,
      (chart) => setChartState({ id: intakeId, chart }),
      () => setChartState({ id: intakeId, chart: null }),
    )
  }, [intakeId])
  const chart = chartState.id === intakeId ? chartState.chart : undefined

  const current = result?.key === key ? result : null
  const link = current?.link

  const state =
    user === undefined
      ? "checking"
      : user === null
        ? "signedOut"
        : !current
          ? "checking"
          : current.failed
            ? "error"
            : link === null
              ? "notLinked"
              : "linked"

  const idleSecondsLeft = useIdleTimeout({
    enabled: Boolean(user),
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onIdle: signOut,
    storageKey: PORTAL_ACTIVITY_KEY,
  })

  const signOutButton = (
    <button type="button" onClick={() => signOutPatient()} className={secondaryButton}>
      Sign out
    </button>
  )

  return (
    <section className={`mx-auto px-4 py-20 sm:px-6 ${state === "linked" ? "max-w-5xl" : "max-w-3xl"}`}>
      <Helmet>
        <title>Patient portal | CorePhia</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {state === "checking" && (
        <Loading label="Opening your portal…" className={cardClass}>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
        </Loading>
      )}

      {state === "signedOut" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">Sign in to your patient portal</h1>
          <p className="mt-3 max-w-prose text-ink-950/70">
            Your portal opens once you're a CorePhia patient. We'll email you an invite.
          </p>
          <button type="button" onClick={() => setLoginOpen(true)} className={`mt-6 ${primaryButton}`}>
            Sign in
          </button>

          <div className="mt-8 border-t border-ink-950/10 pt-6">
            <h2 className="font-serif text-xl text-ink-950">Not a patient yet?</h2>
            <p className="mt-1.5 text-sm text-ink-950/70">Start with a short health intake.</p>
            <Link
              to="/intake"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-accent-dark hover:text-paper-50"
            >
              Get started
              <ChevronRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {state === "error" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">We couldn't load your portal.</h1>
          <p className="mt-3 text-ink-950/70">Please try again.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={primaryButton}>
              Try again
            </button>
            {signOutButton}
          </div>
        </div>
      )}

      {state === "notLinked" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">Your portal isn't set up yet</h1>
          <p className="mt-3 max-w-prose text-ink-950/70">
            If you're a CorePhia patient, contact us and we'll send you an invite. Call{" "}
            <a href={SUPPORT_PHONE_HREF} className={inlineLink}>
              {SUPPORT_PHONE}
            </a>{" "}
            or email{" "}
            <a href="mailto:info@corephia.com" className={inlineLink}>
              info@corephia.com
            </a>
            .
          </p>
          <p className="mt-6 text-sm text-ink-950/60">Signed in as {user.email}</p>
          <div className="mt-4">{signOutButton}</div>
        </div>
      )}

      {state === "linked" && (
        <LinkedPortal user={user} link={link} chart={chart} />
      )}

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
      {idleSecondsLeft != null && <IdleWarningModal secondsLeft={idleSecondsLeft} onSignOut={signOut} />}
    </section>
  )
}
