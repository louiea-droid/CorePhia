import { membershipLabel } from "./chartMath"

const TONE = {
  good: "bg-accent-dark/15 text-accent-text",
  warn: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  muted: "bg-ink-950/10 text-ink-950/60",
}

export default function MembershipBadge({ chart }) {
  const { text, tone } = membershipLabel(chart)
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone]}`}>{text}</span>
}
