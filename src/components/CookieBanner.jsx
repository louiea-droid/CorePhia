import { useEffect, useState } from "react"
import { OPEN_PRIVACY_CHOICES, readConsent, writeConsent } from "../lib/analyticsConsent"

// The privacy banner (meeting item 14). Shows until the visitor answers, and
// again whenever the footer's "Privacy choices" link is pressed. Not shown on
// the intake or admin, which App.jsx renders without it.
export default function CookieBanner() {
  const [open, setOpen] = useState(() => readConsent() === null)

  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_PRIVACY_CHOICES, reopen)
    return () => window.removeEventListener(OPEN_PRIVACY_CHOICES, reopen)
  }, [])

  if (!open) return null

  const choose = (value) => {
    writeConsent(value)
    setOpen(false)
  }

  return (
    <section
      aria-label="Privacy choices"
      data-no-track
      className="fixed inset-x-3 bottom-3 z-40 rounded-2xl bg-ink-950 p-5 text-paper-100 shadow-[0_20px_50px_-12px_rgb(5_10_35/0.6)] ring-1 ring-paper-50/10 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:max-w-md sm:p-6"
    >
      <p className="font-serif text-lg text-paper-50">Your privacy</p>
      <p className="mt-2 text-sm leading-relaxed text-paper-100/80">
        We use essential storage to run the site and, with your OK, anonymous counts of page visits and clicks to
        improve it. No cookies, and nothing that identifies you.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-50 focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => choose("declined")}
          className="rounded-full border border-paper-100/30 px-5 py-2.5 text-sm font-semibold text-paper-100 transition-colors duration-200 ease-out-smooth hover:bg-paper-100/10 focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
        >
          Decline
        </button>
      </div>
    </section>
  )
}
