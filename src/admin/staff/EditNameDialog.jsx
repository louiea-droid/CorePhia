import { useState } from "react"
import { AUDIT_ACTIONS, USERS_COLLECTION, recordAuditEvent } from "../lib/firebase"
import { setStaffName } from "../patients/chartStore"
import { inputClass, labelClass } from "../patients/noteUi"
import Modal from "../ui/Modal"
import { staffErrorMessage } from "./staffMath"
import { staffDisplayName } from "./roles"

// Change the name on someone's staff record (admin and super admin, from the
// Staff row's ⋯ menu). It's the name shown in lists and used on notes they
// sign from now on; notes already signed keep the name they were signed with.
export default function EditNameDialog({ member, onClose, onSaved }) {
  const [value, setValue] = useState(member.name ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const name = value.trim()
  const unchanged = name === (member.name ?? "")

  const save = async (event) => {
    event.preventDefault()
    if (!name || unchanged) return
    setBusy(true)
    setError(null)
    try {
      await setStaffName(member.uid, name)
      recordAuditEvent({
        action: AUDIT_ACTIONS.renameStaff,
        targetCollection: USERS_COLLECTION,
        targetId: member.uid,
        targetLabel: `${staffDisplayName(member) || member.uid} → ${name}`,
      })
      onSaved(name)
    } catch (cause) {
      setError(staffErrorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Edit name for ${staffDisplayName(member) || "this account"}`}
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
            form="edit-staff-name"
            disabled={busy || !name || unchanged}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-default disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="edit-staff-name" onSubmit={save} className="space-y-3">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={100}
            autoComplete="off"
            placeholder="Jordan Lee, NP"
            className={inputClass}
          />
        </label>
        <p className="text-sm text-ink-950/60">Notes they've already signed keep the name they were signed with.</p>
      </form>
    </Modal>
  )
}
