// Self-check for billing.js (run by npm run check).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  priceForPlan, planForPrice, membershipFromSubscription, checkoutDecision, cancelOnDischarge,
  subscriptionIdFromEvent, subscriptionConflict, isTransientStripeError, cancelForInactiveChart,
} from "./billing.js"

assert.equal(priceForPlan("Core"), "price_1UYAmdGfYKc3UVG5MLvaqCfg")
assert.equal(priceForPlan("nope"), null)
assert.equal(planForPrice("price_1UYAmIGfYKc3UVG5L161NXEW"), "Core Complete")
assert.equal(planForPrice("x"), null)

// every plan on the site has a price (pricingTiers.js imports JSX, so read it as text)
const src = readFileSync(new URL("../src/data/pricingTiers.js", import.meta.url), "utf8")
const names = [...src.matchAll(/^\s*name: "([^"]+)"/gm)].map((m) => m[1])
assert.ok(names.length >= 2)
for (const n of names) assert.ok(priceForPlan(n), `no price for ${n}`)

const sub = (status, extra = {}) => ({
  status, start_date: 1000, cancel_at_period_end: true,
  items: { data: [{ price: { id: "price_1UYAmdGfYKc3UVG5MLvaqCfg" }, current_period_end: 2000 }] },
  ...extra,
})
const map = { active: "active", trialing: "active", past_due: "pastDue", canceled: "ended", unpaid: "ended", incomplete_expired: "ended" }
for (const [s, m] of Object.entries(map)) assert.equal(membershipFromSubscription(sub(s)).status, m)
assert.equal(membershipFromSubscription(sub("incomplete")), null)
assert.equal(membershipFromSubscription({ ...sub("active"), items: { data: [{ price: { id: "x" }, current_period_end: 1 }] } }), null)

const m = membershipFromSubscription(sub("active"))
assert.deepEqual(m, {
  plan: "Core", status: "active", currentPeriodEnd: new Date(2000000),
  cancelAtPeriodEnd: true, since: new Date(1000000), source: "stripe",
})
// older API: period end on the subscription
const old = sub("active")
delete old.items.data[0].current_period_end
old.current_period_end = 3000
assert.deepEqual(membershipFromSubscription(old).currentPeriodEnd, new Date(3000000))
// since kept from existing; same input twice is equal
const since = new Date(5)
assert.deepEqual(membershipFromSubscription(sub("active"), { since }).since, since)
assert.deepEqual(membershipFromSubscription(sub("active")), membershipFromSubscription(sub("active")))

const active = { status: "active" }
assert.equal(checkoutDecision(null, null), "refuse")
assert.equal(checkoutDecision({ status: "inactive" }, null), "refuse")
assert.equal(checkoutDecision(active, { status: "active" }), "portal")
assert.equal(checkoutDecision(active, { status: "pastDue" }), "portal")
assert.equal(checkoutDecision(active, undefined), "checkout")
assert.equal(checkoutDecision(active, { status: "ended" }), "checkout")

const live = { status: "inactive", membership: { source: "stripe", status: "active" } }
assert.equal(cancelOnDischarge(active, live), true)
assert.equal(cancelOnDischarge(active, { status: "inactive", membership: { source: "manual", status: "active" } }), false)
assert.equal(cancelOnDischarge(active, { status: "inactive", membership: { source: "stripe", status: "ended" } }), false)
assert.equal(cancelOnDischarge({ status: "inactive" }, live), false)

const ev = (type, object) => ({ type, data: { object } })
assert.equal(subscriptionIdFromEvent(ev("customer.subscription.updated", { id: "sub_1" })), "sub_1")
assert.equal(subscriptionIdFromEvent(ev("customer.subscription.deleted", { id: "sub_1" })), "sub_1")
assert.equal(subscriptionIdFromEvent(ev("checkout.session.completed", { mode: "subscription", subscription: "sub_2" })), "sub_2")
assert.equal(subscriptionIdFromEvent(ev("checkout.session.completed", { mode: "payment", subscription: null })), null)
assert.equal(subscriptionIdFromEvent(ev("invoice.payment_failed", { subscription: "sub_3" })), "sub_3")
assert.equal(subscriptionIdFromEvent(ev("invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_4" } } })), "sub_4")
assert.equal(subscriptionIdFromEvent(ev("invoice.payment_failed", { subscription: { id: "sub_5" } })), "sub_5")
assert.equal(subscriptionIdFromEvent(ev("invoice.payment_failed", { parent: null })), null)
assert.equal(subscriptionIdFromEvent(ev("invoice.paid", { subscription: "sub_6" })), null)
assert.equal(subscriptionIdFromEvent(null), null)

const onFile = { source: "stripe", status: "active" }
assert.equal(subscriptionConflict({ status: "active" }, onFile, null, "sub_new"), null)
assert.equal(subscriptionConflict({ status: "ended" }, onFile, "sub_new", "sub_new"), null)
assert.equal(subscriptionConflict({ status: "ended" }, onFile, "sub_new", "sub_old"), "stale")
assert.equal(subscriptionConflict({ status: "active" }, onFile, "sub_old", "sub_new"), "duplicate")
assert.equal(subscriptionConflict({ status: "active" }, { source: "stripe", status: "ended" }, "sub_old", "sub_new"), null)
assert.equal(subscriptionConflict({ status: "active" }, { source: "manual", status: "active" }, "sub_old", "sub_new"), null)
assert.equal(subscriptionConflict({ status: "active" }, undefined, "sub_old", "sub_new"), null)

assert.equal(isTransientStripeError({ type: "StripeConnectionError" }), true)
assert.equal(isTransientStripeError({ type: "StripeAPIError", statusCode: 500 }), true)
assert.equal(isTransientStripeError({ type: "StripeRateLimitError", statusCode: 429 }), true)
assert.equal(isTransientStripeError({ type: "StripeInvalidRequestError", statusCode: 409 }), true)
assert.equal(isTransientStripeError({ type: "StripeInvalidRequestError", statusCode: 400 }), false)
assert.equal(isTransientStripeError({ type: "StripeInvalidRequestError", statusCode: 404 }), false)
assert.equal(isTransientStripeError(new Error("x")), false)

for (const st of ["active", "trialing", "past_due"]) assert.equal(cancelForInactiveChart({ status: "inactive" }, { status: st }), true)
assert.equal(cancelForInactiveChart({ status: "inactive" }, { status: "active", cancel_at_period_end: true }), true)
for (const st of ["canceled", "unpaid", "incomplete", "incomplete_expired"]) assert.equal(cancelForInactiveChart({ status: "inactive" }, { status: st }), false)
assert.equal(cancelForInactiveChart({ status: "active" }, { status: "active" }), false)
assert.equal(cancelForInactiveChart(undefined, { status: "active" }), false)

console.log("billing: ok")
