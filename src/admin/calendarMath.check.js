// Self-check for calendarMath.js: `npm run check`. Runs under plain node,
// which ships full ICU, so the Tampa time zone works here as in a browser.
import assert from "node:assert/strict"
import {
  addDays,
  changeFor,
  fromTampa,
  lanes,
  matchingAppointment,
  monthGrid,
  overlaps,
  tampaParts,
  todayInTampa,
  unbookedFollowUps,
  weekDays,
  weekRange,
} from "./calendarMath.js"

// Tampa wall time to an instant: EDT (-4) before Nov 1 2026, EST (-5) after.
assert.equal(fromTampa("2026-10-05", "10:00").toISOString(), "2026-10-05T14:00:00.000Z")
assert.equal(fromTampa("2026-11-02", "10:00").toISOString(), "2026-11-02T15:00:00.000Z")
assert.equal(fromTampa("2026-11-01", "00:00").toISOString(), "2026-11-01T04:00:00.000Z")

// And back, including a late evening that is already tomorrow in UTC.
assert.deepEqual(tampaParts(new Date("2026-10-05T14:00:00Z")), { day: "2026-10-05", time: "10:00", minutes: 600 })
assert.deepEqual(tampaParts("2026-10-06T02:30:00Z"), { day: "2026-10-05", time: "22:30", minutes: 1350 })
assert.equal(todayInTampa(new Date("2026-10-06T02:30:00Z")), "2026-10-05")

// Calendar days.
assert.equal(addDays("2026-10-31", 1), "2026-11-01")
assert.equal(addDays("2026-03-01", -1), "2026-02-28")

// Weeks start on Monday. Oct 1 2026 is a Thursday.
assert.deepEqual(weekDays("2026-10-01"), ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"])
assert.equal(weekDays("2026-10-04")[0], "2026-09-28")
assert.equal(weekDays("2026-10-05")[0], "2026-10-05")

// The week with the DST change runs Monday 00:00 EDT to Monday 00:00 EST:
// 7 days plus the extra hour, so nothing on Sunday Nov 1 falls outside it.
{
  const { days, start, end } = weekRange("2026-10-29")
  assert.equal(days[6], "2026-11-01")
  assert.equal(start.toISOString(), "2026-10-26T04:00:00.000Z")
  assert.equal(end.toISOString(), "2026-11-02T05:00:00.000Z")
  assert.equal(end - start, 7 * 86_400_000 + 3_600_000)
}

// Month grid: 6 weeks from the Monday on or before the 1st.
{
  const grid = monthGrid("2026-10-15")
  assert.equal(grid.length, 42)
  assert.equal(grid[0], "2026-09-28")
  assert.equal(grid[41], "2026-11-08")
}

// Overlaps: same staff member, scheduled, time ranges intersect.
{
  const at = (id, time, extra = {}) => ({ id, staffUid: "p", status: "scheduled", minutes: 30, start: fromTampa("2026-10-05", time), ...extra })
  const booking = at("new", "10:00")
  const others = [
    at("a", "10:15"),
    at("b", "10:30"),
    at("c", "09:45"),
    at("d", "10:00", { staffUid: "q" }),
    at("e", "10:00", { status: "cancelled" }),
    at("new", "10:00"),
  ]
  assert.deepEqual(overlaps(booking, others).map((a) => a.id), ["a", "c"])
}

// Matching a follow-up to a booking: same patient and discipline, within
// 3 days either side, scheduled or completed.
{
  const followUp = { intakeId: "i1", discipline: "dietitian", date: "2026-10-10" }
  const appt = (id, day, extra = {}) => ({ id, intakeId: "i1", discipline: "dietitian", status: "scheduled", start: fromTampa(day, "09:00"), ...extra })
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-13")])?.id, "a")
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-07", { status: "completed" })])?.id, "a")
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-14")]), null)
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-10", { status: "cancelled" })]), null)
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-10", { discipline: "medical" })]), null)
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-10", { intakeId: "i2" })]), null)
  assert.deepEqual(unbookedFollowUps([followUp, { ...followUp, intakeId: "i2" }], [appt("a", "2026-10-11")]), [{ ...followUp, intakeId: "i2" }])
}

// Lanes: overlapping blocks sit side by side; a later block reuses lane 0.
{
  const placed = lanes([
    { id: "a", startMin: 600, endMin: 630 },
    { id: "b", startMin: 615, endMin: 645 },
    { id: "c", startMin: 700, endMin: 730 },
  ])
  assert.deepEqual(placed.get("a"), { lane: 0, lanes: 2 })
  assert.deepEqual(placed.get("b"), { lane: 1, lanes: 2 })
  assert.deepEqual(placed.get("c"), { lane: 0, lanes: 1 })
}

// History entries: what changed, from what, to what.
{
  const appointment = { start: fromTampa("2026-10-05", "10:00"), minutes: 30, staffUid: "p", staffName: "P", status: "scheduled", note: "" }
  const moved = changeFor(appointment, { start: fromTampa("2026-10-07", "14:00"), minutes: 30, staffUid: "p", staffName: "P", note: "" })
  assert.equal(moved.kind, "moved")
  assert.deepEqual(Object.keys(moved.from), ["start"])
  assert.equal(moved.to.start.toISOString(), "2026-10-07T18:00:00.000Z")
  assert.equal(changeFor(appointment, { start: fromTampa("2026-10-05", "10:00"), minutes: 30 }), null)
  assert.equal(changeFor(appointment, { status: "cancelled" }, "Patient called").kind, "cancelled")
  assert.equal(changeFor(appointment, { status: "cancelled" }, "Patient called").reason, "Patient called")
  assert.equal(changeFor(appointment, { status: "noShow" }).kind, "noShow")
  assert.equal(changeFor(appointment, { status: "completed" }).kind, "completed")
  assert.equal(changeFor(appointment, { note: "Bring food log" }).kind, "noteEdited")
  assert.equal(changeFor(appointment, { staffUid: "q", staffName: "Q" }).kind, "moved")
}

console.log("calendarMath: all checks passed")
