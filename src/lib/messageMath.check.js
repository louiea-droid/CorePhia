// Self-check for messageMath.js: `npm run check`. Plain node:assert.
import assert from "node:assert/strict"
import { byLatest, needsReply, notifiesStaff, patientRoleLabel, topicCounts, unreadFor } from "./messageMath.js"

const at = (iso) => ({ toMillis: () => new Date(iso).getTime() })
const topic = (overrides = {}) => ({
  status: "open",
  lastFrom: "patient",
  lastMessageAt: at("2026-10-06T10:00:00Z"),
  patientReadAt: at("2026-10-06T10:00:00Z"),
  staffReadAt: null,
  ...overrides,
})

// Needs a reply: open, and the patient wrote last.
assert.equal(needsReply(topic()), true)
assert.equal(needsReply(topic({ lastFrom: "staff" })), false)
assert.equal(needsReply(topic({ status: "closed" })), false)

// Unread for a side: the other side wrote after this side last looked.
assert.equal(unreadFor(topic(), "staff"), true)
assert.equal(unreadFor(topic({ staffReadAt: at("2026-10-06T10:05:00Z") }), "staff"), false)
assert.equal(unreadFor(topic(), "patient"), false)
assert.equal(unreadFor(topic({ lastFrom: "staff", patientReadAt: at("2026-10-06T09:00:00Z") }), "patient"), true)

// Email info@ only when the patient's message makes the topic newly need a reply.
assert.equal(notifiesStaff(null), true)
assert.equal(notifiesStaff(topic({ lastFrom: "staff" })), true)
assert.equal(notifiesStaff(topic({ lastFrom: "patient" })), false)
assert.equal(notifiesStaff(topic({ lastFrom: "patient", status: "closed" })), true)

// Counts for the sidebar and filters.
assert.deepEqual(topicCounts([topic(), topic({ lastFrom: "staff" }), topic({ status: "closed" })]), { needsReply: 1, open: 2, closed: 1 })

// Newest activity first.
const older = topic({ lastMessageAt: at("2026-10-01T10:00:00Z") })
const newer = topic({ lastMessageAt: at("2026-10-05T10:00:00Z") })
assert.deepEqual([older, newer].sort(byLatest), [newer, older])

// How a staff role reads to a patient.
assert.equal(patientRoleLabel("admin"), "Provider")
assert.equal(patientRoleLabel("dietitian"), "Dietitian")
assert.equal(patientRoleLabel("superAdmin"), "Care team")
assert.equal(patientRoleLabel(undefined), "Care team")

console.log("messageMath: all checks passed")
