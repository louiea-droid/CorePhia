import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link, useNavigate } from "react-router-dom"
import { signInPatient } from "../lib/patientAuth"
import { SUPPORT_PHONE } from "../lib/siteContact"
import { ChevronRightIcon, CloseIcon, EyeIcon, EyeOffIcon } from "./icons"

const labelClass = "mb-1.5 block text-sm font-medium text-ink-950/80"

const fieldClass =
  "w-full rounded-2xl border border-ink-950/15 bg-paper-50 px-4 py-3.5 text-ink-950 placeholder-ink-950/40 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

// Patient accounts are invite-only (Louie, 2026-10-02): no sign-up, password
// reset or Google sign-in here. The invite flow will add how accounts are made.
export default function LoginPanel({ open, onClose }) {
  const closeButtonRef = useRef(null)
  const navigate = useNavigate()

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

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInPatient(email, password)
      onClose()
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
        aria-label="Patient log in"
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
          <h2 className="text-base font-semibold text-ink-950">Patient log in</h2>
        </div>

        <div className="px-6 pt-8 pb-8">
          <h2 className="font-serif text-3xl text-ink-950">Your patient portal</h2>
          

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
              <label htmlFor="patient-password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <input
                  id="patient-password"
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
              {busy ? "Please wait…" : "Log in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm leading-relaxed text-ink-950/70">
            Trouble logging in? Call{" "}
            <a href={`tel:${SUPPORT_PHONE.replace(/D/g, "")}`} className="font-medium text-ink-950 underline underline-offset-2">
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
              onClick={onClose}
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
