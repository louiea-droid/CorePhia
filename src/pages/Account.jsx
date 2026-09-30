import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import { signOutPatient, watchPatientUser } from "../lib/patientAuth"

const upcoming = ["Manage your membership", "Track your progress", "Message your care team"]

export default function Account() {
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    return watchPatientUser((nextUser) => {
      setUser(nextUser)
      setChecking(false)
    })
  }, [])

  return (
    <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <Helmet>
        <title>My Account | CorePhia</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {checking ? null : user ? (
        <div className="rounded-3xl border border-ink-950/10 bg-white p-8">
          <p className="text-xs font-semibold tracking-widest text-accent-dark uppercase">Signed in</p>
          <h1 className="mt-3 font-serif text-3xl text-ink-950">{user.email}</h1>

          <div className="mt-8 rounded-2xl bg-paper-100 p-6">
            <p className="text-sm font-medium text-ink-950">Coming soon</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-950/70">
              {upcoming.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => signOutPatient()}
            className="mt-8 rounded-full border border-ink-950/15 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-ink-950/10 bg-white p-8 text-center">
          <h1 className="font-serif text-2xl text-ink-950">You're not signed in</h1>
          <p className="mt-2 text-ink-950/60">Use "Log in" in the header to sign in or create an account.</p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
          >
            Go home
          </Link>
        </div>
      )}
    </section>
  )
}
