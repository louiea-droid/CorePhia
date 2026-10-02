import { useState } from "react"
import Select from "../../components/Select"
import { AUDIT_ACTIONS, USERS_COLLECTION, recordAuditEvent } from "../lib/firebase"
import { setStaffRole } from "../patients/chartStore"
import { labelClass } from "../patients/noteUi"
import Modal from "../ui/Modal"
import { staffErrorMessage } from "./staffMath"
import { ROLE_LABELS, grantableRoles, staffDisplayName } from "./roles"

// Change someone's role, or remove their access ("No access"). The dialog is
// the confirmation: nothing changes until Save.
export default function EditRoleDialog({ member, actor, onClose, onSaved }) {
  const [role, setRole] = useState(member.role ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const options = [...grantableRoles(actor.role).map((key) => ({ value: key, label: ROLE_LABELS[key] })), { value: "", label: "No access" }]
  const name = staffDisplayName(member) || "this account"

  const save = async () => {
    if (role === (member.role ?? "")) return onClose()
    setBusy(true)
    setError(null)
    try {
      await setStaffRole(member.uid, role)
      recordAuditEvent({
        action: AUDIT_ACTIONS.changeStaffRole,
        targetCollection: USERS_COLLECTION,
        targetId: member.uid,
        targetLabel: `${member.name || member.email}: ${ROLE_LABELS[role] ?? "access removed"}`,
      })
      onSaved(role)
    } catch (cause) {
      setError(staffErrorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Role for ${name}`}
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
            type="button"
            onClick={save}
            disabled={busy}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div>
        <span className={labelClass} aria-hidden="true">
          Role
        </span>
        <Select ariaLabel="Role" value={role} onChange={setRole} options={options} triggerClassName="px-3 py-2 text-sm" />
      </div>
      {role === "" && member.role && (
        <p className="text-sm text-ink-950/60">They won't be able to sign in to the admin. Their account and anything they signed are kept.</p>
      )}
    </Modal>
  )
}
