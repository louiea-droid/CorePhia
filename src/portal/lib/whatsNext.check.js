// Self-check for whatsNext.js: `npm run check`. Plain node:assert.
import assert from "node:assert/strict"
import { fromTampa } from "../../admin/calendar/calendarMath.js"
import { whatsNext } from "./whatsNext.js"

const at = (day, time) => fromTampa(day, time)
const now = at("2026-11-10", "10:45")
const visit = (over = {}) => ({ id: "v", start: at("2026-11-10", "10:30"), minutes: 30, discipline: "medical", staffRole: "provider", status: "scheduled", ...over })
const run = (over = {}) => whatsNext({ membership: { status: "active" }, visits: [visit({ status: "completed" })], topics: [], updates: [], progress: [], now, ...over })
const kind = (over) => run(over).main.kind

// Past due first; the next two applicable follow in `more`, never more than two.
const busy = run({
  membership: { status: "pastDue" },
  visits: [visit()],
  topics: [{ lastFrom: "staff", lastMessageAt: new Date(2000), patientReadAt: new Date(1000) }],
  updates: [{ id: "u1" }],
  progress: [{ date: "2026-10-01", weightLb: 200 }],
})
assert.equal(busy.main.kind, "pastDue")
assert.deepEqual(busy.more.map((r) => r.kind), ["visitToday", "newReply"])

// Visit today at 10:30 for 30 minutes.
assert.equal(kind({ visits: [visit()] }), "visitToday")
assert.equal(run({ visits: [visit()] }).main.title, "Your visit is today at 10:30 AM with your provider")
const later = at("2026-11-10", "11:01")
assert.notEqual(whatsNext({ visits: [visit()], topics: [], updates: [], progress: [], now: later }).main.kind, "visitToday")
for (const status of ["cancelled", "completed", "noShow"]) assert.notEqual(kind({ visits: [visit({ status })] }), "visitToday")

// A later visit.
const future = run({ visits: [visit({ start: at("2026-11-12", "10:30"), staffRole: "dietitian" })] }).main
assert.equal(future.kind, "nextVisit")
assert.equal(future.title, "Your next visit: Thursday, November 12 at 10:30 AM with your dietitian")
assert.match(run({ visits: [visit({ start: at("2026-11-12", "10:30"), staffRole: "x" })] }).main.title, /with your care team$/)

// Replies: two topics, one unread, one reminder.
const read = { lastFrom: "staff", lastMessageAt: new Date(1000), patientReadAt: new Date(2000) }
const unread = { lastFrom: "staff", lastMessageAt: new Date(2000), patientReadAt: new Date(1000) }
const replies = run({ topics: [read, unread], updates: [{ id: "u" }], lastSeenUpdateId: "u" })
assert.equal(replies.main.kind, "newReply")
assert.equal(replies.more.length, 0)

// Updates.
assert.equal(kind({ updates: [{ id: "u2" }, { id: "u1" }], lastSeenUpdateId: "u1" }), "newUpdate")
assert.equal(kind({ updates: [{ id: "u1" }], lastSeenUpdateId: "u1" }), "nextVisitUnbooked")
assert.equal(kind({ updates: [] }), "nextVisitUnbooked")

// Weigh-in boundary.
assert.equal(kind({ progress: [{ date: "2026-11-03", weightLb: 1 }] }), "nextVisitUnbooked")
const eight = run({ progress: [{ date: "2026-11-02", weightLb: 1 }, { date: "2026-10-01", weightLb: 1 }] }).main
assert.equal(eight.kind, "weighIn")
assert.equal(eight.title, "Time for a weigh-in. Your last one was 8 days ago.")

// Ending only for an active membership that cancels.
const ends = { status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: at("2026-11-27", "12:00") }
assert.equal(run({ membership: ends }).main.title, "Your membership ends on November 27, 2026")
assert.equal(kind({ membership: { ...ends, cancelAtPeriodEnd: false } }), "nextVisitUnbooked")
assert.equal(kind({ membership: { ...ends, status: "ended" } }), "nextVisitUnbooked")


// Actions.
assert.equal(busy.main.action, "billing")
assert.equal(busy.more[0].action, "message-us")
assert.equal(busy.more[1].action, "messages")
assert.equal(run({ visits: [visit({ start: at("2026-11-12", "10:30") })] }).main.action, "message-us")
assert.equal(run({ membership: ends }).main.action, "billing")
assert.equal(run({ visits: [] }).main.action, "message-us")
assert.equal(run().main.action, "message-us")

// currentPeriodEnd: required, and a Date, Timestamp-like or ISO string.
assert.equal(kind({ membership: { ...ends, currentPeriodEnd: undefined } }), "nextVisitUnbooked")
const endTitle = "Your membership ends on November 27, 2026"
assert.equal(run({ membership: { ...ends, currentPeriodEnd: { toDate: () => at("2026-11-27", "12:00") } } }).main.title, endTitle)
assert.equal(run({ membership: { ...ends, currentPeriodEnd: "2026-11-27T17:00:00Z" } }).main.title, endTitle)

assert.equal(kind({ membership: { ...ends, currentPeriodEnd: "not a date" } }), "nextVisitUnbooked")
assert.equal(run({ updates: [{ id: "u2" }], lastSeenUpdateId: "u1" }).main.action, "updates")
assert.equal(run({ progress: [{ date: "2026-11-02", weightLb: 1 }] }).main.action, "log-weight")

// Fallbacks.
assert.equal(kind({ visits: [] }), "firstVisit")
assert.equal(kind({ visits: [visit({ status: "completed" })] }), "nextVisitUnbooked")
assert.equal(run({ visits: [] }).more.length, 0)

// A discharged chart (still a member until the paid month ends): no weigh-in, a closing line.
const stale = [{ date: "2026-11-02", weightLb: 1 }]
const closedRun = run({ chartStatus: "inactive", membership: { status: "active", currentPeriodEnd: at("2026-11-27", "12:00") }, progress: stale }).main
assert.equal(closedRun.kind, "closed")
assert.equal(closedRun.title, "Your program with CorePhia is closed. Your membership ends on November 27, 2026.")
assert.equal(closedRun.action, "message-us")
assert.equal(run({ chartStatus: "inactive", progress: stale }).main.title, "Your program with CorePhia is closed.")
assert.equal(kind({ chartStatus: "active", progress: stale }), "weighIn")

console.log("whatsNext: ok")
