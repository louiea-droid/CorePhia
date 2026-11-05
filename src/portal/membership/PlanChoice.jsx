import { useState } from "react"
import { longDateTampa } from "../../admin/patients/chartMath"
import PlanCard from "../../components/PlanCard"
import { PLANS_SHOWN, tiers } from "../../data/pricingTiers"
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "../../lib/siteContact"
import { startCheckout } from "../lib/billing"

const inlineLink = "font-medium text-ink-950 underline underline-offset-2"

// A patient who hasn't paid (or whose membership ended) sees only this: the
// plans, same features and prices as /membership, each with a button into
// Stripe Checkout. Nothing is charged until Checkout is confirmed there.
export default function PlanChoice({ chart, link }) {
  const [busy, setBusy] = useState(null) // plan name while the checkout URL is fetched
  const [failed, setFailed] = useState(false)
  const ended = chart?.membership?.status === "ended"
  const endedOn = ended ? longDateTampa(chart.membership.currentPeriodEnd) : null
  const shown = PLANS_SHOWN ? tiers : []

  async function choose(name) {
    setBusy(name)
    setFailed(false)
    try {
      window.location.assign(await startCheckout(name))
    } catch (cause) {
      console.error("Could not open checkout:", cause.code ?? cause.message)
      setFailed(true)
      setBusy(null)
    }
  }

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink-950 sm:text-4xl">
        {link.firstName ? `Welcome, ${link.firstName}. ` : "Welcome. "}Choose your plan to start your program.
      </h1>
      {ended && <p className="mt-3 text-ink-950/70">Your membership ended{endedOn ? ` on ${endedOn}` : ""}.</p>}

      <ul className="mt-8 grid gap-6 lg:grid-cols-2">
        {shown.map((tier) => (
          <li key={tier.name} className="flex">
            <PlanCard
              tier={tier}
              className="flex w-full flex-col gap-6 rounded-3xl border border-ink-950/10 bg-white p-6 shadow-md sm:p-8"
              tag={
                chart?.formPlan === tier.name && (
                  <p className="mt-3 inline-flex rounded-full bg-accent/12 px-3 py-1 text-xs font-semibold text-accent-dark">
                    You picked this on your form
                  </p>
                )
              }
            >
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => choose(tier.name)}
                className="mt-auto cursor-pointer rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === tier.name ? "Opening checkout…" : `Choose ${tier.name}`}
              </button>
            </PlanCard>
          </li>
        ))}
      </ul>

      {failed && (
        <p role="alert" className="mt-6 rounded-2xl border border-red-700/30 bg-red-50 px-4 py-3 text-sm text-red-800 [.dark_&]:bg-red-950/40 [.dark_&]:text-red-300">
          We couldn't open checkout. Please try again, or call us.
        </p>
      )}

      <p className="mt-8 text-sm text-ink-950/70">
        Questions about the plans? Call{" "}
        <a href={SUPPORT_PHONE_HREF} className={inlineLink}>
          {SUPPORT_PHONE}
        </a>{" "}
        or email{" "}
        <a href="mailto:info@corephia.com" className={inlineLink}>
          info@corephia.com
        </a>
        .
      </p>
    </div>
  )
}
