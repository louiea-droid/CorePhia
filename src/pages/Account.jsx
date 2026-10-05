import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import LoginPanel from "../components/LoginPanel"
import { BadgeCheckIcon, ChevronRightIcon, ClipboardCheckIcon, MailIcon, TrendingUpIcon } from "../components/icons"
import { getMyPortalLink, signOutPatient, watchPatientUser } from "../lib/patientAuth"
import { SUPPORT_PHONE } from "../lib/siteContact"

const sections = [
  { Icon: ClipboardCheckIcon, title: "Updates", line: "Notes from your care team after each visit." },
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

// Invite-only (Louie, 2026-10-02): a login only opens the portal once
// patientAccounts/{uid} links it to an intake record. Staff link it (by hand
// in the console for now); old self sign-ups without a link see "not set up".
export default function Account() {
  const [user, setUser] = useState(undefined) // undefined = auth not known yet
  const [link, setLink] = useState(undefined) // undefined = loading, null = not linked
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => watchPatientUser(setUser), [])

  useEffect(() => {
    if (!user) return
    let live = true
    setLink(undefined)
    setFailed(false)
    getMyPortalLink(user.uid).then(
      (next) => live && setLink(next),
      (cause) => {
        console.error("Could not load portal link:", cause.code ?? cause.message)
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [user, attempt])

  const state =
    user === undefined
      ? "checking"
      : user === null
        ? "signedOut"
        : failed
          ? "error"
          : link === undefined
            ? "checking"
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
          <p className="mt-3 text-ink-950/70">This is your patient portal. Here's what's on the way.</p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {sections.map(({ Icon, title, line }) => (
              <li key={title} className="rounded-2xl bg-paper-100 p-5">
                <div className="flex items-start justify-between gap-3">
                  <Icon className="size-6 text-accent-dark" aria-hidden="true" />
                  <span className="rounded-full bg-paper-50 px-2.5 py-0.5 text-xs font-medium text-ink-950/70">
                    Coming soon
                  </span>
                </div>
                <h2 className="mt-4 font-serif text-xl text-ink-950">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-950/70">{line}</p>
              </li>
            ))}
          </ul>

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
