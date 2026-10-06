import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import LoginPanel from "../components/LoginPanel"
import { BadgeCheckIcon, ChevronRightIcon, ClipboardCheckIcon, MailIcon, TrendingUpIcon } from "../components/icons"
import { getMyPortalLink, getMyUpdates, signOutPatient, watchPatientUser } from "./lib/patientAuth"
import { SUPPORT_PHONE } from "../lib/siteContact"

const sections = [
  { Icon: ClipboardCheckIcon, title: "Updates", line: "What your care team has shared with you." },
  { Icon: TrendingUpIcon, title: "Track progress", line: "Your weight and the measures your care team follows." },
  { Icon: MailIcon, title: "Messages", line: "Write to your care team and read their replies." },
  { Icon: BadgeCheckIcon, title: "Membership", line: "Your plan and what it includes." },
]

const cardClass = "rounded-3xl border border-ink-950/10 bg-white p-8"
const primaryButton =
  "inline-flex rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
const secondaryButton =
  "rounded-full border border-ink-950/15 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
const inlineLink = "font-medium text-ink-950 underline underline-offset-2"

// How staff roles read to a patient: the admin is Dr. Antonious, so
// "Provider"; co-admins and super admins aren't necessarily clinicians, so
// "Care team".
const AUTHOR_ROLES = { provider: "Provider", dietitian: "Dietitian", admin: "Provider", coAdmin: "Care team", superAdmin: "Care team" }

const updateDay = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""
}

function PortalUpdates({ intakeId }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null) // { attempt, updates } | { attempt, failed }

  useEffect(() => {
    let live = true
    getMyUpdates(intakeId).then(
      (updates) => live && setResult({ attempt, updates }),
      (cause) => {
        console.error("Could not load updates:", cause.code ?? cause.message)
        if (live) setResult({ attempt, failed: true })
      },
    )
    return () => {
      live = false
    }
  }, [intakeId, attempt])

  const current = result?.attempt === attempt ? result : null

  return (
    <section id="updates" className="mt-10 scroll-mt-24 border-t border-ink-950/10 pt-8">
      <h2 className="font-serif text-2xl text-ink-950">Updates</h2>
      {!current ? (
        <p className="mt-4 text-sm text-ink-950/60">Loading your updates…</p>
      ) : current.failed ? (
        <div className="mt-4">
          <p className="text-ink-950/70">We couldn't load your updates.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`mt-4 ${secondaryButton}`}>
            Try again
          </button>
        </div>
      ) : current.updates.length === 0 ? (
        <p className="mt-4 text-ink-950/70">Updates from your care team will show up here.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {current.updates.map((update) => (
            <li key={update.id} className="rounded-2xl bg-paper-100 p-5">
              <p className="text-sm text-ink-950/60">
                {updateDay(update.createdAt)} · From {update.author?.name} ({AUTHOR_ROLES[update.author?.role] ?? "Care team"})
              </p>
              <p className="mt-2 whitespace-pre-line wrap-break-word leading-relaxed text-ink-950">{update.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// Invite-only (Louie, 2026-10-02): a login only opens the portal once
// patientAccounts/{uid} links it to an intake record. Staff link it (by hand
// in the console for now); old self sign-ups without a link see "not set up".
export default function PortalHome() {
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

  const signOutButton = (
    <button type="button" onClick={() => signOutPatient()} className={secondaryButton}>
      Sign out
    </button>
  )

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <Helmet>
        <title>Patient portal | CorePhia</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

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
            <a href={`tel:${SUPPORT_PHONE.replace(/\D/g, "")}`} className={inlineLink}>
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
        <div className={cardClass}>
          <h1 className="font-serif text-4xl text-ink-950">
            {link.firstName ? `Welcome back, ${link.firstName}` : "Welcome back"}
          </h1>
          <p className="mt-3 text-ink-950/70">Your updates are below. More is on the way.</p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {sections.map(({ Icon, title, line }) => {
              const live = title === "Updates"
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="size-6 text-accent-dark" aria-hidden="true" />
                    {!live && (
                      <span className="rounded-full bg-paper-50 px-2.5 py-0.5 text-xs font-medium text-ink-950/70">Coming soon</span>
                    )}
                  </div>
                  <h2 className="mt-4 font-serif text-xl text-ink-950">{title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-950/70">{line}</p>
                </>
              )
              return (
                <li key={title}>
                  {live ? (
                    <a
                      href="#updates"
                      className="block h-full rounded-2xl bg-paper-100 p-5 transition-colors duration-200 ease-out-smooth hover:bg-paper-200"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="h-full rounded-2xl bg-paper-100 p-5">{inner}</div>
                  )}
                </li>
              )
            })}
          </ul>

          <PortalUpdates intakeId={link.intakeId} />

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ink-950/10 pt-6">
            <p className="text-sm text-ink-950/60">Signed in as {user.email}</p>
            {signOutButton}
          </div>
        </div>
      )}

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  )
}
