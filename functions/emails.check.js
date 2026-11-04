// Self-check for emails.js (run by npm run check).
import assert from "node:assert/strict"
import { buildEmail } from "./emails.js"

const invite = buildEmail({ kind: "invite", to: "a@b.com", chartId: "c1", inviteId: "i&2" })
assert.equal(invite.to, "a@b.com")
assert.ok(invite.html.includes("https://corephia.com/portal/setup?c=c1&i=i%262"))
assert.ok(invite.text.includes("https://corephia.com/portal/setup?c=c1&i=i%262"))

assert.ok(buildEmail({ kind: "update", to: "a@b.com" }).html.includes("/account/updates"))
assert.ok(buildEmail({ kind: "message", to: "a@b.com" }).html.includes("/account/messages"))
assert.equal(buildEmail({ kind: "staff", to: "someone@else.com" }).to, "info@corephia.com")

const alert = buildEmail({ kind: "newIntake", receivedAt: "2026-11-04T19:14:00Z" })
assert.deepEqual(alert.to, ["providermd@corephia.com"])
assert.ok(alert.text.includes("Wednesday, November 4, 2026 at 2:14 PM"), alert.text)
assert.ok(alert.html.includes("/admin/applicants"))

const receipt = buildEmail({ kind: "intakeReceipt", to: "a@b.com" })
assert.equal(receipt.to, "a@b.com")
assert.ok(receipt.text.includes("A member of our staff will contact you shortly."))
assert.ok(!receipt.html.includes("<a href"))

for (const kind of ["invite", "update", "message", "staff"]) {
  const email = buildEmail({ kind, to: "a@b.com", chartId: "c", inviteId: "i" })
  assert.ok(email.subject && email.text && email.html)
}
assert.throws(() => buildEmail({ kind: "other", to: "a@b.com" }))

console.log("emails: ok")
