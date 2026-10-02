import { useState } from "react"
import Select from "../../components/Select"
import { AUDIT_ACTIONS, USERS_COLLECTION, recordAuditEvent } from "../lib/firebase"
import { addStaff } from "../patients/chartStore"
import { inputClass, labelClass } from "../patients/noteUi"
import Modal from "../ui/Modal"
import { ROLE_LABELS, grantableRoles } from "./roles"
import { staffErrorMessage } from "./staffMath"

// Add a staff member: name, email, role. They get an email to set their own
// password (chartStore.addStaff).
export default function AddStaffDialog({ actor, onClose, onAdded }) {
  const grantable = grantableRoles(actor.role)
  const [form, setForm] = useState({ name: "", email: "", role: grantable[0] ?? "provider" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    if (!name || !email) {
      setError("Add a name and an email.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const member = await addStaff({ name, email, role: form.role }, actor)
      recordAuditEvent({
        action: AUDIT_ACTIONS.addStaff,
        targetCollection: USERS_COLLECTION,
        targetId: member.uid,
        targetLabel: `${name} (${ROLE_LABELS[form.role]})`,
      })
      onAdded(member)
    } catch (cause) {
      setError(staffErrorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Add user"
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
            form="add-staff"
            disabled={busy}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add user"}
          </button>
        </>
      }
    >
      <form id="add-staff" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-950/60">They'll get an email to set their own password.</p>
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Jordan Lee, NP" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} />
        </label>
        <div>
          <span className={labelClass} aria-hidden="true">
            Role
          </span>
          <Select
            ariaLabel="Role"
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            options={grantable.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
            triggerClassName="px-3 py-2 text-sm"
          />
        </div>
      </form>
    </Modal>
  )
}
