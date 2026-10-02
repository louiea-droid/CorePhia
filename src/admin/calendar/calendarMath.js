// Calendar arithmetic, all in Tampa time whatever the viewer's computer is
// set to. Pure (no React, no Firebase) so calendarMath.check.js runs it
// under plain node. Calendar days are "YYYY-MM-DD" strings throughout.
import { asDate, daysFrom } from "../patients/chartMath.js"

export const TIME_ZONE = "America/New_York"

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

const partsOf = (date) => Object.fromEntries(PARTS.formatToParts(date).map(({ type, value }) => [type, value]))

// Tampa's offset from UTC, in minutes, at a given instant (-240 EDT, -300 EST).
function offsetMinutes(ms) {
  const p = partsOf(new Date(ms))
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000
}

export function tampaParts(value) {
  const p = partsOf(asDate(value))
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, minutes: +p.hour * 60 + +p.minute }
}

// A Tampa wall-clock time as an instant. Two passes, so a time just after a
// DST change uses the offset in force at that time, not the one before it.
export function fromTampa(day, time = "00:00") {
  const [year, month, date] = day.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const wall = Date.UTC(year, month - 1, date, hour, minute)
  const first = wall - offsetMinutes(wall) * 60000
  return new Date(wall - offsetMinutes(first) * 60000)
}

export function addDays(day, count) {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, date + count)).toISOString().slice(0, 10)
}

export const todayInTampa = (now = new Date()) => tampaParts(now).day

// 0 = Monday … 6 = Sunday.
const weekday = (day) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7

export function weekDays(day) {
  const monday = addDays(day, -weekday(day))
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function weekRange(day) {
  const days = weekDays(day)
  return { days, start: fromTampa(days[0]), end: fromTampa(addDays(days[0], 7)) }
}

export function monthGrid(day) {
  const first = `${day.slice(0, 7)}-01`
  const gridStart = addDays(first, -weekday(first))
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

// Every day of the month that `day` falls in, first to last.
export function monthDays(day) {
  const first = `${day.slice(0, 7)}-01`
  const days = []
  for (let current = first; current.slice(0, 7) === first.slice(0, 7); current = addDays(current, 1)) days.push(current)
  return days
}

export function monthRange(day) {
  const days = monthGrid(day)
  return { days, start: fromTampa(days[0]), end: fromTampa(addDays(days[41], 1)) }
}

// The booking dialog offers 6:00 AM to 9:00 PM in 15-minute steps; a click
// anywhere in the 24-hour week grid lands on the nearest of those.
export const FIRST_SLOT = 6 * 60
export const LAST_SLOT = 21 * 60
const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
export const slotTime = (minutes) => hhmm(Math.min(LAST_SLOT, Math.max(FIRST_SLOT, Math.floor(minutes / 15) * 15)))

const minutesOf = (time) => {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export const periodOf = (time) => (minutesOf(time) < 12 * 60 ? "AM" : "PM")

// The bookable times in one half of the day, labelled without AM/PM (the
// switch beside the list says which half): AM 6:00 to 11:45, PM 12:00 to 9:00.
export function timesIn(period) {
  const [from, to] = period === "AM" ? [FIRST_SLOT, 12 * 60 - 15] : [12 * 60, LAST_SLOT]
  const times = []
  for (let minutes = from; minutes <= to; minutes += 15) {
    const hour = Math.floor(minutes / 60) % 12 || 12
    times.push({ value: hhmm(minutes), label: `${hour}:${String(minutes % 60).padStart(2, "0")}` })
  }
  return times
}

const startMs = (appointment) => asDate(appointment.start)?.getTime() ?? 0
const endMs = (appointment) => startMs(appointment) + appointment.minutes * 60000

// Scheduled appointments of the same staff member that overlap this one.
export const overlaps = (appointment, others) =>
  others.filter(
    (other) =>
      other.id !== appointment.id &&
      other.status === "scheduled" &&
      other.staffUid === appointment.staffUid &&
      startMs(other) < endMs(appointment) &&
      startMs(appointment) < endMs(other),
  )

// A follow-up counts as booked when the same patient has a scheduled or
// completed appointment of the same discipline within 3 days of its date.
const MATCH_DAYS = 3

export const matchingAppointment = (followUp, appointments) =>
  appointments.find(
    (appointment) =>
      appointment.intakeId === followUp.intakeId &&
      appointment.discipline === followUp.discipline &&
      (appointment.status === "scheduled" || appointment.status === "completed") &&
      Math.abs(daysFrom(followUp.date, tampaParts(appointment.start).day)) <= MATCH_DAYS,
  ) ?? null

export const unbookedFollowUps = (followUps, appointments) =>
  followUps.filter((followUp) => !matchingAppointment(followUp, appointments))

// Side-by-side columns for overlapping blocks in one day of the week view.
// Each cluster of mutually overlapping blocks shares a lane count.
export function lanes(items) {
  const placed = new Map()
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  let cluster = []
  let clusterEnd = -1
  const close = () => {
    const count = Math.max(0, ...cluster.map((id) => placed.get(id).lane)) + 1
    for (const id of cluster) placed.get(id).lanes = count
    cluster = []
  }
  for (const item of sorted) {
    if (cluster.length && item.startMin >= clusterEnd) close()
    const busy = new Set(
      cluster.filter((id) => sorted.find((other) => other.id === id).endMin > item.startMin).map((id) => placed.get(id).lane),
    )
    let lane = 0
    while (busy.has(lane)) lane += 1
    placed.set(item.id, { lane, lanes: 1 })
    cluster.push(item.id)
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  if (cluster.length) close()
  return placed
}

const sameValue = (a, b) => {
  const dateA = a instanceof Date || typeof a?.toDate === "function" ? asDate(a)?.getTime() : null
  const dateB = b instanceof Date || typeof b?.toDate === "function" ? asDate(b)?.getTime() : null
  return dateA != null || dateB != null ? dateA === dateB : a === b
}

// The history entry for an edit: which fields changed, from what, to what.
// null when nothing actually changed (so no empty entries get written).
export function changeFor(appointment, patch, reason = "") {
  const keys = Object.keys(patch).filter((key) => !sameValue(appointment[key], patch[key]))
  if (!keys.length) return null
  const kind = ["cancelled", "completed", "noShow"].includes(patch.status)
    ? patch.status
    : keys.every((key) => key === "note")
      ? "noteEdited"
      : "moved"
  const pick = (source) => Object.fromEntries(keys.map((key) => [key, source[key]]))
  return { kind, from: pick(appointment), to: pick(patch), reason }
}
