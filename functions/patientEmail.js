// Who may send which email to whom, as a pure function (no Firestore, no I/O)
// so it runs under plain node. index.js calls it twice for decisions: once
// before the claim and again inside the transaction.
import { PURPOSE_LABELS } from "./emailRender.js"

const ADMITTERS = ["provider", "coAdmin", "admin", "superAdmin"]
const TEST_SENDERS = ["admin", "superAdmin"]
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NEXT_STATUS = { accepted: "admitted", declined: "declined" }
const DECISIONS = ["accepted", "declined"]
const DECISION_NAME = { accepted: "An acceptance", declined: "A decline" }
// A "sending" claim older than this is from a send that crashed, and stops blocking.
const STALE_CLAIM_MS = 10 * 60 * 1000

const no = (code, message) => ({ ok: false, code, message })
// claimedAt is ms, or a Firestore Timestamp (server and client SDKs both have toMillis).
const millis = (v) => (typeof v === "number" ? v : v?.toMillis?.())

// now: ms. Without it (or without claimedAt) a claim is never stale.
export function isStaleClaim(entry, now) {
  return entry?.state === "sending" && now - millis(entry.claimedAt) > STALE_CLAIM_MS
}

// The decision email already sent or in flight for this intake, if any.
export const sentDecision = (patientEmails, now) => DECISIONS.find((k) => patientEmails?.[k] && !isStaleClaim(patientEmails[k], now))

export function planSend({ mode, role, intake, template, callerEmail, now }) {
  if (!template) return no("not-found", "That email template doesn't exist.")
  if (mode === "test") {
    if (!TEST_SENDERS.includes(role)) return no("permission-denied", "Only an admin can send a test email.")
    return { ok: true, to: String(callerEmail ?? "").trim().toLowerCase(), kind: "test" }
  }
  if (mode !== "decision" && mode !== "manual") return no("invalid-argument", "Unknown send mode.")
  if (!ADMITTERS.includes(role)) return no("permission-denied", "You can't send patient emails.")
  if (template.status !== "published") return no("failed-precondition", "That template isn't published.")
  if (!intake) return no("not-found", "That applicant doesn't exist.")
  const wanted = mode === "decision" ? DECISIONS : ["manual"]
  if (!wanted.includes(template.purpose)) return no("invalid-argument", "That template can't be sent this way.")
  if (mode === "decision") {
    const kind = sentDecision(intake.patientEmails, now)
    if (kind) {
      const verb = intake.patientEmails[kind].state === "sending" ? "is already being sent" : "was already sent"
      return no("already-exists", `${DECISION_NAME[kind]} email ${verb} for this applicant.`)
    }
  }
  const to = String(intake.demographics?.email ?? "").trim().toLowerCase()
  if (!EMAIL.test(to)) return no("failed-precondition", "This applicant has no valid email address.")
  return mode === "decision"
    ? { ok: true, to, kind: template.purpose, nextStatus: NEXT_STATUS[template.purpose] }
    : { ok: true, to, kind: "manual" }
}

const LABEL = { accepted: "Acceptance email", declined: "Decline email", manual: "New email" }

// The audit entry's label: who a decision or New email went to, so Activity
// shows who was admitted or declined. A test names the template's purpose.
export function sendLabel({ mode, kind, intake, template }) {
  if (mode === "test") return `${PURPOSE_LABELS[template.purpose]} email`
  const d = intake?.demographics ?? {}
  const who = [d.firstName, d.lastName].map((s) => String(s ?? "").trim()).filter(Boolean).join(" ")
  return (who ? `${LABEL[kind]} to ${who}` : LABEL[kind]).slice(0, 200)
}
