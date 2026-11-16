// Self-check for patientEmailState.js: `npm run check`.
import assert from "node:assert/strict"
import { formatStamp } from "../ui/formUi.js"
import { emailDialogState, sentLines, sentPatch } from "./patientEmailState.js"

const at = "2026-11-16T19:14:00.000Z"
const jane = { id: "a", demographics: { firstName: "Jane", email: "jane@example.com" } }
const sent = (kind, extra = {}) => ({ ...jane, patientEmails: { [kind]: { state: "sent", templateId: "t1", sentAt: at, ...extra } } })

// Never emailed: every purpose sends.
for (const purpose of ["accepted", "declined", "manual"]) assert.deepEqual(emailDialogState(jane, purpose), { kind: "send" })

// One decision email per intake: either one blocks both.
assert.deepEqual(emailDialogState(sent("declined"), "accepted"), { kind: "alreadySent", sentKind: "declined", sentAt: at })
assert.deepEqual(emailDialogState(sent("accepted"), "declined"), { kind: "alreadySent", sentKind: "accepted", sentAt: at })
assert.deepEqual(emailDialogState(sent("accepted"), "accepted"), { kind: "alreadySent", sentKind: "accepted", sentAt: at })
// A send in flight counts as sent (the function holds the claim).
assert.deepEqual(emailDialogState(sent("accepted", { state: "sending", sentAt: undefined }), "declined"), {
  kind: "alreadySent",
  sentKind: "accepted",
  sentAt: undefined,
})
// A claim stuck at "sending" for over 10 minutes no longer blocks (the function treats it the same).
const now = Date.parse(at)
const claim = (minutes) => ({ ...jane, patientEmails: { accepted: { state: "sending", claimedAt: { toMillis: () => now - minutes * 60000 } } } })
assert.deepEqual(emailDialogState(claim(11), "declined", now), { kind: "send" })
assert.equal(emailDialogState(claim(1), "declined", now).kind, "alreadySent")
// A New email is never blocked by a decision email.
assert.deepEqual(emailDialogState(sent("declined"), "manual"), { kind: "send" })

// No or invalid email.
for (const email of ["", "   ", "jane", "jane@example", undefined]) {
  const record = { ...jane, demographics: { ...jane.demographics, email } }
  assert.deepEqual(emailDialogState(record, "declined"), { kind: "noEmail" })
  assert.deepEqual(emailDialogState(record, "manual"), { kind: "noEmail" })
}
assert.deepEqual(emailDialogState({ id: "b" }, "accepted"), { kind: "noEmail" })

// Sent lines.
assert.deepEqual(sentLines(jane, []), [])
assert.deepEqual(sentLines(sent("accepted"), []), [`Acceptance email sent ${formatStamp(at)}`])
assert.deepEqual(sentLines(sent("declined"), []), [`Decline email sent ${formatStamp(at)}`])
assert.deepEqual(sentLines(sent("declined", { state: "sending", sentAt: undefined }), []), [])
const manual = {
  ...jane,
  patientEmails: {
    accepted: { state: "sent", templateId: "t1", sentAt: at },
    manual: [
      { templateId: "m1", sentAt: at },
      { templateId: "gone", sentAt: at },
    ],
  },
}
assert.deepEqual(sentLines(manual, [{ id: "m1", name: "Checking in" }]), [
  `Acceptance email sent ${formatStamp(at)}`,
  `Email sent: Checking in ${formatStamp(at)}`,
  `Email sent: New email ${formatStamp(at)}`,
])

// What the record looks like locally after a send (the function wrote the same).
assert.deepEqual(sentPatch(jane, "declined", "t2", at), {
  status: "declined",
  patientEmails: { declined: { state: "sent", templateId: "t2", sentAt: at } },
})
assert.deepEqual(sentPatch(sent("declined"), "accepted", "t3", at).status, "admitted")
assert.deepEqual(sentPatch(manual, "manual", "m2", at), {
  patientEmails: { ...manual.patientEmails, manual: [...manual.patientEmails.manual, { templateId: "m2", sentAt: at }] },
})

console.log("patientEmailState: ok")
