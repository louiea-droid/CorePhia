import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useSearchParams } from "react-router-dom"
import LoginPanel from "../components/LoginPanel"
import PasswordField from "../components/PasswordField"
import { checkResetCode, saveNewPassword } from "./lib/patientAuth"

const cardClass = "rounded-3xl border border-ink-950/10 bg-white p-8"
const primaryButton =
  "inline-flex cursor-pointer justify-center rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"

// Only this site: a continue URL elsewhere (or none) goes to the portal.
function continuePath(continueUrl) {
  try {
    const url = new URL(continueUrl, window.location.origin)
    return url.origin === window.location.origin ? `${url.pathname}${url.search}` : "/account"
  } catch {
    return "/account"
  }
}

// Where Firebase's password-reset email lands once its action URL points
// here (Firebase console, Authentication > Templates). Patients and staff
// both come through; the continue URL sends each back where they belong.
export default function PortalReset() {
  const [params] = useSearchParams()
  const code = params.get("oobCode")
  const valid = params.get("mode") === "resetPassword" && Boolean(code)

  const [email, setEmail] = useState(valid ? undefined : null) // undefined = checking, null = bad link
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    if (!valid) return
    let active = true
    checkResetCode(code).then(
      (next) => active && setEmail(next),
      () => active && setEmail(null),
    )
    return () => {
      active = false
    }
  }, [code, valid])

  const submit = async (event) => {
    event.preventDefault()
    if (password.length < 8) return setError("Use at least 8 characters.")
    if (password !== confirm) return setError("The passwords don't match.")
    setBusy(true)
    setError(null)
    try {
      await saveNewPassword(code, password)
      setDone(true)
    } catch (cause) {
      console.error("Password reset failed:", cause.code ?? cause.message)
      if (cause.code === "auth/expired-action-code" || cause.code === "auth/invalid-action-code") setEmail(null)
      else if (cause.code === "auth/weak-password") setError("Use at least 8 characters.")
      else setError("Something went wrong. Please try again.")
    }
    setBusy(false)
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-20 sm:px-6">
      <Helmet>
        <title>Reset your password | CorePhia</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {email === null && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">This reset link has expired or was already used.</h1>
          <p className="mt-3 text-ink-950/70">Reset links work once and only for a short time. Ask for a new one.</p>
          <button type="button" onClick={() => setLoginOpen(true)} className={`mt-6 ${primaryButton}`}>
            Send a new link
          </button>
        </div>
      )}

      {email && done && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">Password changed</h1>
          <p className="mt-3 text-ink-950/70">You can log in with your new password now.</p>
          <Link to={continuePath(params.get("continueUrl"))} className={`mt-6 ${primaryButton}`}>
            Continue
          </Link>
        </div>
      )}

      {email && !done && (
        <div className={cardClass}>
          <h1 className="font-serif text-3xl text-ink-950">Choose a new password</h1>
          <p className="mt-3 text-ink-950/70">For {email}.</p>
          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            <PasswordField label="New password" value={password} onChange={setPassword} />
            <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} />
            <p className="text-xs text-ink-950/55">At least 8 characters.</p>
            {error && (
              <p role="alert" className="text-sm text-brand-dark">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={`w-full ${primaryButton}`}>
              {busy ? "Please wait…" : "Save password"}
            </button>
          </form>
        </div>
      )}

      {loginOpen && <LoginPanel open onClose={() => setLoginOpen(false)} startView="reset" />}
    </section>
  )
}
