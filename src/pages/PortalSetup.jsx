import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import PasswordField from "../components/PasswordField"
import {
  connectExistingLogin,
  createPortalLogin,
  getInvite,
  getMyPortalLink,
  linkCurrentLogin,
  resetPatientPassword,
  signOutPatient,
  watchPatientUser,
} from "../lib/patientAuth"
import { SUPPORT_PHONE } from "../lib/siteContact"

const cardClass = "rounded-3xl border border-ink-950/10 bg-white p-8"
const primaryButton =
  "inline-flex cursor-pointer justify-center rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
const secondaryButton =
  "cursor-pointer rounded-full border border-ink-950/15 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
const inlineLink = "font-medium text-ink-950 underline underline-offset-2"
const RESET_SENT = "If that email has a portal login, we've sent a link to reset your password."

function ContactLine() {
  return (
    <>
      Call{" "}
      <a href={`tel:${SUPPORT_PHONE.replace(/\D/g, "")}`} className={inlineLink}>
        {SUPPORT_PHONE}
      </a>{" "}
      or email{" "}
      <a href="mailto:info@corephia.com" className={inlineLink}>
        info@corephia.com
      </a>
      .
    </>
  )
}

// Where a portal invite's link lands (spec: 2026-10-05-portal-invites-emailjs).
// The patient chooses a password; their login is created and linked to the
// intake the invite came from. firestore.rules checks the link against the
// invite, so this page can't link anyone to anything else.
export default function PortalSetup() {
  const [params] = useSearchParams()
  const chartId = params.get("c")
  const inviteId = params.get("i")
  const navigate = useNavigate()

  const [invite, setInvite] = useState(undefined) // undefined = loading, null = invalid
  const [user, setUser] = useState(undefined)
  const [link, setLink] = useState(undefined)
  const [exists, setExists] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [resetSent, setResetSent] = useState(false)
  const [refused, setRefused] = useState(false)

  useEffect(() => {
    let active = true
    getInvite(chartId, inviteId).then(
      (next) => active && setInvite(next),
      () => active && setInvite(null),
    )
    return () => {
      active = false
    }
  }, [chartId, inviteId])

  useEffect(() => watchPatientUser(setUser), [])

  // Signed in with the invite's email: already linked, or not yet?
  const sameUser = Boolean(user && invite && user.email?.toLowerCase() === invite.to)
  useEffect(() => {
    if (!sameUser || busy) return
    let active = true
    getMyPortalLink(user.uid).then(
      (next) => active && setLink(next),
      () => active && setLink(null),
    )
    return () => {
      active = false
    }
  }, [sameUser, user, busy])

  const ref = { chartId, inviteId, invite }

  const run = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      navigate("/account")
    } catch (cause) {
      console.error("Portal setup failed:", cause.code ?? cause.message)
      if (cause.code === "auth/email-already-in-use") {
        setExists(true)
        setPassword("")
      } else if (cause.code === "auth/invalid-credential" || cause.code === "auth/wrong-password") {
        setError("That password wasn't accepted.")
      } else if (cause.code === "permission-denied") {
        setRefused(true)
      } else if (cause.code === "auth/weak-password") {
        setError("Use at least 8 characters.")
      } else {
        setError("Something went wrong. Please try again.")
      }
      setBusy(false)
    }
  }

  const create = (event) => {
    event.preventDefault()
    if (password.length < 8) return setError("Use at least 8 characters.")
    if (password !== confirm) return setError("The passwords don't match.")
    run(() => createPortalLogin(ref, password))
  }

  const connect = (event) => {
    event.preventDefault()
    run(() => connectExistingLogin(ref, password))
  }

  const sendReset = async () => {
    try {
      await resetPatientPassword(invite.to)
      setResetSent(true)
    } catch {
      setError("Couldn't send the link. Please try again.")
    }
  }

  const state =
    invite === undefined || user === undefined
      ? "loading"
      : invite === null
        ? "invalid"
        : refused
          ? "refused"
          : user && !sameUser && !busy
          ? "other"
          : sameUser && !busy
            ? link === undefined
              ? "loading"
              : link
                ? "linked"
                : "connectSignedIn"
            : exists
              ? "exists"
              : "create"

  const errorLine = error && (
    <p role="alert" className="text-sm text-brand-dark">
      {error}
    </p>
  )

  return (
    <section className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <Helmet>
        <title>Set up your portal | CorePhia</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {state === "invalid" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">This invite link has expired or isn't valid</h1>
          <p className="mt-3 text-ink-950/70">
            Contact us and we'll send you a new one. <ContactLine />
          </p>
        </div>
      )}

      {/* The login exists but the link save was refused: the invite expired
          while the page was open, or the live rules are behind. Not "expired". */}
      {state === "refused" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">We couldn't connect your login</h1>
          <p className="mt-3 text-ink-950/70">
            Your login was created, but we couldn't connect it to your portal. Contact us and we'll sort it out.{" "}
            <ContactLine />
          </p>
        </div>
      )}

      {state === "other" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">Set up your portal</h1>
          <p className="mt-3 text-ink-950/70">You're signed in as {user.email}. Log out to set up this invite.</p>
          <button type="button" onClick={() => signOutPatient()} className={`mt-6 ${secondaryButton}`}>
            Log out
          </button>
        </div>
      )}

      {state === "linked" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">You're already set up</h1>
          <p className="mt-3 text-ink-950/70">Your login is connected to your portal.</p>
          <Link to="/account" className={`mt-6 ${primaryButton}`}>
            Open your portal
          </Link>
        </div>
      )}

      {state === "connectSignedIn" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">Set up your portal</h1>
          <p className="mt-3 text-ink-950/70">Hi {invite.firstName}. Connect this invite to your login.</p>
          <div className="mt-6 space-y-4">
            {errorLine}
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => linkCurrentLogin(ref))}
              className={primaryButton}
            >
              {busy ? "Please wait…" : "Connect"}
            </button>
          </div>
        </div>
      )}

      {state === "create" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">Set up your portal</h1>
          <p className="mt-3 text-ink-950/70">
            Hi {invite.firstName || "there"}. Choose a password for {invite.to}.
          </p>
          <form className="mt-6 space-y-4" onSubmit={create} noValidate>
            <PasswordField label="Password" value={password} onChange={setPassword} />
            <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} />
            <p className="text-xs text-ink-950/55">At least 8 characters.</p>
            {errorLine}
            <button type="submit" disabled={busy} className={`w-full ${primaryButton}`}>
              {busy ? "Please wait…" : "Create my login"}
            </button>
          </form>
        </div>
      )}

      {state === "exists" && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">Set up your portal</h1>
          <p className="mt-3 text-ink-950/70">
            You already have a login with this email. Enter your password to connect it.
          </p>
          <form className="mt-6 space-y-4" onSubmit={connect} noValidate>
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
            {errorLine}
            <button type="submit" disabled={busy} className={`w-full ${primaryButton}`}>
              {busy ? "Please wait…" : "Log in and connect"}
            </button>
          </form>
          {resetSent ? (
            <p className="mt-4 text-sm text-ink-950/70">{RESET_SENT}</p>
          ) : (
            <button
              type="button"
              onClick={sendReset}
              className="mt-4 cursor-pointer text-sm font-medium text-ink-950 underline underline-offset-2"
            >
              Forgot password?
            </button>
          )}
        </div>
      )}
    </section>
  )
}
