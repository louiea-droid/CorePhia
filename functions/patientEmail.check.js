import assert from "node:assert/strict"
import { planSend, EMAIL, isStaleClaim, sendLabel } from "./patientEmail.js"

const intake = (extra = {}) => ({ status: "pending", demographics: { email: " Pat@X.co ", firstName: "Pat" }, ...extra })
const tpl = (purpose, status = "published") => ({ purpose, status })
const base = { mode: "decision", role: "provider", intake: intake(), template: tpl("declined") }

assert.deepEqual(planSend(base), { ok: true, to: "pat@x.co", kind: "declined", nextStatus: "declined" })
assert.equal(planSend({ ...base, template: tpl("accepted") }).nextStatus, "admitted")
assert.equal(planSend({ ...base, role: "dietitian" }).code, "permission-denied")
assert.equal(planSend({ ...base, template: tpl("declined", "draft") }).code, "failed-precondition")
assert.equal(planSend({ ...base, template: tpl("manual") }).code, "invalid-argument")
assert.equal(planSend({ ...base, intake: intake({ demographics: { email: "nope" } }) }).code, "failed-precondition")
// once per intake, either kind, including an in-flight claim
const now = Date.parse("2026-11-16T15:00:00Z")
const minutesAgo = (m) => now - m * 60 * 1000
assert.deepEqual(planSend({ ...base, now, intake: intake({ patientEmails: { accepted: { state: "sent", sentAt: "2026-11-16T14:00:00.000Z" } } }) }), {
  ok: false,
  code: "already-exists",
  message: "An acceptance email was already sent for this applicant.",
})
assert.equal(
  planSend({ ...base, now, intake: intake({ patientEmails: { declined: { state: "sent" } } }) }).message,
  "A decline email was already sent for this applicant.",
)
const sending = (claimedAt) => intake({ patientEmails: { declined: { state: "sending", claimedAt } } })
assert.deepEqual(planSend({ ...base, now, intake: sending(minutesAgo(1)) }), {
  ok: false,
  code: "already-exists",
  message: "A decline email is already being sent for this applicant.",
})
// A claim stuck at "sending" (the function crashed mid-send) stops blocking after 10 minutes.
assert.equal(planSend({ ...base, now, intake: sending(minutesAgo(11)) }).ok, true)
assert.equal(planSend({ ...base, now, intake: sending({ toMillis: () => minutesAgo(11) }) }).ok, true)
assert.equal(planSend({ ...base, now, intake: sending({ toMillis: () => minutesAgo(9) }) }).code, "already-exists")
// A sent email never goes stale.
assert.equal(planSend({ ...base, now, intake: intake({ patientEmails: { accepted: { state: "sent", claimedAt: minutesAgo(60) } } }) }).code, "already-exists")
// No clock or no claim time: still blocks.
assert.equal(planSend({ ...base, intake: sending(minutesAgo(60)) }).code, "already-exists")
assert.equal(planSend({ ...base, now, intake: sending(undefined) }).code, "already-exists")
assert.ok(isStaleClaim({ state: "sending", claimedAt: minutesAgo(11) }, now))
assert.ok(!isStaleClaim({ state: "sending", claimedAt: minutesAgo(9) }, now))

// Audit labels: who the decision or New email went to.
const named = intake({ demographics: { email: "a@b.co", firstName: " Jane ", lastName: "Doe " } })
assert.equal(sendLabel({ mode: "decision", kind: "accepted", intake: named, template: tpl("accepted") }), "Acceptance email to Jane Doe")
assert.equal(sendLabel({ mode: "decision", kind: "declined", intake: named, template: tpl("declined") }), "Decline email to Jane Doe")
assert.equal(sendLabel({ mode: "manual", kind: "manual", intake: named, template: tpl("manual") }), "New email to Jane Doe")
assert.equal(sendLabel({ mode: "manual", kind: "manual", intake: intake({ demographics: {} }), template: tpl("manual") }), "New email")
assert.equal(sendLabel({ mode: "decision", kind: "declined", intake: intake({ demographics: { firstName: "J".repeat(300) } }), template: tpl("declined") }).length, 200)
assert.equal(sendLabel({ mode: "test", kind: "test", intake: null, template: tpl("welcome") }), "Welcome email")
// manual
assert.equal(planSend({ ...base, mode: "manual", template: tpl("manual") }).ok, true)
assert.equal(planSend({ ...base, mode: "manual", template: tpl("declined") }).code, "invalid-argument")
assert.equal(planSend({ ...base, mode: "manual", template: tpl("manual"), intake: intake({ patientEmails: { declined: { state: "sent" } } }) }).ok, true)
// test
assert.equal(planSend({ mode: "test", role: "provider", template: tpl("declined", "draft"), callerEmail: "a@b.co" }).code, "permission-denied")
assert.deepEqual(planSend({ mode: "test", role: "admin", template: tpl("declined", "draft"), callerEmail: "a@b.co" }), { ok: true, to: "a@b.co", kind: "test" })
// missing pieces
assert.equal(planSend({ ...base, template: null }).code, "not-found")
assert.equal(planSend({ ...base, intake: null }).code, "not-found")
assert.ok(EMAIL.test("smith@gmail.com") && EMAIL.test("a.b@yahoo.com"))
assert.ok(!EMAIL.test("nope") && !EMAIL.test("a b@x.co"))
console.log("patientEmail: ok")
