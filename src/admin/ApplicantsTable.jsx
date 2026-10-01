import { goalBucket } from "./analytics"
import { formatClockTime, formatRelativeTime, useRelativeTimeClock } from "./relativeTime"

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const STATUS_BADGE = {
  admitted: "bg-accent-dark/10 text-accent-text",
  pending: "bg-ink-950/10 text-ink-950/60",
  declined: "bg-red-600/10 text-red-600",
}

// Mirrors ApplicantsTable's own row order: the 10 most recent submissions overall
// (not just on the visible page) read as "how long ago", so a chart that just
// came in visibly reads as new. rankOffset is how many rows are ahead of this
// page in the full sorted list — 0 on page 1, pageSize on page 2, and so on —
// so the cutoff is correct regardless of which page is showing.
export default function ApplicantsTable({ records, onSelect, minRows = 0, rankOffset = 0 }) {
  const fillerRowCount = Math.max(0, minRows - records.length)
  const anyRecentOnPage = records.some((_, index) => rankOffset + index < 10)
  const now = useRelativeTimeClock(anyRecentOnPage)

  return (
    <div className="scrollbar-thin -mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-2xl table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[24%]" />
        </colgroup>
        <thead>
          <tr className="sticky top-0 z-10 border-b border-ink-950/10 bg-white text-xs tracking-wide text-ink-950/45 uppercase">
            <th scope="col" className="pb-2 font-medium">
              Applicant
            </th>
            <th scope="col" className="pb-2 font-medium">
              Submitted
            </th>
            <th scope="col" className="pb-2 font-medium">
              Time
            </th>
            <th scope="col" className="pb-2 font-medium">
              Status
            </th>
            <th scope="col" className="pb-2 font-medium">
              Goal
            </th>
            <th scope="col" className="pb-2 font-medium">
              Reason
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-950/5">
          {records.map((record, index) => {
            const name = `${record.demographics?.firstName ?? ""} ${record.demographics?.lastName ?? ""}`.trim()
            const isRecent = rankOffset + index < 10
            return (
              <tr
                key={record.id}
                onClick={() => onSelect(record)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelect(record)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View intake details for ${name || "this applicant"}`}
                className="cursor-pointer outline-none transition-colors duration-150 hover:bg-paper-50 focus-visible:bg-paper-100"
              >
                <td className="truncate py-4 font-medium text-ink-950">{name || "—"}</td>
                <td className="truncate py-4 whitespace-nowrap text-ink-950/60">
                  {formatDate(record.submittedAt)}
                </td>
                <td className="truncate py-4 tabular-nums whitespace-nowrap text-ink-950/60">
                  {isRecent ? formatRelativeTime(record.submittedAt, now) : formatClockTime(record.submittedAt)}
                </td>
                <td className="py-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[record.status ?? "pending"]}`}
                  >
                    {record.status ?? "pending"}
                  </span>
                </td>
                <td className="truncate py-4 text-ink-950/60">{goalBucket(record).replace("Not sure, I just need to lose weight", "Not sure") || "—"}</td>
                <td className="truncate py-4 text-ink-950/60">{record.visit?.reason || "—"}</td>
              </tr>
            )
          })}
          {Array.from({ length: fillerRowCount }).map((_, index) => (
            <tr key={`filler-${index}`} aria-hidden="true">
              <td className="py-4">&nbsp;</td>
              <td className="py-4" />
              <td className="py-4" />
              <td className="py-4" />
              <td className="py-4" />
              <td className="py-4" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
