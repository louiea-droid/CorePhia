import { useState } from "react"
import { SUPPORT_PHONE } from "../../lib/siteContact"
import { startConversation } from "../lib/messageStore"

const field =
  "w-full rounded-xl border border-ink-950/15 bg-white px-3 py-2.5 text-ink-950 outline-none transition-colors duration-200 focus:border-ink-950/45"

export function UrgentLine() {
  return (
    <p className="text-sm text-ink-950/65">
      For anything urgent, call us at {SUPPORT_PHONE}. In an emergency, call 911.
    </p>
  )
}

export default function NewConversationForm({ intakeId, uid, onStarted, onCancel }) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    if (!subject.trim()) return setError("Add a subject.")
    if (!body.trim()) return setError("Write a message first.")
    if (body.trim().length > 2000) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      onStarted(await startConversation(intakeId, uid, { subject: subject.trim(), body: body.trim() }))
    } catch {
      setError("Couldn't send your message. Try again.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-paper-100 p-5">
      <UrgentLine />
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-950/75">Subject</span>
        <input value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-950/75">Message</span>
        <textarea value={body} rows={5} onChange={(event) => setBody(event.target.value)} className={`${field} resize-y leading-relaxed`} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-brand-dark">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-ink-900 disabled:opacity-60">
          {busy ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={onCancel} className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold text-ink-950/70 transition-colors duration-200 hover:bg-paper-200">
          Cancel
        </button>
      </div>
    </form>
  )
}
