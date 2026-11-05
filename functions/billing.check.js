// Self-check for billing.js (run by npm run check).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  priceForPlan, planForPrice, membershipFromSubscription, checkoutDecision, cancelOnDischarge,
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

console.log("billing: ok")
