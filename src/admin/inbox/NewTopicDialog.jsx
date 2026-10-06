import { useEffect, useState } from "react"
import { messageEmailConfigured } from "../../lib/emailjs"
import { usingSeedData } from "../lib/firebase"
import { loadCharts, loadIntakeRecord } from "../patients/chartStore"
import { inputClass, labelClass } from "../patients/noteUi"
import Modal from "../ui/Modal"
import { startTopic } from "./topicStore"

// Start a topic with a patient. Active charts only: an applicant has no chart
// and an inactive chart can't be messaged.
export default function NewTopicDialog({ actor, initialChartId = "", onClose, onStarted }) {
  const [charts, setCharts] = useState(null)
  const [chartId, setChartId] = useState(initialChartId)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [email, setEmail] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const canEmail = messageEmailConfigured || usingSeedData

  useEffect(() => {
    let live = true
    loadCharts()
      .then((all) => live && setCharts(all.filter((chart) => chart.status === "active").sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`))))
      .catch(() => live && setCharts([]))
    return () => {
      live = false
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (!chartId) return setError("Choose a patient.")
    if (!subject.trim()) return setError("Add a subject.")
    if (!body.trim()) return setError("Write a message first.")
    if (body.trim().length > 2000) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      const intake = await loadIntakeRecord(chartId).catch(() => null)
      const to = (intake?.demographics?.email ?? "").trim().toLowerCase()
      const { topicId } = await startTopic({ chartId, subject: subject.trim(), body: body.trim(), to, email: email && canEmail }, actor)
      onStarted({ chartId, topicId })
    } catch (cause) {
      setError(cause?.code === "permission-denied" ? "This chart can't be messaged." : "Couldn't send the message. Try again.")
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New message"
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
            form="new-topic"
            disabled={busy || !charts}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </>
      }
    >
      <form id="new-topic" onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={labelClass}>Patient</span>
          <select value={chartId} onChange={(event) => setChartId(event.target.value)} className={inputClass} disabled={!charts}>
            <option value="">{charts ? "Choose a patient" : "Loading patients…"}</option>
            {charts?.map((chart) => (
              <option key={chart.id} value={chart.id}>
                {`${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Subject</span>
          <input value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Message</span>
          <textarea value={body} rows={6} onChange={(event) => setBody(event.target.value)} className={`${inputClass} resize-y leading-relaxed`} />
        </label>
        <label className={`flex items-start gap-2 text-sm ${canEmail ? "cursor-pointer text-ink-950/80" : "text-ink-950/50"}`}>
          <input type="checkbox" checked={email && canEmail} disabled={!canEmail} onChange={(event) => setEmail(event.target.checked)} className="mt-0.5 size-4 accent-accent-dark" />
          <span>
            Email the patient that there's a new message
            {!canEmail && <span className="block text-xs">Email sending isn't set up yet.</span>}
          </span>
        </label>
        <p className="text-xs text-ink-950/55">The patient sees your name and role. The email doesn't include the message.</p>
      </form>
    </Modal>
  )
}
