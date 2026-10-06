// Self-check for progressMath.js: `npm run check`. Plain node:assert.
import assert from "node:assert/strict"
import { series, summary, toNumbers, visitEntryFor, withinDays } from "./progressMath.js"

const at = (iso) => ({ toMillis: () => new Date(iso).getTime() })
const home = (id, date, weightLb, extra = {}) => ({ id, source: "home", date, weightLb, createdAt: at(`${date}T12:00:00Z`), removed: false, ...extra })
const visit = (id, date, weightLb, extra = {}) => ({ id, source: "visit", date, weightLb, systolic: 120, diastolic: 80, heartRate: 70, createdAt: at(`${date}T09:00:00Z`), removed: false, ...extra })
const baseline = (overrides = {}) => ({ source: "baseline", heightFeet: "5", heightInches: "10", currentWeightLb: "210", goalWeightLb: "180", removed: false, ...overrides })

// The intake's strings become numbers; blanks become null.
assert.deepEqual(toNumbers(baseline()), { startWeightLb: 210, goalWeightLb: 180, heightIn: 70 })
assert.deepEqual(toNumbers(baseline({ goalWeightLb: "", heightFeet: "" })), { startWeightLb: 210, goalWeightLb: null, heightIn: null })
assert.deepEqual(toNumbers(baseline({ heightInches: "" })).heightIn, 60)
assert.deepEqual(toNumbers(null), { startWeightLb: null, goalWeightLb: null, heightIn: null })

// Series: live weights only, by date then time logged; baseline, removed and weightless entries skipped.
const entries = [
  home("h2", "2026-10-05", 201),
  visit("v1", "2026-10-01", 205),
  visit("v2", "2026-10-05", 202),
  home("gone", "2026-10-03", 150, { removed: at("2026-10-04T00:00:00Z") }),
  visit("bp", "2026-10-04", null),
  baseline(),
]
assert.deepEqual(series(entries).map((point) => point.id), ["v1", "v2", "h2"])

// Summary from the baseline start weight.
assert.deepEqual(summary(entries, baseline()), { latestLb: 201, startLb: 210, goalLb: 180, changeLb: -9, toGoalLb: 21, bmi: 28.8 })
// No baseline: start is the earliest weight; no goal or BMI.
assert.deepEqual(summary(entries, null), { latestLb: 201, startLb: 205, goalLb: null, changeLb: -4, toGoalLb: null, bmi: null })
// At or under the goal: 0 to go.
assert.equal(summary([home("h", "2026-10-05", 175)], baseline()).toGoalLb, 0)
// Nothing logged: only the baseline numbers.
assert.deepEqual(summary([], baseline()), { latestLb: null, startLb: 210, goalLb: 180, changeLb: null, toGoalLb: null, bmi: null })

// Visit entry from a note: its date and four numbers, or null with none.
assert.deepEqual(visitEntryFor({ id: "n1", visitDate: "2026-10-05", vitals: { weightLb: 200, systolic: 118, diastolic: null, heartRate: undefined } }), {
  source: "visit",
  date: "2026-10-05",
  weightLb: 200,
  systolic: 118,
  diastolic: null,
  heartRate: null,
  noteId: "n1",
  removed: false,
})
assert.equal(visitEntryFor({ id: "n2", visitDate: "2026-10-05", vitals: { weightLb: null } }), null)
assert.equal(visitEntryFor({ id: "n3", visitDate: "2026-10-05" }), null)

// The log form's date window.
assert.equal(withinDays("2026-10-06", "2026-10-06", 30), true)
assert.equal(withinDays("2026-09-06", "2026-10-06", 30), true)
assert.equal(withinDays("2026-09-05", "2026-10-06", 30), false)
assert.equal(withinDays("2026-10-07", "2026-10-06", 30), false)
assert.equal(withinDays("", "2026-10-06", 30), false)

console.log("progressMath: all checks passed")
