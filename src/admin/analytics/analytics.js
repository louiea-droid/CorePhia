const DAY = 86400000

function tally(values) {
  const counts = new Map()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

// Keeps a fixed sequence rather than sorting by count. Required wherever a
// colour is tied to a series (a rank sort would repaint the plans as their
// counts change) and for ordered scales, where magnitude order scrambles the
// scale's own meaning.
function tallyInOrder(values, order) {
  const counts = new Map(order.map((label) => [label, 0]))
  for (const value of values) {
    if (counts.has(value)) counts.set(value, counts.get(value) + 1)
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
}

const PLAN_ORDER = ["Core", "Core+", "Core Complete"]

// The intake's own answer order (components/intakeScreens.jsx). Patients who
// typed an exact goal weight are bucketed into the same ranges from current
// minus goal, so the chart covers everyone rather than only the tappers.
const GOAL_ORDER = ["Losing 1-15 lbs", "Losing 16-50 lbs", "Losing 51+ lbs", "Not sure, I just need to lose weight"]
const MEDICATION_INTEREST_LABELS = {
  discuss: "Wants to discuss it",
  unsure: "Not sure",
  no: "Lifestyle program only",
}
const MEDICATION_ORDER = Object.values(MEDICATION_INTEREST_LABELS)
const MEALS_ORDER = ["1", "2", "3", "4 or more", "It varies"]
const CALORIE_ORDER = ["Under 1,500", "1,500 to 2,000", "2,000 to 2,500", "Over 2,500", "Not sure"]

export function goalBucket(record) {
  const range = record.vitals?.weightLossGoalRange
  if (range) return range
  const toLose = Number(record.vitals?.currentWeightLb) - Number(record.vitals?.goalWeightLb)
  if (!Number.isFinite(toLose) || toLose <= 0) return ""
  return toLose <= 15 ? GOAL_ORDER[0] : toLose <= 50 ? GOAL_ORDER[1] : GOAL_ORDER[2]
}

export const medicationInterestLabel = (value) => MEDICATION_INTEREST_LABELS[value] ?? ""

// Same idea for calories: a typed number lands in its range.
export function calorieBucket(record) {
  const range = record.nutrition?.estimatedDailyCaloriesRange
  if (range) return range
  const calories = Number(record.nutrition?.estimatedDailyCalories)
  if (!Number.isFinite(calories) || calories <= 0) return ""
  return calories < 1500 ? CALORIE_ORDER[0] : calories < 2000 ? CALORIE_ORDER[1] : calories <= 2500 ? CALORIE_ORDER[2] : CALORIE_ORDER[3]
}
const EXERCISE_ORDER = [
  "None right now",
  "1-2 days per week",
  "3-4 days per week",
  "5 or more days per week",
]

function countSince(records, days) {
  const cutoff = Date.now() - days * DAY
  return records.filter((record) => Date.parse(record.submittedAt) >= cutoff).length
}

function average(numbers) {
  const usable = numbers.filter((value) => Number.isFinite(value) && value > 0)
  if (!usable.length) return null
  return Math.round(usable.reduce((total, value) => total + value, 0) / usable.length)
}

// Fixed-width histogram bands over a numeric field — what an average on its own
// can't say, i.e. whether patients cluster or spread. Bands with no patients in
// them are kept when they fall inside the range, so a gap in the distribution
// reads as a gap instead of silently closing up and putting two distant
// clusters side by side.
function bands(numbers, size, unit) {
  const usable = numbers.filter((value) => Number.isFinite(value) && value > 0)
  if (!usable.length) return []

  const first = Math.floor(Math.min(...usable) / size) * size
  const last = Math.floor(Math.max(...usable) / size) * size

  const buckets = []
  for (let start = first; start <= last; start += size) {
    buckets.push({
      label: `${start}–${start + size - 1} ${unit}`,
      value: usable.filter((value) => value >= start && value < start + size).length,
      // Exposed alongside label so a caller can filter records against the
      // actual numeric bounds instead of re-parsing them back out of it.
      min: start,
      max: start + size,
    })
  }
  return buckets
}

// Monday-anchored week buckets, oldest first, including weeks with no intakes so
// a quiet week reads as a gap rather than being silently dropped.
function weeklyCounts(records, weeks) {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setHours(0, 0, 0, 0)
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7))

  const buckets = []
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const start = new Date(startOfWeek)
    start.setDate(start.getDate() - offset * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    buckets.push({
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: records.filter((record) => {
        const at = Date.parse(record.submittedAt)
        return at >= start.getTime() && at < end.getTime()
      }).length,
    })
  }
  return buckets
}

export function deriveMetrics(records) {
  const total = records.length
  const consentComplete = records.filter(
    (record) => record.consent?.telehealth && record.consent?.hipaaAcknowledged,
  ).length

  const currentWeights = records.map((record) => Number(record.vitals?.currentWeightLb))
  const goalWeights = records.map((record) => Number(record.vitals?.goalWeightLb))
  const targetLosses = records
    .map((record) => Number(record.vitals?.currentWeightLb) - Number(record.vitals?.goalWeightLb))
    .filter((value) => Number.isFinite(value) && value > 0)

  // Records saved before the admission feature existed have no status field —
  // same "missing means pending" default the admin UI uses everywhere else.
  const admitted = records.filter((record) => record.status === "admitted").length
  const pending = records.filter((record) => (record.status ?? "pending") === "pending").length

  return {
    total,
    last30: countSince(records, 30),
    admitted,
    pending,
    consentCompleteRate: total ? Math.round((consentComplete / total) * 100) : 0,
    avgCurrentWeight: average(currentWeights),
    avgGoalWeight: average(goalWeights),
    avgTargetLoss: average(targetLosses),
    currentWeightBands: bands(currentWeights, 25, "lb"),
    weekly: weeklyCounts(records, 10),
    plans: tallyInOrder(
      records.map((record) => record.visit?.membershipPlan),
      PLAN_ORDER,
    ),
    reasons: tally(records.map((record) => record.visit?.reason)),
    goals: tallyInOrder(records.map(goalBucket), GOAL_ORDER),
    medicationInterest: tallyInOrder(
      records.map((record) => medicationInterestLabel(record.medicalHistory?.medicationInterest)),
      MEDICATION_ORDER,
    ),
    meals: tallyInOrder(records.map((record) => record.nutrition?.mealsPerDay), MEALS_ORDER),
    calories: tallyInOrder(records.map(calorieBucket), CALORIE_ORDER),
    conditions: tally(
      records.flatMap((record) =>
        (record.medicalHistory?.conditions ?? []).filter((item) => item !== "None of the above"),
      ),
    ),
    familyHistory: tally(
      records.flatMap((record) =>
        (record.familyHistory?.conditions ?? []).filter((item) => item !== "None of the above"),
      ),
    ),
    exercise: tallyInOrder(
      records.map((record) => record.socialHistory?.exerciseFrequency),
      EXERCISE_ORDER,
    ),
    tobacco: tally(records.map((record) => record.socialHistory?.tobacco)),
    states: tally(records.map((record) => record.demographics?.address?.state)),
  }
}
