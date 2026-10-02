// Shared pieces for the note editor, note view and chart page, so a note
// reads the same wherever it's shown.
/* oxlint-disable react/only-export-components */
import { asDate } from "./chartMath"
import { ROLE_LABELS } from "./roles"

export const NOTE_TYPE_LABELS = { consultation: "Consultation", progress: "Progress note" }

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
