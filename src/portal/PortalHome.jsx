import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import LoginPanel from "../components/LoginPanel"
import { BadgeCheckIcon, ChevronRightIcon, MailIcon, PhoneIcon } from "../components/icons"
import { getMyPortalLink, signOutPatient, watchPatientUser } from "./lib/patientAuth"
import PortalProgress from "./progress/PortalProgress"
import PortalUpdates from "./updates/PortalUpdates"
import { SUPPORT_PHONE } from "../lib/siteContact"

// Sections still being built, one by one (Louie, 2026-10-06). When one
// ships, take it off this list and give it its own panel on the page.
const COMING_SOON = [
  { Icon: MailIcon, title: "Messages", line: "Write to your care team and read their replies." },
  { Icon: BadgeCheckIcon, title: "Membership", line: "Your plan and what it includes." },
]

const sideCard = "rounded-3xl border border-ink-950/10 bg-white p-6"
const cardClass = "rounded-3xl border border-ink-950/10 bg-white p-8"
const primaryButton =
  "inline-flex rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
const secondaryButton =
  "rounded-full border border-ink-950/15 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
const inlineLink = "font-medium text-ink-950 underline underline-offset-2"

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
    <section className={`mx-auto px-4 py-20 sm:px-6 ${state === "linked" ? "max-w-5xl" : "max-w-3xl"}`}>
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
        <div>
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <h1 className="font-serif text-4xl text-ink-950">
                {link.firstName ? `Welcome back, ${link.firstName}` : "Welcome back"}
              </h1>
              <p className="mt-2 text-ink-950/70">Here's what your care team has shared with you.</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="break-all text-ink-950/60">Signed in as {user.email}</span>
              <button
                type="button"
                onClick={() => signOutPatient()}
                className="cursor-pointer font-semibold whitespace-nowrap text-ink-950 underline-offset-4 transition-colors duration-200 hover:text-accent-dark hover:underline"
              >
                Sign out
              </button>
            </div>
          </header>

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-6">
              <PortalProgress intakeId={link.intakeId} />
              <PortalUpdates intakeId={link.intakeId} />
            </div>

            <aside className="space-y-6">
              <section aria-labelledby="care-team-heading" className={sideCard}>
                <h2 id="care-team-heading" className="font-serif text-xl text-ink-950">
                  Your care team
                </h2>
                <p className="mt-1 text-sm text-ink-950/70">Questions about your care? Call or email us.</p>
                <ul className="mt-4 space-y-1 text-sm">
                  <li>
                    <a
                      href={`tel:${SUPPORT_PHONE.replace(/\D/g, "")}`}
                      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 font-medium text-ink-950 transition-colors duration-200 hover:bg-paper-100"
                    >
                      <PhoneIcon className="size-4 shrink-0 text-accent-dark" aria-hidden="true" />
                      {SUPPORT_PHONE}
                    </a>
                  </li>
                  <li>
                    <a
                      href="mailto:info@corephia.com"
                      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 font-medium break-all text-ink-950 transition-colors duration-200 hover:bg-paper-100"
                    >
                      <MailIcon className="size-4 shrink-0 text-accent-dark" aria-hidden="true" />
                      info@corephia.com
                    </a>
                  </li>
                </ul>
              </section>

              <section aria-labelledby="coming-heading" className={sideCard}>
                <h2 id="coming-heading" className="font-serif text-xl text-ink-950">
                  Coming to your portal
                </h2>
                <ul className="mt-4 space-y-4">
                  {COMING_SOON.map(({ Icon, title, line }) => (
                    <li key={title} className="flex gap-3">
                      <Icon className="mt-0.5 size-5 shrink-0 text-ink-950/40" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-ink-950/80">{title}</p>
                        <p className="text-sm leading-relaxed text-ink-950/60">{line}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </div>
      )}

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  )
}
