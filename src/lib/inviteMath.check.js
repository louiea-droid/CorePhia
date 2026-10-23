// Self-check for inviteMath.js: `npm run check`. Plain node:assert, like
// chartMath.check.js.
import assert from "node:assert/strict"
import {
  inviteExpiresAt,
  inviteStatus,
  isInviteUsable,
  newInviteId,
  retryOnce,
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

// Invite ids: 128 random bits as hex.
const id = newInviteId()
assert.match(id, /^[0-9a-f]{32}$/)
assert.notEqual(id, newInviteId())

// retryOnce: a second try after one failure; false only if both fail.
let calls = 0
assert.equal(await retryOnce(async () => { calls++; if (calls === 1) throw new Error("blip") }), true)
assert.equal(calls, 2)
assert.equal(await retryOnce(async () => { throw new Error("down") }), false)
assert.equal(await retryOnce(async () => {}), true)

console.log("inviteMath: all checks passed")
