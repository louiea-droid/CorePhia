import { useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { PURPOSE_LABELS, renderTemplate } from "../../../functions/emailRender.js"
import EmailFrame from "../emails/EmailFrame"
import { pickable } from "../emails/templateMath"
import { sendPatientEmail } from "../emails/templateStore"
import { formatDay } from "../ui/formUi"
import { CloseIcon } from "../ui/icons"
import { getAdminPortalRoot } from "../ui/portalRoot"
import { useDialog } from "../ui/useDialog"
import { emailDialogState } from "./patientEmailState"

const TITLE_VERB = { accepted: "Admit", declined: "Decline", manual: "Email" }
const CONFIRM = { accepted: "Admit and send email", declined: "Decline and send email", manual: "Send email" }
const SENT_NAME = { accepted: "acceptance", declined: "decline" }

const button =
  "inline-flex cursor-pointer items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
const quiet = `${button} font-medium text-ink-950/70 hover:bg-ink-950/5 hover:text-ink-950`
const outline = `${button} border border-ink-950/15 text-ink-950 hover:bg-ink-950/5`
// Decline is red, as on the status buttons; Admit and New email are the accent.
const solid = (purpose) =>
  `${button} text-oncolor ${purpose === "declined" ? "bg-red-600 hover:bg-red-700" : "bg-accent-dark hover:bg-brand-dark"}`
const picked = (purpose) =>
  purpose === "declined" ? "border-red-600 bg-red-600/5" : "border-accent-dark bg-accent-dark/5"
const dot = (purpose) => (purpose === "declined" ? "checked:border-red-600" : "checked:border-accent-dark")

// Admit / Decline / New email for one applicant. Mounted only while open, so
// every open starts fresh (default template picked, no old error).
// onSent(templateId, sentAt) after the function sent it; onStatusOnly() for
// "Change status" without an email (decisions only; may throw).
export default function PatientEmailDialog({ record, purpose, templates, templatesError, onCancel, onSent, onStatusOnly }) {
  const cancelRef = useRef(null)
  const titleId = useId()
  const [chosenId, setChosenId] = useState(null)
  const [busy, setBusy] = useState(null) // "send" | "status"
  const [error, setError] = useState(null)
  const [previewing, setPreviewing] = useState(false)

  useDialog({ onClose: onCancel, focusRef: cancelRef, closable: !busy })

  const firstName = record.demographics?.firstName?.trim() || "This applicant"
  const fullName = [record.demographics?.firstName, record.demographics?.lastName].filter(Boolean).join(" ") || "this applicant"
  const email = String(record.demographics?.email ?? "").trim()
  const decision = purpose !== "manual"
  const state = emailDialogState(record, purpose)
  const picks = templates ? pickable(templates, purpose) : []
  const chosen = picks.find((t) => t.id === chosenId) ?? picks[0]
  const loading = state.kind === "send" && !templates && !templatesError

  const send = async () => {
    setBusy("send")
    setError(null)
    try {
      const { sentAt } = await sendPatientEmail({ mode: decision ? "decision" : "manual", templateId: chosen.id, intakeId: record.id })
      onSent(chosen.id, sentAt)
    } catch (cause) {
      setError(cause?.message || "The email couldn't be sent.")
      setBusy(null)
    }
  }

  const statusOnly = async () => {
    setBusy("status")
    setError(null)
    try {
      await onStatusOnly()
    } catch (cause) {
      setError(cause?.code ?? cause?.message ?? "Could not update this applicant's status.")
      setBusy(null)
    }
  }

  let message
  let actions = null
  const statusOnlyButton = (label, className) => (
    <button type="button" onClick={statusOnly} disabled={Boolean(busy)} className={className}>
      {busy === "status" ? "Saving…" : label}
    </button>
  )

  if (state.kind === "alreadySent") {
    const on = formatDay(state.sentAt)
    message = `${firstName} already received the ${SENT_NAME[state.sentKind]} email${on ? ` on ${on}` : ""}. Contact them directly to explain the change.`
    actions = statusOnlyButton("Change status", solid(purpose))
  } else if (state.kind === "noEmail") {
    message = `${firstName} has no valid email address, so no email can be sent.`
    if (decision) actions = statusOnlyButton("Change status without email", solid(purpose))
  } else if (loading) {
    message = "Loading the email templates…"
    actions = (
      <button type="button" disabled className={solid(purpose)}>
        {CONFIRM[purpose]}
      </button>
    )
  } else if (!chosen) {
    message = templatesError
      ? `The email templates couldn't be loaded: ${templatesError}`
      : `There's no published ${PURPOSE_LABELS[purpose]} template yet.`
    if (decision) actions = statusOnlyButton("Change status without email", solid(purpose))
  } else {
    message = `Choose the email ${firstName} gets at ${email}.`
    actions = (
      <>
        {error && decision && statusOnlyButton("Change status without email", outline)}
        <button type="button" onClick={send} disabled={Boolean(busy)} className={solid(purpose)}>
          {busy === "send" ? "Sending…" : error ? "Try again" : CONFIRM[purpose]}
        </button>
      </>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div aria-hidden="true" onClick={() => !busy && onCancel()} className="absolute inset-0 bg-scrim/50" />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-white p-6 shadow-2xl"
        >
          <p id={titleId} className="font-serif text-xl text-ink-950">
            {TITLE_VERB[purpose]} {fullName}
            {decision ? "?" : ""}
          </p>
          <p className="mt-2 text-sm text-ink-950/70">{message}</p>

          {state.kind === "send" && chosen && (
            <fieldset className="scrollbar-thin mt-4 -mx-1 min-h-0 space-y-2 overflow-y-auto px-1 py-0.5">
              <legend className="sr-only">Email to send</legend>
              {picks.map((t) => {
                const on = t.id === chosen.id
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-200 ${
                      on ? picked(purpose) : "border-ink-950/15 hover:bg-ink-950/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name="patient-email-template"
                      checked={on}
                      disabled={Boolean(busy)}
                      onChange={() => setChosenId(t.id)}
                      className={`mt-0.5 size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-ink-950/25 transition-colors duration-200 checked:border-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark ${dot(purpose)}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold break-words text-ink-950">{t.name}</span>
                      <span className="mt-0.5 block text-xs break-words text-ink-950/60">
                        {t.isDefault ? "Default · " : ""}
                        {t.subject.replaceAll("{firstName}", firstName)}
                      </span>
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}

          {state.kind === "send" && chosen && (
            <button
              type="button"
              onClick={() => setPreviewing(true)}
              className="mt-2 cursor-pointer self-start rounded text-sm font-medium text-accent-text underline-offset-2 transition-colors duration-200 hover:underline"
            >
              Preview
            </button>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700 [.dark_&]:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button ref={cancelRef} type="button" onClick={onCancel} disabled={Boolean(busy)} className={quiet}>
              Cancel
            </button>
            {actions}
          </div>
        </div>
      </div>

      {previewing && chosen && (
        <EmailPreview template={chosen} firstName={record.demographics?.firstName?.trim() || "Jane"} email={email} onClose={() => setPreviewing(false)} />
      )}
    </div>,
    getAdminPortalRoot(),
  )
}

// The chosen template as the applicant will get it, from the same renderer the
// function sends with.
function EmailPreview({ template, firstName, email, onClose }) {
  const closeRef = useRef(null)
  useDialog({ onClose, focusRef: closeRef })
  const { subject, html } = renderTemplate(template, { firstName })
  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-scrim/50" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${template.name}`}
          className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-ink-950/10 px-5 py-4">
            <div className="min-w-0 text-sm">
              <p className="font-semibold break-words text-ink-950">{subject}</p>
              <p className="text-xs break-all text-ink-950/60">CorePhia &lt;info@corephia.com&gt; to {email}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="cursor-pointer rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
          <div className="scrollbar-thin overflow-y-auto">
            <EmailFrame html={html} />
          </div>
        </div>
      </div>
    </div>
  )
}
