import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link, useNavigate } from "react-router-dom"
import { resetPatientPassword, signInPatient } from "../portal/lib/patientAuth"
import { SUPPORT_PHONE } from "../lib/siteContact"
import { ChevronRightIcon, CloseIcon, EyeIcon, EyeOffIcon } from "./icons"

const labelClass = "mb-1.5 block text-sm font-medium text-ink-950/80"

const fieldClass =
  "w-full rounded-2xl border border-ink-950/15 bg-paper-50 px-4 py-3.5 text-ink-950 placeholder-ink-950/40 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

// Patient accounts are invite-only (Louie, 2026-10-02): sign-in only, no
// sign-up or Google. Staff invite admitted patients from the admin.
// startView "reset" opens on the forgot-password form (from /portal/reset).
export default function LoginPanel({ open, onClose, startView = "login" }) {
  const closeButtonRef = useRef(null)
  // Header and Account can each mount a panel, so the id must be unique per instance.
  const passwordId = useId()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState(startView) // "login" | "reset" | "resetSent"

  // Closing always comes back to where this panel starts.
  const close = () => {
    setView(startView)
    setError(null)
    onClose()
  }

  useEffect(() => {
    if (!open) return

    closeButtonRef.current?.focus()
    document.body.style.overflow = "hidden"

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return
      setView(startView)
      setError(null)
      onClose()
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose, startView])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInPatient(email, password)
      close()
      setEmail("")
      setPassword("")
      setShowPassword(false)
      setBusy(false)
      navigate("/account")
    } catch (cause) {
      // Firebase's own messages tell an attacker which half of a guess was
      // right (unknown email vs. wrong password), so every failure gets one
      // vague message; the real code still goes to the console.
      console.error("Patient auth failed:", cause.code ?? cause.message)
      setError("Those sign-in details were not accepted.")
      setBusy(false)
    }
  }

  const handleReset = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await resetPatientPassword(email.trim())
      setView("resetSent")
    } catch (cause) {
      console.error("Password reset failed:", cause.code ?? cause.message)
      setError("Couldn't send the link. Please try again.")
    }
    setBusy(false)
  }

  const backToLogin = () => {
    setView("login")
    setError(null)
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        onClick={close}
        aria-hidden="true"
        className={`absolute inset-0 bg-ink-950/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Patient portal sign in"
        className={`absolute top-0 right-0 flex h-full w-full max-w-sm flex-col overflow-y-auto rounded-l-3xl bg-paper-50 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="relative flex shrink-0 items-center justify-center px-6 pt-6 pb-2">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute left-6 flex size-9 items-center justify-center rounded-full bg-paper-50 text-ink-950 shadow-sm ring-1 ring-ink-950/10 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
          >
            <CloseIcon className="size-4" />
          </button>
          <h2 className="text-base font-semibold text-ink-950">Sign in</h2>
        </div>

        <div className="px-6 pt-8 pb-8">
          {view !== "login" ? (
            <>
              <h2 className="font-serif text-3xl text-ink-950">Reset your password</h2>
              {view === "resetSent" ? (
                <p className="mt-4 text-ink-950/75">
                  If that email has a portal login, we've sent a link to reset your password.
                </p>
              ) : (
                <form className="mt-8 space-y-4" onSubmit={handleReset}>
                  <p className="text-sm text-ink-950/70">
                    Enter your email and we'll send you a link to choose a new password.
                  </p>
                  <label className="block">
                    <span className={labelClass}>Email</span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  {error && (
                    <p role="alert" className="text-sm text-brand-dark">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-full bg-ink-950 py-3.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
                  >
                    {busy ? "Please wait…" : "Send reset link"}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={backToLogin}
                className="mt-5 cursor-pointer text-sm font-medium text-ink-950 underline underline-offset-2"
              >
                Back to log in
              </button>
            </>
          ) : (
            <>
              <h2 className="font-serif text-3xl text-ink-950">CorePhia Member log in</h2>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <span className={labelClass}>Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <div>
                  <label htmlFor={passwordId} className={labelClass}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id={passwordId}
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={`${fieldClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((previous) => !previous)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1 text-ink-950/45 transition-colors duration-200 ease-out-smooth hover:text-ink-950"
                    >
                      {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setView("reset")
                      setError(null)
                    }}
                    className="mt-2 cursor-pointer text-sm font-medium text-ink-950/70 underline-offset-2 transition-colors duration-200 hover:text-ink-950 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <p role="alert" className="text-sm text-brand-dark">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-ink-950 py-3.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
                >
                  {busy ? "Please wait…" : "Sign in"}
                </button>
              </form>
            </>
          )}

          <p className="mt-5 text-center text-sm leading-relaxed text-ink-950/70">
            Trouble logging in? Call{" "}
            <a
              href={`tel:${SUPPORT_PHONE.replace(/\D/g, "")}`}
              className="font-medium text-ink-950 underline underline-offset-2"
            >
              {SUPPORT_PHONE}
            </a>{" "}
            or email{" "}
            <a href="mailto:info@corephia.com" className="font-medium text-ink-950 underline underline-offset-2">
              info@corephia.com
            </a>
          </p>

          <div className="mt-8 border-t border-ink-950/10 pt-6">
            <h3 className="font-serif text-xl text-ink-950">Not a patient yet?</h3>
            <p className="mt-1.5 text-sm text-ink-950/70">Start with a short health intake.</p>
            <Link
              to="/intake"
              onClick={close}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-accent-dark hover:text-paper-50"
            >
              Get started
              <ChevronRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
