import { useState } from "react"
import { longDateTampa } from "../../admin/patients/chartMath"
import { openBillingPortal } from "../lib/billing"

// First card on the Overview: the plan, the next billing date (or the end
// date once cancelled), and Stripe's hosted page for card changes and
// receipts. Memberships staff set by hand have no Stripe customer: plan only.
export default function MembershipCard({ membership, Heading = "h2" }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const date = longDateTampa(membership.currentPeriodEnd)
  const stripe = membership.source === "stripe"

  async function manage() {
    setBusy(true)
    setFailed(false)
    try {
      window.location.assign(await openBillingPortal())
    } catch (cause) {
      console.error("Could not open billing:", cause.code ?? cause.message)
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="membership-heading" className="rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <Heading id="membership-heading" className="font-serif text-2xl text-ink-950">
        Membership
      </Heading>
      <p className="mt-2 text-lg font-medium text-ink-950">{membership.plan}</p>
      {stripe && date && (
        <p className="mt-1 text-sm text-ink-950/70">{membership.cancelAtPeriodEnd ? `Ends on ${date}` : `Next billing date: ${date}`}</p>
      )}
      {membership.status === "pastDue" && (
        <p role="status" className="mt-3 rounded-2xl border border-amber-700/30 bg-amber-50 px-4 py-3 text-sm text-amber-900 [.dark_&]:bg-amber-950/40 [.dark_&]:text-amber-200">
          We couldn't take your last payment. Update your card.
        </p>
      )}
      {stripe && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={manage}
            className="mt-5 cursor-pointer rounded-full border border-ink-950/15 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Opening…" : "Manage billing"}
          </button>
          {failed && (
            <p role="alert" className="mt-3 text-sm text-red-800 [.dark_&]:text-red-300">
              We couldn't open billing. Please try again, or call us.
            </p>
          )}
        </>
      )}
    </section>
  )
}
