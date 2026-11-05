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

for (const endsOn of ["2026-12-05T15:00:00Z", new Date("2026-12-05T15:00:00Z")]) {
  const cancelled = buildEmail({ kind: "membershipCancelled", to: "a@b.com", endsOn })
  assert.equal(cancelled.to, "a@b.com")
  assert.equal(cancelled.subject, "Your CorePhia membership has been cancelled")
  assert.ok(cancelled.text.includes("You won't be charged again."))
  assert.ok(cancelled.text.includes("December 5, 2026"), cancelled.text)
  assert.ok(cancelled.text.includes("+1 (866) 849-2673"))
  assert.ok(!cancelled.html.includes("<a href"))
}
const endedNow = buildEmail({ kind: "membershipCancelled", to: "a@b.com", endsOn: new Date(), endedNow: true })
assert.ok(endedNow.text.includes("You won't be charged again."))
assert.ok(endedNow.text.includes("Your membership has ended."))
assert.ok(!endedNow.text.includes("stays active"), endedNow.text)

console.log("emails: ok")
