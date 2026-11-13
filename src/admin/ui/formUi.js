// Small shared form and date helpers for the admin (moved from the retired
// patients/noteUi.jsx and chartMath.js, 2026-11-13).

export const inputClass =
  "w-full rounded-lg border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-950/40 focus:border-ink-950/40"

export const labelClass = "mb-1 block text-xs font-medium text-ink-950/60"

// A Date from a Firestore Timestamp, a Date or an ISO string; null otherwise.
export function asDate(value) {
  if (!value) return null
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

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
