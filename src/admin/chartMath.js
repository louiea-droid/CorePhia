// Pure chart arithmetic, kept free of React and Firebase so chartMath.check.js
// can run it under plain node.

const millis = (value) =>
  value == null ? 0 : typeof value.toMillis === "function" ? value.toMillis() : new Date(value).getTime()

// What a patient is currently prescribed, from their signed notes. Each
// "start" opens a chain; a "renew" (renewsId → the start or an earlier renew)
// moves the chain's renewal date and, if given, its instructions; a "stop"
// pointing anywhere in the chain ends it. Drafts are ignored: an unsigned
// note isn't part of the record yet.
export function currentPrescriptions(notes) {
  const entries = notes
    .filter((note) => note.status === "signed")
    .sort((a, b) => millis(a.signedAt) - millis(b.signedAt))
    .flatMap((note) => note.prescriptions ?? [])

  const chainOf = new Map() // entry id → the id of its chain's start
  const chains = new Map() // start id → current prescription

  for (const entry of entries) {
    if (entry.action === "start") {
      chainOf.set(entry.id, entry.id)
      chains.set(entry.id, {
        id: entry.id,
        medication: entry.medication,
        instructions: entry.instructions,
        startDate: entry.startDate,
        renewalDue: entry.renewalDue,
      })
      continue
    }
    const root = chainOf.get(entry.renewsId)
    if (!root || !chains.has(root)) continue
    chainOf.set(entry.id, root)
    if (entry.action === "stop") {
      chains.delete(root)
    } else if (entry.action === "renew") {
      const current = chains.get(root)
      chains.set(root, {
        ...current,
        renewalDue: entry.renewalDue,
        instructions: entry.instructions || current.instructions,
      })
    }
  }
  return [...chains.values()]
}

export const DISCIPLINES = ["medical", "dietitian", "exercise"]

// Consultation and progress notes (and anything older with no type) are the
// medical record; dietitian and exercise notes are their own disciplines.
export const disciplineOf = (type) => (type === "dietitian" || type === "exercise" ? type : "medical")

const newestVisitFirst = (a, b) =>
  (b.visitDate ?? "").localeCompare(a.visitDate ?? "") || millis(b.signedAt) - millis(a.signedAt)
const signedNewestFirst = (notes) => notes.filter((note) => note.status === "signed").sort(newestVisitFirst)

// The latest signed note of each discipline: { medical, dietitian, exercise },
// a key missing when that discipline has no signed note yet.
export function latestSignedByDiscipline(notes) {
  const latest = {}
  for (const note of signedNewestFirst(notes)) latest[disciplineOf(note.type)] ??= note
  return latest
}

export const currentExercisePlan = (notes) => latestSignedByDiscipline(notes).exercise?.exercisePlan ?? null

// Each discipline's next follow-up, from that discipline's latest signed
// note only: a later note with no date clears an earlier one.
export function nextFollowUps(notes) {
  const latest = latestSignedByDiscipline(notes)
  return DISCIPLINES.filter((discipline) => latest[discipline]?.nextFollowUp).map((discipline) => ({
    discipline,
    date: latest[discipline].nextFollowUp,
  }))
}

// Calendar days from one YYYY-MM-DD to another, negative when `to` is earlier.
// Date.UTC so a DST change in between doesn't shave off an hour and a day.
const utcDay = (iso) => {
  const [year, month, day] = iso.split("-").map(Number)
  return Date.UTC(year, month - 1, day)
}
export const daysFrom = (from, to) => Math.round((utcDay(to) - utcDay(from)) / 86_400_000)

// What the To-do page lists for one patient, as of `today` (YYYY-MM-DD):
// renewals and each discipline's follow-up due within `windowDays` (or
// overdue), and the first consultation while no medical note is signed.
// Nothing here is ticked off by hand: signing the note that renews or follows
// up is what clears an item.
export function dueTasks(notes, today, windowDays = 7) {
  const signed = signedNewestFirst(notes)
  const withinWindow = (due) => due && daysFrom(today, due) <= windowDays
  const renewals = currentPrescriptions(signed)
    .filter((prescription) => withinWindow(prescription.renewalDue))
    .map((prescription) => ({
      kind: "renewal",
      discipline: "medical",
      medication: prescription.medication,
      due: prescription.renewalDue,
      days: daysFrom(today, prescription.renewalDue),
    }))
  const followUps = nextFollowUps(signed)
    .filter((followUp) => withinWindow(followUp.date))
    .map((followUp) => ({
      kind: "followUp",
      discipline: followUp.discipline,
      due: followUp.date,
      days: daysFrom(today, followUp.date),
    }))
  const firstConsult = latestSignedByDiscipline(signed).medical
    ? []
    : [{ kind: "firstConsult", discipline: "medical", due: null, days: null }]
  return [...renewals, ...followUps, ...firstConsult]
}

// A Date from a Firestore Timestamp, a Date or an ISO string; null otherwise.
export function asDate(value) {
  if (!value) return null
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// BMI to one decimal, or null when height or weight is missing.
export function bmi(heightFeet, heightInches, weightLb) {
  const inches = Number(heightFeet || 0) * 12 + Number(heightInches || 0)
  const weight = Number(weightLb)
  if (!heightFeet || !(inches > 0) || !(weight > 0)) return null
  return Math.round(((703 * weight) / inches ** 2) * 10) / 10
}

// Whole years from a YYYY-MM-DD birth date, or null when there isn't one.
export function ageFrom(dateOfBirth, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth ?? "")
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  let age = now.getFullYear() - year
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1
  return age
}
