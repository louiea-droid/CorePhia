import { useState } from "react"
import { portalEmailConfigured } from "../../lib/emailjs"
import { usingSeedData } from "../lib/firebase"
import Modal from "../ui/Modal"
import { inputClass, labelClass } from "./noteUi"
import { postUpdate } from "./updateStore"

const MAX = 2000

// Post a portal update (spec: 2026-10-05-portal-updates-design). Opened empty
// from the Updates card, or pre-filled from a note just signed. No maxLength
// on the message: a long prefill must stay visible and editable, not be cut.
export default function PostUpdateDialog({ chartId, to, initialBody = "", fromNoteId = null, actor, onClose, onPosted }) {
  const emailReady = portalEmailConfigured || usingSeedData
  const canEmail = emailReady && Boolean(to)
  const [body, setBody] = useState(initialBody)
  const [email, setEmail] = useState(canEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return setError("Write a message first.")
    if (text.length > MAX) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      const { emailed } = await postUpdate({ chartId, to, body: text, fromNoteId, email: email && canEmail }, actor)
      onPosted({ emailed })
    } catch (cause) {
      setError(cause?.code === "permission-denied" ? "Your role can't post updates on this chart." : "Couldn't post the update. Try again.")
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Post an update"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-sm text-brand-dark">
              {error}
            </p>
          )}
          <button
            type="submit"
            form="post-update"
            disabled={busy}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post update"}
          </button>
        </>
      }
    >
      <form id="post-update" onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={labelClass}>Message</span>
          <textarea
            value={body}
            rows={7}
            onChange={(event) => setBody(event.target.value)}
            className={`${inputClass} resize-y leading-relaxed`}
          />
          {body.length > MAX - 200 && (
            <span className={`mt-1 block text-right text-xs ${body.length > MAX ? "text-brand-dark" : "text-ink-950/55"}`}>
              {body.length} / {MAX}
            </span>
          )}
        </label>
        <label className={`flex items-start gap-2 text-sm ${canEmail ? "cursor-pointer text-ink-950/80" : "text-ink-950/50"}`}>
          <input
            type="checkbox"
            checked={email && canEmail}
            disabled={!canEmail}
            onChange={(event) => setEmail(event.target.checked)}
            className="mt-0.5 size-4 accent-accent-dark"
          />
          <span>
            Email the patient that there's a new update
            {!emailReady && <span className="block text-xs">Email sending isn't set up yet.</span>}
            {emailReady && !to && <span className="block text-xs">There's no email on this intake.</span>}
          </span>
        </label>
        <p className="text-xs text-ink-950/55">The patient sees your name and role. The email doesn't include the message.</p>
      </form>
    </Modal>
  )
}
