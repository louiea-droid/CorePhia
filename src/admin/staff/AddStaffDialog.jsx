import { useState } from "react"
import Select from "../../components/Select"
import { AUDIT_ACTIONS, USERS_COLLECTION, recordAuditEvent } from "../lib/firebase"
import { addStaff } from "../patients/chartStore"
import { inputClass, labelClass } from "../patients/noteUi"
import Modal from "../ui/Modal"
import { ROLE_LABELS, canNameStaff, grantableRoles } from "./roles"
import { staffErrorMessage } from "./staffMath"

// Add a staff member: name, email, role. They get an email to set their own
// password (chartStore.addStaff).
export default function AddStaffDialog({ actor, onClose, onAdded }) {
  const grantable = grantableRoles(actor.role)
  const [form, setForm] = useState({ name: "", email: "", role: grantable[0] ?? "provider" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // A co-admin adds people without a name (roles.canNameStaff); the admin
  // names them later with Edit name.
  const canName = canNameStaff(actor.role)

  const submit = async (event) => {
    event.preventDefault()
    const name = canName ? form.name.trim() : ""
    const email = form.email.trim().toLowerCase()
    if ((canName && !name) || !email) {
      setError(canName ? "Add a name and an email." : "Add an email.")
      return
    }
    // Checked before the login is created, so an over-long name can't leave a
    // login with no staff record (the rules cap it at 100).
    if (name.length > 100) {
      setError("Keep the name to 100 characters.")
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
        targetLabel: `${name || email} (${ROLE_LABELS[form.role]})`,
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
        {canName ? (
          <label className="block">
            <span className={labelClass}>Name</span>
            <input
              value={form.name}
              maxLength={100}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Jordan Lee, NP"
              className={inputClass}
            />
          </label>
        ) : (
          <p className="text-sm text-ink-950/60">
            The admin sets the name their notes are signed with. Until then, their notes show their email.
          </p>
        )}
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
