// Track progress arithmetic, shared by the admin chart and the patient
// portal. No React or Firebase, so progressMath.check.js runs under plain node.

// The intake stores numbers as text; "" or junk becomes null.
const num = (value) => {
  if (value === "" || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value ? new Date(value).getTime() : 0)
const round1 = (n) => Math.round(n * 10) / 10

export function toNumbers(baseline) {
  if (!baseline) return { startWeightLb: null, goalWeightLb: null, heightIn: null }
  const feet = num(baseline.heightFeet)
  return {
    startWeightLb: num(baseline.currentWeightLb),
    goalWeightLb: num(baseline.goalWeightLb),
    heightIn: feet ? feet * 12 + (num(baseline.heightInches) ?? 0) : null,
  }
}

// The weights to draw: visit and home entries not removed and with a weight,
// oldest first; same day, in the order they were recorded.
export function series(entries) {
  return entries
    .filter((entry) => (entry.source === "visit" || entry.source === "home") && !entry.removed && entry.weightLb != null)
    .sort((a, b) => a.date.localeCompare(b.date) || millis(a.createdAt) - millis(b.createdAt))
    .map(({ id, date, weightLb, source }) => ({ id, date, weightLb, source }))
}

// The headline numbers. Start is the intake weight, else the first weight on
// record. Anything that can't be worked out is null.
export function summary(entries, baseline) {
  const points = series(entries)
  const { startWeightLb, goalWeightLb, heightIn } = toNumbers(baseline)
  const latestLb = points.at(-1)?.weightLb ?? null
  const startLb = startWeightLb ?? points[0]?.weightLb ?? null
  return {
    latestLb,
    startLb,
    goalLb: goalWeightLb,
    changeLb: latestLb != null && startLb != null ? round1(latestLb - startLb) : null,
    toGoalLb: latestLb != null && goalWeightLb != null ? round1(Math.max(0, latestLb - goalWeightLb)) : null,
    bmi: latestLb != null && heightIn ? round1((703 * latestLb) / heightIn ** 2) : null,
  }
}

// The progress entry a signed note produces (firestore.rules checks it
// matches), or null when the note recorded none of the four numbers.
export function visitEntryFor(note) {
  const vitals = note?.vitals ?? {}
  const numbers = {
    weightLb: vitals.weightLb ?? null,
    systolic: vitals.systolic ?? null,
    diastolic: vitals.diastolic ?? null,
    heartRate: vitals.heartRate ?? null,
  }
  if (Object.values(numbers).every((value) => value == null)) return null
  return { source: "visit", date: note.visitDate, ...numbers, noteId: note.id, removed: false }
}

// Is YYYY-MM-DD `date` between `days` before `today` and `today`?
export function withinDays(date, today, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return false
  const utc = (iso) => Date.UTC(...iso.split("-").map((part, index) => Number(part) - (index === 1 ? 1 : 0)))
  const diff = Math.round((utc(today) - utc(date)) / 86_400_000)
  return diff >= 0 && diff <= days
}
