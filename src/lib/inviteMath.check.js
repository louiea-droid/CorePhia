// Self-check for inviteMath.js: `npm run check`. Plain node:assert, like
// chartMath.check.js.
import assert from "node:assert/strict"
import {
  DEFAULT_INVITE,
  escapeMessage,
  fillTemplate,
  inviteExpiresAt,
  inviteStatus,
  isInviteUsable,
  newInviteId,
  toTemplate,
} from "./inviteMath.js"

const DAY = 86400000
const now = new Date("2026-10-10T12:00:00Z")
const sentAgo = (ms) => ({ status: "sent", sentAt: new Date(now - ms) })

// Status: newest invite first; a linked account wins over anything.
assert.equal(inviteStatus([], false, now).kind, "none")
assert.equal(inviteStatus([{ status: "ready" }], false, now).kind, "sending")
assert.equal(inviteStatus([{ status: "failed", error: "x" }], false, now).kind, "failed")
assert.equal(inviteStatus([sentAgo(DAY)], false, now).kind, "sent")
assert.equal(inviteStatus([sentAgo(8 * DAY)], false, now).kind, "expired")
assert.equal(inviteStatus([{ status: "failed" }], true, now).kind, "active")
assert.equal(inviteStatus([], true, now).kind, "active")
const newest = sentAgo(DAY)
assert.equal(inviteStatus([newest, { status: "failed" }], false, now).invite, newest)

// The 7-day boundary: exactly 7 days is expired, a minute less is not.
assert.equal(isInviteUsable(sentAgo(7 * DAY), now), false)
assert.equal(isInviteUsable(sentAgo(7 * DAY - 60000), now), true)
assert.equal(isInviteUsable({ status: "ready" }, now), false)
assert.equal(isInviteUsable({ status: "sent", sentAt: null }, now), false)
assert.equal(inviteExpiresAt({ status: "sent", sentAt: new Date(0) }).getTime(), 7 * DAY)
// Firestore Timestamps come back with toDate().
assert.equal(isInviteUsable({ status: "sent", sentAt: { toDate: () => new Date(now - DAY) } }, now), true)

// Templates: placeholders filled, and put back when saved as the default.
const filled = fillTemplate("Hi {firstName}, call {phone}. {firstName}!", { firstName: "Maria", phone: "(000) 123-4567" })
assert.equal(filled, "Hi Maria, call (000) 123-4567. Maria!")
assert.equal(fillTemplate("Hi {firstName},", { firstName: "", phone: "" }), "Hi there,")
assert.equal(toTemplate(filled, { firstName: "Maria", phone: "(000) 123-4567" }), "Hi {firstName}, call {phone}. {firstName}!")
const values = { firstName: "Maria", phone: "(000) 123-4567" }
assert.equal(toTemplate(fillTemplate(DEFAULT_INVITE.message, values), values), DEFAULT_INVITE.message)
assert.equal(toTemplate("Hi there", { firstName: "", phone: "" }), "Hi there")

// Staff text never becomes markup in the email.
assert.equal(escapeMessage("<b>&\nx"), "&lt;b&gt;&amp;<br>x")
assert.equal(escapeMessage(`a"b'c\r\nd`), "a&quot;b&#39;c<br>d")

// Invite ids: 128 random bits as hex.
const id = newInviteId()
assert.match(id, /^[0-9a-f]{32}$/)
assert.notEqual(id, newInviteId())

console.log("inviteMath: all checks passed")
