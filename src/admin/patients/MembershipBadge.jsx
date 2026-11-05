import { membershipLabel } from "./chartMath"

const TONE = {
  good: "bg-accent-dark/15 text-accent-text",
  // Solid amber like "Needs a reply" in Messages: the admin's dark mode is the
  // .dark variable scope, which Tailwind's dark: variant doesn't follow.
  warn: "bg-amber-100 text-amber-900",
  muted: "bg-ink-950/10 text-ink-950/60",
}

// compact: for tables under a "Membership" column header, which already says
// what the badge is, so "Member: Core Complete" becomes "Core Complete" and
// the end date uses a short month. Keeps the badge inside a narrow column.
export default function MembershipBadge({ chart, compact = false }) {
  const label = membershipLabel(chart)
  const text = compact ? label.text.replace(/^Member: /, "") : label.text
  const note = compact ? label.note?.replace(/^Ends (\w{3})\w* /, "Ends $1 ") : label.note
  const { tone } = label
  const badge = <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone]}`}>{text}</span>
  if (!note) return badge
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {badge}
      <span className="pl-2.5 text-xs text-ink-950/55">{note}</span>
    </span>
  )
}
