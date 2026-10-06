import { Link } from "react-router-dom"
import { unreadFor } from "../../lib/messageMath"

const when = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
}
import { useCanWrite, useMyTopics } from "./useMyTopics"
import { Loading, Skeleton } from "../Skeleton"

// The portal home's Messages box: the 3 latest conversations.
export default function MessagesBox({ intakeId }) {
  const { topics, failed, retry } = useMyTopics(intakeId)
  const canWrite = useCanWrite(intakeId)
  const latest = topics?.slice(0, 3) ?? []
  return (
    <section id="messages" aria-labelledby="messages-box-heading" className="scroll-mt-24 rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="messages-box-heading" className="font-serif text-2xl text-ink-950">
          Messages
        </h2>
        <div className="flex gap-2">
          {canWrite && (
            <Link to="/account/messages?new=1" className="rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors hover:bg-ink-900">
              New message
            </Link>
          )}
          <Link to="/account/messages" className="rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-paper-100">
            All messages
          </Link>
        </div>
      </div>
      {failed ? (
        <div className="mt-6">
          <p className="text-ink-950/75">We couldn't load your messages.</p>
          <button type="button" onClick={retry} className="mt-4 cursor-pointer rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-paper-100">
            Try again
          </button>
        </div>
      ) : !topics ? (
        <Loading label="Loading your messages…" className="mt-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 border-b border-ink-950/10 py-3.5 last:border-0">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3.5 w-12" />
            </div>
          ))}
        </Loading>
      ) : latest.length === 0 ? (
        <p className="mt-6 text-ink-950/70">Questions about your care? Send your care team a message.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-950/10">
          {latest.map((topic) => (
            <li key={topic.id}>
              <Link to={`/account/messages/${topic.id}`} className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-accent-dark">
                <span className="min-w-0 truncate text-ink-950">{topic.subject}</span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-ink-950/60">
                  {unreadFor(topic, "patient") && <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-ink-950">New reply</span>}
                  {when(topic.lastMessageAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
