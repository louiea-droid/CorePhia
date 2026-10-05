import { useEffect, useState } from "react"
import { fillTemplate, toTemplate } from "../../lib/inviteMath"
import { SUPPORT_PHONE } from "../../lib/siteContact"
import { emailjsConfigured } from "../lib/emailjs"
import { AUDIT_ACTIONS, recordAuditEvent, usingSeedData } from "../lib/firebase"
import { canEditInviteTemplate } from "../staff/roles"
import Modal from "../ui/Modal"
import { inputClass, labelClass } from "./noteUi"
import { PATIENTS_COLLECTION } from "./chartStore"
import { loadInviteTemplate, saveInviteTemplate, sendInvite } from "./portalStore"

// Compose and send a portal invite (spec: 2026-10-05-portal-invites-emailjs).
// The setup link is added by portalStore, never part of the editable text.
export default function InviteDialog({ chartId, patientName, firstName, to, actor, onClose, onSent }) {
  const [form, setForm] = useState(null) // null = loading the template
  const [saveTemplate, setSaveTemplate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const values = { firstName, phone: SUPPORT_PHONE }
  const canSend = emailjsConfigured || usingSeedData
  const canSaveTemplate = canEditInviteTemplate(actor.role)

  useEffect(() => {
    let active = true
    loadInviteTemplate()
      .catch(() => null)
      .then((template) => {
        if (!active) return
        const { subject, message } = template ?? { subject: "", message: "" }
        setForm({ subject: fillTemplate(subject, values), message: fillTemplate(message, values) })
      })
    return () => {
      active = false
    }
    // values only change with the patient, and the dialog is per patient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    const subject = form.subject.trim()
    const message = form.message.trim()
    if (!subject || !message) {
      setError("Add a subject and a message.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (saveTemplate) await saveInviteTemplate({ subject: toTemplate(subject, values), message: toTemplate(message, values) }, actor)
    } catch {
      setError("Couldn't save the template. Nothing was sent.")
      setBusy(false)
      return
    }
    try {
      const invite = await sendInvite({ chartId, to, firstName, subject, message }, actor)
      if (invite.status === "sent") {
        recordAuditEvent({ action: AUDIT_ACTIONS.sendPortalInvite, targetCollection: PATIENTS_COLLECTION, targetId: chartId, targetLabel: patientName })
        onSent()
        return
      }
      setError(
        invite.status === "unrecorded"
          ? "The email went out, but saving it failed, so its link won't work. Send the invite again."
          : `The email didn't send: ${invite.error}`,
      )
    } catch (cause) {
      setError(cause?.code === "permission-denied" ? "Your role can't send invites for this chart." : "Couldn't save the invite. Nothing was sent.")
    }
    setBusy(false)
  }

  return (
    <Modal
      title="Send portal invite"
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
            form="portal-invite"
            disabled={busy || !form || !canSend}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
        </>
      }
    >
      {!form ? (
        <p className="text-sm text-ink-950/55">Loading the message…</p>
      ) : (
        <form id="portal-invite" onSubmit={submit} className="space-y-4">
          {!canSend && (
            <p className="rounded-lg bg-paper-100 px-3 py-2 text-sm text-ink-950/75">
              Email sending isn't set up yet. Add the EmailJS keys to the site's settings, then try again.
            </p>
          )}
          <div>
            <span className={labelClass}>To</span>
            <p className="text-sm break-all text-ink-950">{to}</p>
          </div>
          <label className="block">
            <span className={labelClass}>Subject</span>
            <input
              value={form.subject}
              maxLength={200}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Message</span>
            <textarea
              value={form.message}
              maxLength={5000}
              rows={9}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </label>
          <p className="text-xs text-ink-950/55">
            A secure <span className="font-semibold text-ink-950/75">Set up your portal</span> button is added below your
            message. The link works for 7 days.
          </p>
          {canSaveTemplate && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-950/80">
              <input type="checkbox" checked={saveTemplate} onChange={(event) => setSaveTemplate(event.target.checked)} className="size-4 accent-accent-dark" />
              Save as the default template
            </label>
          )}
        </form>
      )}
    </Modal>
  )
}
