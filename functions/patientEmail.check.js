import assert from "node:assert/strict"
import { planSend } from "./patientEmail.js"

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
assert.equal(planSend({ ...base, intake: intake({ patientEmails: { accepted: { state: "sent" } } }) }).code, "already-exists")
assert.equal(planSend({ ...base, intake: intake({ patientEmails: { declined: { state: "sending" } } }) }).code, "already-exists")
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
console.log("patientEmail: ok")
