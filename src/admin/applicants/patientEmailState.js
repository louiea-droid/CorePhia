// What the patient email dialog on Applicants should offer, and the "sent"
// lines on a record. Pure, so `npm run check` runs it under plain node.
import { EMAIL } from "../../../functions/patientEmail.js"
import { formatStamp } from "../ui/formUi.js"

const DECISIONS = ["accepted", "declined"]

// purpose: accepted | declined | manual. Only one decision email per intake,
// ever, so either one already sent (or in flight) blocks both; a New email
// is never blocked by one.
export function emailDialogState(record, purpose) {
  const emails = record?.patientEmails ?? {}
  const sentKind = purpose === "manual" ? null : DECISIONS.find((kind) => emails[kind])
  if (sentKind) return { kind: "alreadySent", sentKind, sentAt: emails[sentKind].sentAt }
  if (!EMAIL.test(String(record?.demographics?.email ?? "").trim())) return { kind: "noEmail" }
  return { kind: "send" }
}

const DECISION_LINE = { accepted: "Acceptance email sent", declined: "Decline email sent" }

export function sentLines(record, templates = []) {
  const emails = record?.patientEmails ?? {}
  const decisions = DECISIONS.filter((kind) => emails[kind]?.state === "sent").map(
    (kind) => `${DECISION_LINE[kind]} ${formatStamp(emails[kind].sentAt)}`,
  )
  const manual = (Array.isArray(emails.manual) ? emails.manual : []).map((entry) => {
    const name = templates.find((t) => t.id === entry.templateId)?.name ?? "New email"
    return `Email sent: ${name} ${formatStamp(entry.sentAt)}`
  })
  return [...decisions, ...manual]
}

const NEXT_STATUS = { accepted: "admitted", declined: "declined" }

// The record's local update after sendPatientEmail succeeds, matching what the
// function wrote (clients can't write patientEmails themselves).
export function sentPatch(record, purpose, templateId, sentAt) {
  const emails = record?.patientEmails ?? {}
  if (purpose === "manual") {
    const list = Array.isArray(emails.manual) ? emails.manual : []
    return { patientEmails: { ...emails, manual: [...list, { templateId, sentAt }].slice(-20) } }
  }
  return { status: NEXT_STATUS[purpose], patientEmails: { ...emails, [purpose]: { state: "sent", templateId, sentAt } } }
}
