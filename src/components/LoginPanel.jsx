import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { resetPatientPassword, signInPatient, signInPatientWithGoogle, signUpPatient } from "../lib/patientAuth"
import { CheckCircleIcon, CloseIcon, EyeIcon, EyeOffIcon, GoogleIcon } from "./icons"

const perks = ["Manage your membership", "Track your progress", "Message your care team"]

const fieldClass =
  "w-full rounded-2xl border border-ink-950/15 bg-paper-50 px-4 py-3.5 text-ink-950 placeholder-ink-950/40 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

// Firebase's own messages tell an attacker which half of a guess was right
// (unknown email vs. wrong password), so failures are folded into one vague
// message here — the real code still goes to the console for debugging.
function describeAuthError(cause, fallback) {
  console.error("Patient auth failed:", cause.code ?? cause.message)
  if (cause.code === "auth/operation-not-allowed") {
    return "Google sign-in isn't turned on for this site yet."
  }
  if (cause.code === "auth/popup-closed-by-user" || cause.code === "auth/cancelled-popup-request") {
    return null
  }
  return fallback
}

function ResetForm({ initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await resetPatientPassword(email)
    } catch (cause) {
      // Same email-enumeration concern as sign-in: an unknown address still
      // reports success.
      console.error("Password reset failed:", cause.code ?? cause.message)
    } finally {
      setBusy(false)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div>
        <h2 className="font-serif text-3xl text-ink-950">Check your inbox</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-950/60">
          If <span className="font-medium text-ink-950">{email}</span> has an account, a reset link is on its
          way.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 text-sm font-semibold text-accent-dark transition-opacity duration-200 hover:opacity-70"
        >
          ← Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="font-serif text-3xl text-ink-950">Reset your password</h2>
      <p className="mt-2 text-sm text-ink-950/55">We'll email you a link to choose a new one.</p>

      <label className="mt-6 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-950/80">Email</span>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-full bg-ink-950 py-3.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 block w-full text-center text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:text-ink-950"
      >
        ← Back to sign in
      </button>
    </form>
  )
}

export default function LoginPanel({ open, onClose }) {
  const closeButtonRef = useRef(null)
  const navigate = useNavigate()

  const [mode, setMode] = useState("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return

    closeButtonRef.current?.focus()
    document.body.style.overflow = "hidden"

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  const reset = () => {
    setMode("sign-in")
    setEmail("")
    setPassword("")
    setShowPassword(false)
    setError(null)
    setBusy(false)
  }

  const goToAccount = () => {
    onClose()
    reset()
    navigate("/account")
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === "sign-up") {
        await signUpPatient(email, password)
      } else {
        await signInPatient(email, password)
      }
      goToAccount()
    } catch (cause) {
      const fallback =
        mode === "sign-up"
          ? cause.code === "auth/email-already-in-use"
            ? "An account with that email already exists. Try signing in instead."
            : "Something went wrong creating your account. Try again."
          : "Those sign-in details were not accepted."
      setError(describeAuthError(cause, fallback))
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    try {
      await signInPatientWithGoogle()
      goToAccount()
    } catch (cause) {
      setError(describeAuthError(cause, "Something went wrong signing in with Google."))
    }
  }

  return createPortal(
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-ink-950/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log in"
        aria-hidden={!open}
        className={`absolute top-0 right-0 flex h-full w-full max-w-sm flex-col overflow-y-auto rounded-l-3xl bg-paper-50 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="relative flex shrink-0 items-center justify-center px-6 pt-6 pb-2">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute left-6 flex size-9 items-center justify-center rounded-full bg-paper-50 text-ink-950 shadow-sm ring-1 ring-ink-950/10 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
          >
            <CloseIcon className="size-4" />
          </button>
          <h2 className="text-base font-semibold text-ink-950">{mode === "sign-up" ? "Create account" : "Log in"}</h2>
        </div>

        <div className="px-6 pt-8 pb-8">
          {mode === "reset" ? (
            <ResetForm initialEmail={email} onBack={() => setMode("sign-in")} />
          ) : (
            <>
              <h2 className="font-serif text-3xl text-ink-950">
                {mode === "sign-up" ? "Create your account" : "Welcome back"}
              </h2>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <input
                  type="email"
                  placeholder="Email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClass}
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    required
                    minLength={mode === "sign-up" ? 6 : undefined}
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
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

                {mode === "sign-in" && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setMode("reset")}
                      className="text-sm font-medium text-ink-700 underline-offset-2 hover:underline"
                    >
                      Forgot your password?
                    </button>
                  </div>
                )}

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
                  {busy ? "Please wait…" : mode === "sign-up" ? "Create account" : "Log in"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-ink-950/70">
                {mode === "sign-up" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("sign-in")
                        setError(null)
                      }}
                      className="font-semibold text-ink-950 underline underline-offset-2"
                    >
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    First time here?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("sign-up")
                        setError(null)
                      }}
                      className="font-semibold text-ink-950 underline underline-offset-2"
                    >
                      Create an account
                    </button>
                  </>
                )}
              </p>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-ink-950/10" />
                <span className="text-sm text-ink-950/50">or</span>
                <div className="h-px flex-1 bg-ink-950/10" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                className="flex w-full items-center justify-center gap-2.5 rounded-full border border-ink-950/15 bg-paper-50 py-3 text-sm font-medium text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
              >
                <GoogleIcon className="size-5" />
                Continue with Google
              </button>

              <div className="mt-8 rounded-3xl bg-gradient-to-br from-accent/25 via-paper-100 to-brand/20 p-6">
                <h3 className="max-w-[70%] font-serif text-xl leading-snug text-ink-950">
                  Get the most out of your care
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2 text-sm text-ink-950/80">
                      <CheckCircleIcon className="size-5 shrink-0 text-accent-dark" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
