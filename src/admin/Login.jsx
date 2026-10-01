import { useRef, useState } from "react"
import { completeTotpSignIn, getTotpResolver, resetAdminPassword, signInAdmin } from "./firebase"
import { EyeIcon, EyeOffIcon } from "./icons"

const fieldClass =
  "w-full rounded-2xl border border-ink-950/15 bg-paper-50 px-4 py-3 text-ink-950 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

function ResetPasswordForm({ initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  // Firebase returns "user not found" for an unregistered email — surfacing
  // that lets anyone probe which addresses have an admin account, so it's
  // folded into the same success state instead of being shown as an error.
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await resetAdminPassword(email)
      setSent(true)
    } catch (cause) {
      if (cause.code === "auth/user-not-found" || cause.code === "auth/invalid-email") {
        setSent(true)
      } else {
        setError("Something went wrong sending that email. Try again.")
      }
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div>
        <p className="font-serif text-2xl text-ink-950">Check your inbox</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-950/60">
          If <span className="font-medium text-ink-950">{email}</span> has an admin account, a reset link is
          on its way. It can take a few minutes to arrive.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 text-sm font-semibold text-accent-text transition-opacity duration-200 hover:opacity-70"
        >
          ← Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="font-serif text-2xl text-ink-950">Reset your password</p>
      <p className="mt-2 text-sm text-ink-950/55">We'll email you a link to choose a new one.</p>

      <label className="mt-6 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-950/80">Email</span>
        <input
          type="email"
          required
          autoFocus
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 text-sm text-brand-dark">
          {error}
        </p>
      )}

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

// Shown only for accounts that have an authenticator app enrolled. The
// password step already succeeded by this point — Firebase is holding the
// half-finished sign-in in `resolver` until the code confirms it.
function TotpChallengeForm({ resolver, onCancel }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await completeTotpSignIn(resolver, code.trim())
    } catch (cause) {
      console.error("Second factor rejected:", cause.code ?? cause.message)
      setError("That code wasn't accepted. Codes expire quickly — try the current one.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="font-serif text-2xl text-ink-950">Enter your code</p>
      <p className="mt-2 text-sm text-ink-950/55">
        Open your authenticator app and enter the 6-digit code for Corephia Admin.
      </p>

      <label className="mt-6 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-950/80">Verification code</span>
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

      {error && (
        <p role="alert" className="mt-4 text-sm text-brand-dark">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-full bg-ink-950 py-3.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
      >
        {busy ? "Checking…" : "Verify and sign in"}
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="mt-4 block w-full text-center text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:text-ink-950"
      >
        ← Back to sign in
      </button>
    </form>
  )
}

function SignInForm({ onForgotPassword, onSecondFactorRequired }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInAdmin(email, password)
    } catch (cause) {
      // An account with a second factor lands here too, but that isn't a
      // rejected sign-in — it's an unfinished one, so it hands off to the code
      // prompt rather than showing a failure.
      const resolver = getTotpResolver(cause)
      if (resolver) {
        onSecondFactorRequired(resolver)
        return
      }
      // The UI message stays deliberately vague — telling an attacker which
      // half was wrong helps them enumerate valid accounts — but the real
      // Firebase error code is still worth having in the console for
      // debugging from the browser that hit it.
      console.error("Admin sign-in failed:", cause.code ?? cause.message)
      setError("Those sign-in details were not accepted.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-950/80">Email</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="mt-4 block">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-medium text-ink-950/80">Password</span>
          <button
            type="button"
            onClick={() => onForgotPassword(email)}
            className="text-xs font-medium text-accent-text transition-opacity duration-200 hover:opacity-70"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
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
      </label>

      {error && (
        <p role="alert" className="mt-4 text-sm text-brand-dark">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-full bg-ink-950 py-3.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  )
}

export default function Login({ notice, theme, onToggleTheme }) {
  // Lifted above both forms so the email a person typed while signing in
  // carries over if they tap "Forgot password?" instead of retyping it.
  const [mode, setMode] = useState("sign-in")
  const [resetEmail, setResetEmail] = useState("")
  const [totpResolver, setTotpResolver] = useState(null)
  const surfaceRef = useRef(null)
  const orbRef = useRef(null)

  // Written straight to style rather than through state so moving the pointer
  // doesn't re-render the sign-in form — and offset by half the orb's own size
  // via calc so it stays centred on the cursor whatever its dimensions are.
  const trackCursor = (event) => {
    const orb = orbRef.current
    const surface = surfaceRef.current
    if (!orb || !surface || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const rect = surface.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    orb.style.transform = `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), 0)`
  }

  return (
    <div
      ref={surfaceRef}
      onMouseMove={trackCursor}
      // from-paper-50, not -100: under .dark, paper-100 (#182446) and
      // paper-200 (#22304f) sit almost on top of each other, so two-thirds
      // of the gradient read as a flat dark fill that then jumps abruptly
      // to the lighter corner — paper-50's near-black dark value (#0a0f22)
      // gives three visibly distinct steps instead. Light mode is
      // unaffected: paper-50 and paper-100 are nearly identical there too.
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-paper-50 via-paper-200 to-accent/50 px-4"
    >
      <div
        ref={orbRef}
        aria-hidden="true"
        style={{ transform: "translate3d(calc(50vw - 50%), calc(50vh - 50%), 0)" }}
        className="pointer-events-none absolute top-0 left-0 size-40 rounded-full bg-accent/60 blur-2xl transition-transform duration-500 ease-out-smooth"
      />

      <div className="relative z-10 w-full max-w-sm">
        {notice}
        <div className="rounded-3xl border border-white/70 bg-white/35 p-8 shadow-2xl shadow-ink-950/15 backdrop-blur-2xl">
          <div className="mb-6 flex items-center gap-3">
            <img src="/cp-mark.webp" alt="" className="h-8 w-auto object-contain" />
            <p className="font-serif text-2xl text-ink-950">Corephia Admin</p>
          </div>
          {mode === "sign-in" && (
            <SignInForm
              onForgotPassword={(email) => {
                setResetEmail(email)
                setMode("reset")
              }}
              onSecondFactorRequired={(resolver) => {
                setTotpResolver(resolver)
                setMode("totp")
              }}
            />
          )}
          {mode === "totp" && (
            <TotpChallengeForm
              resolver={totpResolver}
              onCancel={() => {
                setTotpResolver(null)
                setMode("sign-in")
              }}
            />
          )}
          {mode === "reset" && (
            <ResetPasswordForm initialEmail={resetEmail} onBack={() => setMode("sign-in")} />
          )}
        </div>
      </div>

      {/* A compact icon button (.theme-knob in index.css); signed in, the
          theme switch sits top right beside the account menu
          (ThemeSwitch.jsx). */}
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="fixed right-4 bottom-4 z-10 cursor-pointer"
      >
        <span className="theme-knob" data-mode={theme}>
          <span className="theme-toggle__icon" aria-hidden="true">
            <span className="theme-toggle__icon-part" />
            <span className="theme-toggle__icon-part" />
            <span className="theme-toggle__icon-part" />
            <span className="theme-toggle__icon-part" />
            <span className="theme-toggle__icon-part" />
            <span className="theme-toggle__icon-part" />
            <span className="theme-toggle__icon-part" />
            <span className="theme-toggle__icon-part" />
            <span className="theme-toggle__icon-part" />
          </span>
        </span>
      </button>
    </div>
  )
}
