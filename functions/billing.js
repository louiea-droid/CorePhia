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
