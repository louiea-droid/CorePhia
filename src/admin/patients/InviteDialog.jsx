import { useState } from "react"
import { SUPPORT_PHONE } from "../../lib/siteContact"
import { emailjsConfigured } from "../../lib/emailjs"
import { AUDIT_ACTIONS, recordAuditEvent, usingSeedData } from "../lib/firebase"
import Modal from "../ui/Modal"
import { labelClass } from "./noteUi"
import { PATIENTS_COLLECTION } from "./chartStore"
import { sendInvite } from "./portalStore"

// The invite as the EmailJS template has it typed in (docs/client-portal.md,
// "EmailJS setup"). The browser sends only the address and the invite's ids,
// so nobody holding the public key can send CorePhia email with their own text
// or link. Change the wording there and here together.
const INVITE_EMAIL = {
  subject: "Set up your CorePhia patient portal",
  lines: [
    "Hello,",
    "Your CorePhia patient portal is ready. Use the button below to choose a password and sign in. This is where you'll find updates and messages from your care team.",
  ],
  footer: `The link works for 7 days. Questions? Call us at ${SUPPORT_PHONE} or email info@corephia.com.`,
}

// Send a portal invite (spec: 2026-10-05-portal-invites-emailjs).
export default function InviteDialog({ chartId, patientName, firstName, to, actor, onClose, onSent }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const canSend = emailjsConfigured || usingSeedData

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const invite = await sendInvite({ chartId, to, firstName }, actor)
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
            disabled={busy || !canSend}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
        </>
      }
    >
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
        <div>
          <span className={labelClass}>The email they get</span>
          <div className="space-y-3 rounded-lg border border-ink-950/10 bg-paper-50 px-4 py-3 text-sm leading-relaxed text-ink-950/80">
            <p className="font-semibold text-ink-950">{INVITE_EMAIL.subject}</p>
            {INVITE_EMAIL.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>
              <span className="inline-block rounded-full bg-ink-950 px-4 py-1.5 text-xs font-semibold text-paper-50">Set up your portal</span>
            </p>
            <p className="text-ink-950/60">{INVITE_EMAIL.footer}</p>
          </div>
        </div>
      </form>
    </Modal>
  )
}
