import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { patientRoleLabel, unreadFor } from "../../lib/messageMath"
import { SUPPORT_PHONE } from "../../lib/siteContact"
import { closeConversation, listenMyMessages, markConversationRead, replyInConversation } from "../lib/messageStore"
import { UrgentLine } from "./NewConversationForm"
import { Skeleton } from "../Skeleton"

const stamp = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""
}
const day = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""
}

export default function ConversationView({ intakeId, uid, topic, canWrite }) {
  const [messages, setMessages] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const dialogRef = useRef(null)

  useEffect(
    () =>
      listenMyMessages(
        intakeId,
        topic.id,
        (next) => {
          setMessages(next)
          setFailed(false)
        },
        () => setFailed(true),
      ),
    [intakeId, topic.id, attempt],
  )
  const unread = unreadFor(topic, "patient")
  useEffect(() => {
    if (unread) markConversationRead(intakeId, topic.id).catch(() => {})
  }, [unread, intakeId, topic.id])

  const send = async (event) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return setError("Write a message first.")
    if (text.length > 2000) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      await replyInConversation(intakeId, uid, topic, text)
      setBody("")
    } catch {
      setError("Couldn't send your message. Try again.")
    }
    setBusy(false)
  }

  return (
    <section aria-labelledby="conversation-heading" className="rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <Link to="/account/messages" className="text-sm font-medium text-ink-950/60 transition-colors hover:text-ink-950">
        All messages
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 id="conversation-heading" className="min-w-0 font-serif text-2xl wrap-anywhere text-ink-950">
          {topic.subject}
        </h1>
        {canWrite && topic.status === "open" && (
          <button type="button" onClick={() => dialogRef.current?.showModal()} className="cursor-pointer rounded-full border border-ink-950/15 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-paper-100">
            Close conversation
          </button>
        )}
      </div>
      {topic.status === "closed" && (
        <p className="mt-2 text-sm text-ink-950/60">
          Closed by {topic.closed?.by === "patient" ? "you" : "your care team"} on {day(topic.closed?.at)}. Write below to reopen it.
        </p>
      )}

      <ol className="mt-6 space-y-3">
        {failed ? (
          <li>
            <p className="text-ink-950/70">We couldn't load your messages.</p>
            <button
              type="button"
              onClick={() => {
                setFailed(false)
                setAttempt((n) => n + 1)
              }}
              className="mt-3 cursor-pointer rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-paper-100"
            >
              Try again
            </button>
          </li>
        ) : !messages ? (
          <li role="status">
            <span className="sr-only">Loading your messages…</span>
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <Skeleton className="mt-3 ml-auto h-12 w-2/3 rounded-2xl" />
          </li>
        ) : (
          messages.map((message) => {
            const mine = message.from?.kind === "patient"
            return (
              <li key={message.id} className={`animate-fade-in flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "bg-accent/15" : "bg-paper-100"}`}>
                  <p className="text-xs text-ink-950/55">
                    {mine ? "You" : `${message.from.name} (${patientRoleLabel(message.from.role)})`}, {stamp(message.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-line wrap-anywhere text-ink-950">{message.body}</p>
                </div>
              </li>
            )
          })
        )}
      </ol>

      {canWrite ? (
        <form onSubmit={send} className="mt-6 space-y-3">
          <UrgentLine />
          <label className="sr-only" htmlFor="conversation-reply">
            Reply
          </label>
          <textarea
            id="conversation-reply"
            value={body}
            rows={4}
            placeholder="Write a reply"
            onChange={(event) => setBody(event.target.value)}
            className="w-full resize-y rounded-xl border border-ink-950/15 bg-white px-3 py-2.5 leading-relaxed text-ink-950 outline-none focus:border-ink-950/45"
          />
          {error && (
            <p role="alert" className="text-sm text-brand-dark">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors hover:bg-ink-900 disabled:opacity-60">
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
      ) : canWrite === false ? (
        <p className="mt-6 rounded-2xl bg-paper-100 p-4 text-sm text-ink-950/70">
          Messaging is closed. Call us at {SUPPORT_PHONE} or email info@corephia.com.
        </p>
      ) : null}

      <dialog ref={dialogRef} aria-labelledby="close-conversation-title" className="animate-sheet-in m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white p-6 shadow-2xl backdrop:bg-ink-950/50">
        <p id="close-conversation-title" className="font-serif text-xl text-ink-950">
          Close this conversation?
        </p>
        <p className="mt-2 text-sm text-ink-950/70">You can still read it, and writing again reopens it.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-ink-950/70 hover:bg-paper-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              dialogRef.current?.close()
              await closeConversation(intakeId, topic.id).catch(() => setError("Couldn't close the conversation. Try again."))
            }}
            className="cursor-pointer rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 hover:bg-ink-900"
          >
            Close conversation
          </button>
        </div>
      </dialog>
    </section>
  )
}
