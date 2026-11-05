// Pure billing logic (no imports, so the client could share it later).
export const MODE = "test"
export const PRICES = {
  test: {
    Core: "price_1UYAmdGfYKc3UVG5MLvaqCfg",
    "Core Complete": "price_1UYAmIGfYKc3UVG5L161NXEW",
  },
  live: {},
}

export const priceForPlan = (plan) => PRICES[MODE][plan] ?? null
export const planForPrice = (priceId) =>
  Object.keys(PRICES[MODE]).find((p) => PRICES[MODE][p] === priceId) ?? null

const STATUS = {
  active: "active",
  trialing: "active",
  past_due: "pastDue",
  canceled: "ended",
  unpaid: "ended",
  incomplete_expired: "ended",
}

export function membershipFromSubscription(sub, existing) {
  const status = STATUS[sub.status]
  const item = sub.items?.data?.[0]
  const plan = planForPrice(item?.price?.id)
  if (!status || !plan) return null
  const end = item.current_period_end ?? sub.current_period_end
  return {
    plan,
    status,
    currentPeriodEnd: new Date(end * 1000),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    since: existing?.since ?? new Date(sub.start_date * 1000),
    source: "stripe",
  }
}

export function checkoutDecision(chart, membership) {
  if (!chart || chart.status !== "active") return "refuse"
  if (membership?.status === "active" || membership?.status === "pastDue") return "portal"
  return "checkout"
}

export const cancelOnDischarge = (before, after) =>
  before?.status === "active" &&
  after?.status === "inactive" &&
  after.membership?.source === "stripe" &&
  after.membership.status !== "ended"

// The subscription a webhook event is about, or null for events we ignore.
// An invoice names it at the top on older API versions and under
// parent.subscription_details from 2025-03-31 on.
const SUBSCRIPTION_EVENTS = ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]
export function subscriptionIdFromEvent(event) {
  const obj = event?.data?.object ?? {}
  let id = null
  if (SUBSCRIPTION_EVENTS.includes(event?.type)) id = obj.id
  else if (event?.type === "checkout.session.completed") id = obj.mode === "subscription" ? obj.subscription : null
  else if (event?.type === "invoice.payment_failed") id = obj.subscription ?? obj.parent?.subscription_details?.subscription
  if (id && typeof id === "object") id = id.id
  return typeof id === "string" && id ? id : null
}
