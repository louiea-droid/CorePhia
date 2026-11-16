// Who may send which email to whom, as a pure function (no Firestore, no I/O)
// so it runs under plain node. index.js calls it twice for decisions: once
// before the claim and again inside the transaction.
const ADMITTERS = ["provider", "coAdmin", "admin", "superAdmin"]
const TEST_SENDERS = ["admin", "superAdmin"]
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NEXT_STATUS = { accepted: "admitted", declined: "declined" }

const no = (code, message) => ({ ok: false, code, message })

export function planSend({ mode, role, intake, template, callerEmail }) {
  if (!template) return no("not-found", "That email template doesn't exist.")
  if (mode === "test") {
    if (!TEST_SENDERS.includes(role)) return no("permission-denied", "Only an admin can send a test email.")
    return { ok: true, to: String(callerEmail ?? "").trim().toLowerCase(), kind: "test" }
  }
  if (mode !== "decision" && mode !== "manual") return no("invalid-argument", "Unknown send mode.")
  if (!ADMITTERS.includes(role)) return no("permission-denied", "You can't send patient emails.")
  if (template.status !== "published") return no("failed-precondition", "That template isn't published.")
  if (!intake) return no("not-found", "That applicant doesn't exist.")
  const wanted = mode === "decision" ? ["accepted", "declined"] : ["manual"]
  if (!wanted.includes(template.purpose)) return no("invalid-argument", "That template can't be sent this way.")
  if (mode === "decision") {
    const sent = intake.patientEmails ?? {}
    const kind = ["accepted", "declined"].find((k) => sent[k])
    if (kind) {
      const at = sent[kind].sentAt?.toDate?.().toISOString?.() ?? sent[kind].sentAt
      return no("already-exists", `The ${kind} email was already sent${at ? ` on ${at}` : ""}.`)
    }
  }
  const to = String(intake.demographics?.email ?? "").trim().toLowerCase()
  if (!EMAIL.test(to)) return no("failed-precondition", "This applicant has no valid email address.")
  return mode === "decision"
    ? { ok: true, to, kind: template.purpose, nextStatus: NEXT_STATUS[template.purpose] }
    : { ok: true, to, kind: "manual" }
}
