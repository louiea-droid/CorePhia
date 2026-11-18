// Self-check for emails.js (run by npm run check).
import assert from "node:assert/strict"
import { buildEmail } from "./emails.js"

const alert = buildEmail({ kind: "newIntake", receivedAt: "2026-11-04T19:14:00Z" })
assert.deepEqual(alert.to, ["providermd@corephia.com", "care@corephia.com"])
assert.ok(alert.text.includes("Wednesday, November 4, 2026 at 2:14 PM"), alert.text)
assert.ok(alert.html.includes("/admin/applicants"))

const receipt = buildEmail({ kind: "intakeReceipt", to: "a@b.com" })
assert.equal(receipt.to, "a@b.com")
assert.ok(receipt.text.includes("We've received your form"))
// The only links: both plans' Elation sign-ups (never which plan was picked).
assert.deepEqual(receipt.html.match(/href="[^"]+"/g), [
  'href="https://app.elationemr.com/membership/1449583043739652/1451540339032515"',
  'href="https://app.elationemr.com/membership/1449583043739652/1451543320199619"',
])

// Portal, invite and membership emails retired with Elation (2026-11-13).
for (const kind of ["invite", "update", "message", "staff", "membershipCancelled", "other"]) {
  assert.throws(() => buildEmail({ kind, to: "a@b.com", chartId: "c", inviteId: "i" }), kind)
}

console.log("emails: ok")
