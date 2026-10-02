// Shared pieces for the note editor, note view and chart page, so a note
// reads the same wherever it's shown.
/* oxlint-disable react/only-export-components */
import { asDate } from "./chartMath"
import { ROLE_LABELS } from "../staff/roles"

// Every note type, in the order "New note" offers them. Dietitian and
// exercise notes have no prescriptions (medication stays in the medical
// record, written by providers) and record weight only.
export const NOTE_TYPES = {
  consultation: { label: "Consultation", newLabel: "New consultation", discipline: "medical", fullVitals: true, prescriptions: true },
  progress: { label: "Progress note", newLabel: "New progress note", discipline: "medical", fullVitals: true, prescriptions: true },
  exercise: { label: "Exercise note", newLabel: "New exercise note", discipline: "exercise", fullVitals: false, prescriptions: false },
  dietitian: { label: "Dietitian note", newLabel: "New dietitian note", discipline: "dietitian", fullVitals: false, prescriptions: false },
}

export const NOTE_TYPE_LABELS = Object.fromEntries(Object.entries(NOTE_TYPES).map(([type, { label }]) => [type, label]))

export const DISCIPLINE_LABELS = { medical: "Medical", dietitian: "Dietitian", exercise: "Exercise" }

// Which sections each note type has, in order. Labels are the clinical terms
// Dr. Antonious used (HPI, plan), spelled out where a new provider may not
// know the shorthand.
export const SECTION_FIELDS = {
  consultation: [
    ["chiefConcern", "Reason for visit"],
    ["hpi", "History of present illness (HPI)"],
    ["pertinentHistory", "Pertinent history"],
    ["assessment", "Assessment"],
    ["plan", "Plan"],
  ],
  progress: [
    ["intervalHistory", "Interval history (since last visit)"],
    ["assessment", "Assessment"],
    ["plan", "Plan"],
  ],
  dietitian: [
    ["dietHistory", "Diet history and current eating pattern"],
    ["assessment", "Assessment"],
    ["goals", "Goals"],
    ["mealPlan", "Meal plan and recommendations"],
  ],
  exercise: [
    ["activityLevel", "Current activity level"],
    ["limitations", "Limitations and injuries"],
    ["goals", "Goals"],
  ],
}

export const INTENSITIES = [
  ["light", "Light"],
  ["moderate", "Moderate"],
  ["vigorous", "Vigorous"],
]

// "4 days a week, moderate, 30 min per session, Walking", or "" when empty.
export function exercisePlanLine(plan) {
  if (!plan) return ""
  return [
    plan.daysPerWeek != null && `${plan.daysPerWeek} ${plan.daysPerWeek === 1 ? "day" : "days"} a week`,
    INTENSITIES.find(([value]) => value === plan.intensity)?.[1].toLowerCase(),
    plan.minutesPerSession != null && `${plan.minutesPerSession} min per session`,
    plan.kind?.trim(),
  ]
    .filter(Boolean)
    .join(", ")
}

export const inputClass =
  "w-full rounded-lg border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-950/40 focus:border-ink-950/40"

export const labelClass = "mb-1 block text-xs font-medium text-ink-950/60"

export const formatDay = (value) => {
  if (!value) return ""
  // YYYY-MM-DD is a calendar day: build it in local time, not UTC.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : asDate(value)
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""
}

export const formatStamp = (value) =>
  asDate(value)?.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) ?? ""

export const signerLine = (signedBy, signedAt) =>
  signedBy ? `Signed by ${signedBy.name} (${ROLE_LABELS[signedBy.role] ?? signedBy.role}), ${formatStamp(signedAt)}` : ""

export function vitalsLine(vitals) {
  if (!vitals) return ""
  const parts = []
  if (vitals.weightLb) parts.push(`${vitals.weightLb} lbs`)
  if (vitals.systolic && vitals.diastolic) parts.push(`BP ${vitals.systolic}/${vitals.diastolic}`)
  if (vitals.heartRate) parts.push(`HR ${vitals.heartRate}`)
  return parts.join(", ")
}

export function prescriptionLine(entry) {
  if (entry.action === "stop") return `Stop ${entry.medication || "prescription"}${entry.stopReason ? `: ${entry.stopReason}` : ""}`
  const verb = entry.action === "renew" ? "Renew" : "Start"
  const details = [entry.instructions, entry.renewalDue && `renewal due ${formatDay(entry.renewalDue)}`]
    .filter(Boolean)
    .join(", ")
  return `${verb} ${entry.medication || "prescription"}${details ? `, ${details}` : ""}`
}

export const STATUS_PILL = {
  draft: "bg-amber-100 text-amber-900",
  signed: "bg-accent-dark/10 text-accent-text",
}
