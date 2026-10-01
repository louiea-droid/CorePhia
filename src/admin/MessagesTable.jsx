import { isNewMessage } from "./recentMessages"
import { formatClockTime, formatRelativeTime, useRelativeTimeClock } from "./relativeTime"

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// Mirrors ApplicantsTable.jsx: same fixed-width columns, same whole-row click
// target, same filler-row padding trick for a short last page, same
// relative-time-for-the-newest-10 treatment on the Time column.
export default function MessagesTable({ messages, onSelect, minRows = 0, rankOffset = 0, viewedAt = 0 }) {
  const fillerRowCount = Math.max(0, minRows - messages.length)
  const anyRecentOnPage = messages.some((_, index) => rankOffset + index < 10)
  const now = useRelativeTimeClock(anyRecentOnPage)

  return (
    <div className="scrollbar-thin -mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-2xl table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[24%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[28%]" />
        </colgroup>
        <thead>
          <tr className="sticky top-0 z-10 border-b border-ink-950/10 bg-white text-xs tracking-wide text-ink-950/45 uppercase">
            <th scope="col" className="pb-2 font-medium">
              From
            </th>
            <th scope="col" className="pb-2 font-medium">
              Contact
            </th>
            <th scope="col" className="pb-2 font-medium">
              Submitted
            </th>
            <th scope="col" className="pb-2 font-medium">
              Time
            </th>
            <th scope="col" className="pb-2 font-medium">
              Topic
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-950/5">
          {messages.map((message, index) => {
            const isRecent = rankOffset + index < 10
            // Same window and viewed-at cutoff the sidebar badge counts, so
            // the number there and the highlighted rows here can never
            // disagree. `viewedAt` is frozen to the value as of when this
            // page was opened (see Messages.jsx), so a message doesn't
            // un-highlight itself mid-visit.
            const isNew = isNewMessage(message, now, viewedAt)
            return (
              <tr
                key={message.id}
                onClick={() => onSelect(message)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelect(message)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View ${isNew ? "new " : ""}message from ${message.name || "this visitor"}`}
                className={`cursor-pointer outline-none transition-colors duration-150 hover:bg-paper-50 focus-visible:bg-paper-100 ${
                  isNew ? "bg-accent-dark/5" : ""
                }`}
              >
                <td className="py-4 font-medium text-ink-950">
                  {/* Tint alone would carry the whole meaning by colour, so a
                      new row is also marked by a dot. */}
                  <span className="flex items-center gap-2">
                    {isNew && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent-dark" />}
                    <span className="truncate">{message.name || "—"}</span>
                  </span>
                </td>
                <td className="truncate py-4 text-ink-950/60">{message.email || message.phone || "—"}</td>
                <td className="truncate py-4 whitespace-nowrap text-ink-950/60">
                  {formatDate(message.submittedAt)}
                </td>
                <td className="truncate py-4 tabular-nums whitespace-nowrap text-ink-950/60">
                  {isRecent ? formatRelativeTime(message.submittedAt, now) : formatClockTime(message.submittedAt)}
                </td>
                <td className="truncate py-4 text-ink-950/60">{message.interest || "—"}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
