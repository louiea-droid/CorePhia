import { useState } from "react"
import { tiers } from "../../data/pricingTiers"
import ConfirmDialog from "../ui/ConfirmDialog"
import Modal from "../ui/Modal"
import { AUDIT_ACTIONS, recordAuditEvent } from "../lib/firebase"
import { endManualMembership, PATIENTS_COLLECTION, setManualMembership } from "./chartStore"
import { labelClass } from "./noteUi"

const fieldClass =
  "w-full rounded-lg border border-ink-950/15 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition-colors duration-200 focus:border-ink-950/40"

const failure = (cause) => (cause?.code === "permission-denied" ? "This chart has a Stripe membership, or your role can't change it." : "Couldn't save. Try again.")

// Mark a patient as a member by hand, for a payment taken outside Stripe. The
// reason goes only in the audit entry, never on the chart.
export function MarkMemberDialog({ chart, patientName, onClose, onDone }) {
  const [plan, setPlan] = useState(chart.formPlan ?? tiers[0].name)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await setManualMembership(chart.id, plan)
      recordAuditEvent({
        action: AUDIT_ACTIONS.setMembership,
        targetCollection: PATIENTS_COLLECTION,
        targetId: chart.id,
        targetLabel: `${patientName}, ${plan}, ${reason.trim()}`.slice(0, 200),
      })
      onDone()
    } catch (cause) {
      setError(failure(cause))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Mark as member"
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
            form="mark-member"
            disabled={busy}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : "Mark as member"}
          </button>
        </>
      }
    >
      <form id="mark-member" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-950/70">Use this for a membership paid outside Stripe. It is recorded in the activity log.</p>
        <div>
          <label htmlFor="member-plan" className={labelClass}>
            Plan
          </label>
          <select id="member-plan" value={plan} onChange={(event) => setPlan(event.target.value)} className={fieldClass}>
            {tiers.map((tier) => (
              <option key={tier.name}>{tier.name}</option>
            ))}
          </select>
          {chart.formPlan && <p className="mt-1 text-xs text-ink-950/55">They chose {chart.formPlan} on the form.</p>}
        </div>
        <div>
          <label htmlFor="member-reason" className={labelClass}>
            Reason
          </label>
          <input
            id="member-reason"
            required
            maxLength={100}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Paid by check, test account…"
            aria-describedby="member-reason-hint"
            className={fieldClass}
          />
          <p id="member-reason-hint" className="mt-1 text-xs text-ink-950/55">
            Don't include health details.
          </p>
        </div>
      </form>
    </Modal>
  )
}

export function EndMembershipDialog({ chart, patientName, open, onClose, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await endManualMembership(chart.id, chart.membership)
      recordAuditEvent({
        action: AUDIT_ACTIONS.endMembership,
        targetCollection: PATIENTS_COLLECTION,
        targetId: chart.id,
        targetLabel: `${patientName}, ${chart.membership.plan}`.slice(0, 200),
      })
      onDone()
    } catch (cause) {
      setError(failure(cause))
    }
    setBusy(false)
  }

  return (
    <ConfirmDialog
      open={open}
      title="End this membership?"
      description={`${patientName} will show as "Membership ended". Their chart and notes are not changed.`}
      confirmLabel={busy ? "Saving…" : "End membership"}
      confirmDisabled={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {error && <p role="alert" className="text-sm text-brand-dark">{error}</p>}
    </ConfirmDialog>
  )
}
