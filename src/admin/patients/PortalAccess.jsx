import { useCallback, useEffect, useState } from "react"
import { asDate, inviteExpiresAt, inviteStatus } from "../../lib/inviteMath"
import { canAdmit } from "../staff/roles"
import InviteDialog from "./InviteDialog"
import { loadPortalAccess } from "./portalStore"

const day = (value) => asDate(value)?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? ""

const STATUS_WORDS = { ready: "not sent", failed: "not sent", sent: "sent" }

function statusLine({ kind, invite }) {
  switch (kind) {
    case "active":
      return "Portal active. The patient can log in."
    case "none":
      return "Not invited yet."
    case "sending":
      return "Not sent yet. Try again."
    case "failed":
      return `Not sent: ${invite.error || "the email failed"}. Try again.`
    case "sent":
      return `Invite sent ${day(invite.sentAt)} by ${invite.createdBy?.name}. The link works until ${day(inviteExpiresAt(invite))}.`
    default:
      return `Invite expired ${day(inviteExpiresAt(invite))}. Send a new one.`
  }
}

// The chart's "Patient portal" card: who the invite goes to, where it stands,
// and Send / Resend for roles that can admit.
export default function PortalAccess({ chart, intake, actor }) {
  const [access, setAccess] = useState(null)
  const [failed, setFailed] = useState(false)
  const [composing, setComposing] = useState(false)

  const reload = useCallback(() => {
    loadPortalAccess(chart.id).then(
      (next) => {
        setAccess(next)
        setFailed(false)
      },
      (cause) => {
        console.error("Could not load portal access:", cause.code ?? cause.message)
        setFailed(true)
      },
    )
  }, [chart.id])

  useEffect(reload, [reload])

  const demographics = intake?.demographics ?? {}
  const email = (demographics.email ?? "").trim().toLowerCase()
  const firstName = demographics.firstName || chart.firstName || ""
  const status = access && inviteStatus(access.invites, access.linked)
  const canSend = canAdmit(actor.role) && chart.status === "active" && Boolean(email) && Boolean(access)
  const earlier = access?.invites.slice(1) ?? []

  return (
    <section className="rounded-2xl border border-ink-950/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-950">Patient portal</h2>
        {canSend && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-paper-50 transition-colors duration-200 hover:bg-brand-dark"
          >
            {access.invites.length ? "Resend invite" : "Send portal invite"}
          </button>
        )}
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <p className="break-all text-ink-950/65">{email || "No email on this intake"}</p>
        {failed ? (
          <p className="text-brand-dark">Couldn't load the invite status.</p>
        ) : !status ? (
          <p className="text-ink-950/50">Loading…</p>
        ) : (
          <p className={status.kind === "active" ? "font-medium text-accent-text" : "text-ink-950"}>{statusLine(status)}</p>
        )}
      </div>

      {earlier.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-950/60 transition-colors duration-200 hover:text-ink-950">
            Earlier invites ({earlier.length})
          </summary>
          <ul className="mt-2 space-y-1 text-ink-950/65">
            {earlier.map((invite) => (
              <li key={invite.id}>
                {day(invite.sentAt ?? invite.createdAt)}, {invite.createdBy?.name}, {STATUS_WORDS[invite.status] ?? invite.status}
              </li>
            ))}
          </ul>
        </details>
      )}

      {composing && (
        <InviteDialog
          chartId={chart.id}
          patientName={[chart.firstName, chart.lastName].filter(Boolean).join(" ")}
          firstName={firstName}
          to={email}
          actor={actor}
          onClose={() => {
            setComposing(false)
            reload()
          }}
          onSent={() => {
            setComposing(false)
            reload()
          }}
        />
      )}
    </section>
  )
}
