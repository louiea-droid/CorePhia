import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { messageEmailConfigured } from "../../lib/emailjs"
import { unreadFor } from "../../lib/messageMath"
import { usingSeedData } from "../lib/firebase"
import { loadIntakeRecord } from "../patients/chartStore"
import { formatStamp, inputClass } from "../patients/noteUi"
import { ROLE_LABELS } from "../staff/roles"
import ConfirmDialog from "../ui/ConfirmDialog"
import { ChevronLeftIcon } from "../ui/icons"
import { closeTopic, listenMessages, markTopicRead, replyToTopic } from "./topicStore"

const MAX = 2000
const EMAIL_WORDS = { sent: "Email sent", failed: "Email not sent", none: "Not emailed" }

// One topic: messages oldest first, the reply box, Close. Opening it (and
// each new patient message while it's open) marks it read for staff.
export default function TopicView({ topic, chart, actor, onBack }) {
  const [messages, setMessages] = useState(null)
  const [failed, setFailed] = useState(false)
  const [to, setTo] = useState("")
  const [body, setBody] = useState("")
  const [email, setEmail] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [closing, setClosing] = useState(false)
  const [hint, setHint] = useState(null)
  const replyRef = useRef(null)
  const canEmail = (messageEmailConfigured || usingSeedData) && Boolean(to)
  // Unknown (patients still loading, or the load failed) counts as open: the
  // rules refuse a send on a chart that really is inactive.
  const active = chart ? chart.status === "active" : true

  useEffect(
    () =>
      listenMessages(topic.chartId, topic.id, setMessages, (cause) => {
        console.error("Could not load the topic:", cause.code ?? cause.message)
        setFailed(true)
      }),
    [topic.chartId, topic.id],
  )

  useEffect(() => {
    let live = true
    loadIntakeRecord(topic.chartId)
      .then((intake) => live && setTo((intake?.demographics?.email ?? "").trim().toLowerCase()))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [topic.chartId])

  const unread = unreadFor(topic, "staff")
  useEffect(() => {
    if (unread) markTopicRead(topic.chartId, topic.id).catch((cause) => console.error("Could not mark read:", cause.code ?? cause.message))
  }, [unread, topic.chartId, topic.id])

  const send = async (event) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return setError("Write a message first.")
    if (text.length > MAX) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      await replyToTopic({ chartId: topic.chartId, topicId: topic.id, body: text, to, email: email && canEmail }, actor)
      setBody("")
      setHint(null)
    } catch (cause) {
      setError(cause?.code === "permission-denied" ? "This chart can't be messaged." : "Couldn't send. Try again.")
    }
    setBusy(false)
  }

  const name = chart ? `${chart.firstName} ${chart.lastName}`.trim() : "Patient"

  return (
    <section aria-label={topic.subject} className="flex min-h-0 flex-col rounded-2xl border border-ink-950/10 bg-white">
      <header className="border-b border-ink-950/10 p-4 sm:p-5">
        <button type="button" onClick={onBack} className="mb-2 inline-flex cursor-pointer items-center gap-1 text-sm text-ink-950/60 transition-colors hover:text-ink-950 lg:hidden">
          <ChevronLeftIcon className="size-4" />
          Messages
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold wrap-break-word text-ink-950">{topic.subject}</h2>
            <p className="mt-0.5 text-sm text-ink-950/60">
              <Link to={`/admin/patients/${topic.chartId}`} className="font-medium text-accent-text hover:underline">
                {name}
              </Link>
              {" · "}
              {topic.status === "closed" ? `Closed by ${topic.closed?.by === "patient" ? "the patient" : topic.closed?.name} on ${formatStamp(topic.closed?.at)}` : "Open"}
            </p>
          </div>
          {active &&
            (topic.status === "open" ? (
              <button type="button" onClick={() => setClosing(true)} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-950/70 ring-1 ring-ink-950/15 transition-colors hover:bg-ink-950/5">
                Close topic
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setHint("Write a reply to reopen.")
                  replyRef.current?.focus()
                }}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-950/70 ring-1 ring-ink-950/15 transition-colors hover:bg-ink-950/5"
              >
                Reopen
              </button>
            ))}
        </div>
      </header>

      <ol className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {failed ? (
          <li className="text-sm text-brand-dark">Couldn't load this topic.</li>
        ) : !messages ? (
          <li className="text-sm text-ink-950/50">Loading…</li>
        ) : (
          messages.map((message) => {
            const staff = message.from?.kind === "staff"
            return (
              <li key={message.id} className={`flex ${staff ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${staff ? "bg-accent-dark/10" : "bg-paper-100"}`}>
                  <p className="text-xs text-ink-950/55">
                    {staff ? `${message.from.name} (${ROLE_LABELS[message.from.role] ?? message.from.role})` : name}, {formatStamp(message.createdAt)}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-line wrap-anywhere text-ink-950">{message.body}</p>
                  {staff && <p className="mt-1 text-xs text-ink-950/45">{EMAIL_WORDS[message.email] ?? EMAIL_WORDS.none}</p>}
                </div>
              </li>
            )
          })
        )}
      </ol>

      {active ? (
        <form onSubmit={send} className="border-t border-ink-950/10 p-4 sm:p-5">
          <label className="sr-only" htmlFor="topic-reply">
            Reply
          </label>
          <textarea
            id="topic-reply"
            ref={replyRef}
            value={body}
            rows={3}
            placeholder={hint ?? "Write a reply"}
            onChange={(event) => setBody(event.target.value)}
            className={`${inputClass} resize-y leading-relaxed`}
          />
          {body.length > MAX - 200 && (
            <p className={`mt-1 text-right text-xs ${body.length > MAX ? "text-brand-dark" : "text-ink-950/55"}`}>
              {body.length} / {MAX}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className={`flex items-start gap-2 text-sm ${canEmail ? "cursor-pointer text-ink-950/80" : "text-ink-950/50"}`}>
              <input type="checkbox" checked={email && canEmail} disabled={!canEmail} onChange={(event) => setEmail(event.target.checked)} className="mt-0.5 size-4 accent-accent-dark" />
              <span>
                Email the patient that there's a new message
                {!(messageEmailConfigured || usingSeedData) && <span className="block text-xs">Email sending isn't set up yet.</span>}
                {(messageEmailConfigured || usingSeedData) && !to && <span className="block text-xs">There's no email on this intake.</span>}
              </span>
            </label>
            <div className="flex items-center gap-3">
              {error && (
                <p role="alert" className="text-sm text-brand-dark">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50">
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="border-t border-ink-950/10 p-4 text-sm text-ink-950/60 sm:p-5">This chart is inactive, so messaging is closed.</p>
      )}

      <ConfirmDialog
        open={closing}
        title="Close this topic?"
        description="It moves to Closed. A new message from either side reopens it."
        confirmLabel="Close topic"
        onConfirm={async () => {
          setClosing(false)
          await closeTopic(topic.chartId, topic.id, actor).catch(() => setError("Couldn't close the topic. Try again."))
        }}
        onCancel={() => setClosing(false)}
      />
    </section>
  )
}
