import { useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { unreadFor } from "../../lib/messageMath"
import ConversationView from "./ConversationView"
import NewConversationForm from "./NewConversationForm"
import { useCanWrite, useMyTopics } from "./useMyTopics"

const when = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
}

export default function MessagesPage({ user, link }) {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const { topics, failed, retry } = useMyTopics(link.intakeId)
  const canWrite = useCanWrite(link.intakeId)
  const [tab, setTab] = useState("open")
  const [params] = useSearchParams()
  const [composing, setComposing] = useState(params.get("new") === "1")
  const topic = topicId ? topics?.find((entry) => entry.id === topicId) : null

  if (topicId) {
    if (!topics) return <p className="text-ink-950/60">{failed ? "We couldn't load your messages." : "Loading…"}</p>
    if (!topic) return <p className="text-ink-950/70">That conversation couldn't be found. <Link to="/account/messages" className="underline">All messages</Link></p>
    return <ConversationView intakeId={link.intakeId} uid={user.uid} topic={topic} canWrite={canWrite} />
  }

  const listed = (topics ?? []).filter((entry) => entry.status === tab)
  return (
    <section aria-labelledby="messages-heading" className="rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <Link to="/account" className="text-sm font-medium text-ink-950/60 transition-colors hover:text-ink-950">
        Back to your portal
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 id="messages-heading" className="font-serif text-3xl text-ink-950">
          Messages
        </h1>
        {canWrite && !composing && (
          <button type="button" onClick={() => setComposing(true)} className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors hover:bg-ink-900">
            New message
          </button>
        )}
      </div>
      {composing && (
        <div className="mt-6">
          <NewConversationForm intakeId={link.intakeId} uid={user.uid} onCancel={() => setComposing(false)} onStarted={(id) => navigate(`/account/messages/${id}`)} />
        </div>
      )}
      <div role="tablist" aria-label="Conversations" className="mt-6 flex gap-2">
        {[
          ["open", "Open"],
          ["closed", "Closed"],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            type="button"
            onClick={() => setTab(value)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === value ? "bg-ink-950 text-paper-50" : "bg-paper-100 text-ink-950/70 hover:bg-paper-200"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {failed ? (
        <div className="mt-6">
          <p className="text-ink-950/75">We couldn't load your messages.</p>
          <button type="button" onClick={retry} className="mt-4 cursor-pointer rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-paper-100">
            Try again
          </button>
        </div>
      ) : !topics ? (
        <p className="mt-6 text-sm text-ink-950/60">Loading…</p>
      ) : listed.length === 0 ? (
        <p className="mt-6 text-ink-950/70">{tab === "open" ? "No open conversations." : "No closed conversations."}</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-950/10">
          {listed.map((entry) => (
            <li key={entry.id}>
              <Link to={`/account/messages/${entry.id}`} className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-accent-dark">
                <span className="min-w-0 truncate font-medium text-ink-950">{entry.subject}</span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-ink-950/60">
                  {unreadFor(entry, "patient") && <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-ink-950">New reply</span>}
                  {when(entry.lastMessageAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
