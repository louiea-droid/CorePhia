import { useState } from "react"
import ConfirmDialog from "./ConfirmDialog"
import {
  finishTotpEnrollment,
  listEnrolledFactors,
  reloadAdminUser,
  removeEnrolledFactor,
  startTotpEnrollment,
  updateAdminDisplayName,
} from "./firebase"
import PageHeader from "./PageHeader"

const fieldClass =
  "w-full rounded-2xl border border-ink-950/15 bg-paper-50 px-4 py-3 text-ink-950 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

// Authenticator apps take the key in groups of four; unbroken it's a wall of
// characters to copy by eye.
function groupSecret(secretKey) {
  return (secretKey.match(/.{1,4}/g) ?? [secretKey]).join(" ")
}

function describeError(cause) {
  switch (cause?.code) {
    case "auth/operation-not-allowed":
    case "auth/unsupported-first-factor":
      return "Two-step sign-in isn't switched on for this project yet. It needs Identity Platform with TOTP enabled in the Firebase console."
    case "auth/requires-recent-login":
      return "For this change you need a fresh sign-in. Sign out, sign back in, and try again."
    case "auth/invalid-verification-code":
      return "That code wasn't accepted. Codes expire quickly — try the current one."
    default:
      return cause?.message ?? "Something went wrong. Try again."
  }
}

export default function Security({ user, displayName, onDisplayNameChange }) {
  const [factors, setFactors] = useState(() => listEnrolledFactors(user))
  const [secret, setSecret] = useState(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [justEnrolled, setJustEnrolled] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState(null)
  const [nameInput, setNameInput] = useState(displayName ?? "")
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState(null)
  const [nameSaved, setNameSaved] = useState(false)

  const saveDisplayName = async (event) => {
    event.preventDefault()
    setNameBusy(true)
    setNameError(null)
    setNameSaved(false)
    try {
      const saved = await updateAdminDisplayName(nameInput)
      setNameInput(saved ?? "")
      onDisplayNameChange?.(saved)
      setNameSaved(true)
    } catch (cause) {
      console.error("Could not save display name:", cause.code ?? cause.message)
      setNameError(describeError(cause))
    } finally {
      setNameBusy(false)
    }
  }

  const refreshFactors = async () => {
    const refreshed = await reloadAdminUser()
    setFactors(listEnrolledFactors(refreshed))
  }

  const beginEnrollment = async () => {
    setBusy(true)
    setError(null)
    setJustEnrolled(false)
    try {
      setSecret(await startTotpEnrollment())
    } catch (cause) {
      console.error("Could not start enrolment:", cause.code ?? cause.message)
      setError(describeError(cause))
    } finally {
      setBusy(false)
    }
  }

  const confirmEnrollment = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await finishTotpEnrollment(secret, code.trim())
      await refreshFactors()
      setSecret(null)
      setCode("")
      setJustEnrolled(true)
    } catch (cause) {
      console.error("Could not complete enrolment:", cause.code ?? cause.message)
      setError(describeError(cause))
    } finally {
      setBusy(false)
    }
  }

  const confirmRemoval = async () => {
    setBusy(true)
    setError(null)
    try {
      await removeEnrolledFactor(pendingRemoval.uid)
      await refreshFactors()
      setPendingRemoval(null)
    } catch (cause) {
      console.error("Could not remove the second factor:", cause.code ?? cause.message)
      setError(describeError(cause))
      setPendingRemoval(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Security" description="How this account proves it's you." />

      <div className="mx-auto w-full max-w-2xl space-y-4">
        <section className="rounded-2xl border border-ink-950/10 bg-white p-6">
          <h2 className="font-serif text-xl text-ink-950">Display name</h2>
          <p className="mt-1 max-w-md text-sm text-ink-950/60">
            Shown in the sidebar instead of your email. 
          </p>

          <form onSubmit={saveDisplayName} className="mt-4 flex flex-wrap items-start gap-3">
            <input
              type="text"
              value={nameInput}
              onChange={(event) => {
                setNameInput(event.target.value)
                setNameSaved(false)
              }}
              placeholder={user?.email ?? "Your name"}
              maxLength={80}
              className={`${fieldClass} max-w-xs`}
            />
            <button
              type="submit"
              disabled={nameBusy}
              className="rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
            >
              {nameBusy ? "Saving…" : "Save"}
            </button>
          </form>

          {nameSaved && !nameError && (
            <p role="status" className="mt-3 text-sm text-ink-950/60">
              Saved.
            </p>
          )}
          {nameError && (
            <p role="alert" className="mt-3 rounded-2xl border border-brand-dark/30 bg-paper-50 px-4 py-3 text-sm text-ink-950">
              {nameError}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-ink-950/10 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl text-ink-950">Two-step sign-in</h2>
              <p className="mt-1 max-w-md text-sm text-ink-950/60">
                This account can open any patient record, so a password on its own is thin protection. With
                two-step sign-in, a stolen password isn't enough by itself.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                factors.length ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/60"
              }`}
            >
              {factors.length ? "On" : "Off"}
            </span>
          </div>

          {user?.email && <p className="mt-4 text-sm text-ink-950/50">Signed in as {user.email}</p>}

          {justEnrolled && (
            <p role="status" className="mt-4 rounded-2xl bg-paper-100 px-4 py-3 text-sm text-ink-950">
              Two-step sign-in is on. You'll be asked for a code next time you sign in.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-2xl border border-brand-dark/30 bg-paper-50 px-4 py-3 text-sm text-ink-950">
              {error}
            </p>
          )}

          {factors.length > 0 && (
            <ul className="mt-5 space-y-2">
              {factors.map((factor) => (
                <li
                  key={factor.uid}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-paper-50 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-950">
                      {factor.displayName || "Authenticator app"}
                    </span>
                    {factor.enrollmentTime && (
                      <span className="block text-xs text-ink-950/50">
                        Added {new Date(factor.enrollmentTime).toLocaleDateString("en-US")}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingRemoval(factor)}
                    className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-brand-dark/10 hover:text-brand-dark"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!secret && (
            <button
              type="button"
              onClick={beginEnrollment}
              disabled={busy}
              className="mt-5 rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
            >
              {busy ? "Working…" : factors.length ? "Add another authenticator" : "Set up two-step sign-in"}
            </button>
          )}

          {secret && (
            <form onSubmit={confirmEnrollment} className="mt-6 border-t border-ink-950/10 pt-6">
              <p className="text-sm font-medium text-ink-950">1. Add this key to your authenticator app</p>
              <p className="mt-1 text-sm text-ink-950/60">
                In Google Authenticator, 1Password, or similar, choose to add an account by entering a setup key.
              </p>
              <p className="mt-3 rounded-2xl bg-paper-50 px-4 py-3 font-mono text-sm tracking-wide break-all text-ink-950">
                {groupSecret(secret.secretKey)}
              </p>
              <a
                href={secret.generateQrCodeUrl(user?.email ?? "Corephia Admin", "Corephia")}
                className="mt-2 inline-block text-sm font-medium text-accent-dark transition-opacity duration-200 hover:opacity-70"
              >
                Or open it directly in your authenticator app
              </a>

              <label className="mt-6 block">
                <span className="mb-1.5 block text-sm font-medium text-ink-950">
                  2. Enter the 6-digit code it shows
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className={`${fieldClass} tracking-[0.4em]`}
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
                >
                  {busy ? "Checking…" : "Turn on two-step sign-in"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSecret(null)
                    setCode("")
                    setError(null)
                  }}
                  className="rounded-full px-5 py-3 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Remove two-step sign-in?"
        description="This account will be protected by its password alone. You can set it up again at any time."
        confirmLabel={busy ? "Removing…" : "Remove"}
        confirmDisabled={busy}
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  )
}
