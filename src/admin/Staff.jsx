import { useEffect, useState } from "react"
import Select from "../components/Select"
import { asDate } from "./chartMath"
import { addStaff, deleteStaff, loadStaff, setStaffRole } from "./chartStore"
import ConfirmDialog from "./ConfirmDialog"
import { AUDIT_ACTIONS, USERS_COLLECTION, recordAuditEvent } from "./firebase"
import { inputClass, labelClass } from "./noteUi"
import PageHeader from "./PageHeader"
import { ROLE_LABELS, canManageMember, grantableRoles } from "./roles"

const emptyForm = { name: "", email: "", role: "provider" }

const errorMessage = (cause) => {
  switch (cause?.code) {
    case "auth/email-already-in-use":
      return "This email already has an account. Ask Hyacinth to assign the role."
    case "auth/invalid-email":
      return "That doesn't look like a full email address."
    case "permission-denied":
      return "Your role can't do this."
    default:
      return "Something went wrong. Nothing was changed. Try again."
  }
}

// Who has access to the admin, and at what level. An admin adds providers
// and co-admins and manages providers; super admins are hidden from admins
// and only a super admin changes or deletes an admin. firestore.rules
// enforces the same lines, and nobody can change or delete their own account.
export default function Staff({ actor }) {
  const [staff, setStaff] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [pending, setPending] = useState(null) // { member, role } awaiting confirmation
  const [pendingDelete, setPendingDelete] = useState(null) // member awaiting delete confirmation
  const [saving, setSaving] = useState(false)
  const [rowError, setRowError] = useState(null)

  const grantable = grantableRoles(actor.role)

  useEffect(() => {
    let active = true
    loadStaff(actor.role)
      .then((result) => active && setStaff(result))
      .catch((cause) => active && setLoadError(cause.code ?? cause.message))
    return () => {
      active = false
    }
  }, [actor.role])

  const submit = async (event) => {
    event.preventDefault()
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    if (!name || !email) {
      setFormError("Add a name and an email.")
      return
    }
    setAdding(true)
    setFormError(null)
    setNotice(null)
    try {
      const member = await addStaff({ name, email, role: form.role }, actor)
      recordAuditEvent({
        action: AUDIT_ACTIONS.addStaff,
        targetCollection: USERS_COLLECTION,
        targetId: member.uid,
        targetLabel: `${name} (${ROLE_LABELS[form.role]})`,
      })
      setStaff((current) => [...(current ?? []), member])
      setForm(emptyForm)
      setNotice(`${name} was added. They'll get an email to set their password.`)
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setAdding(false)
    }
  }

  const applyRole = async () => {
    const { member, role } = pending
    setSaving(true)
    setRowError(null)
    try {
      await setStaffRole(member.uid, role)
      recordAuditEvent({
        action: AUDIT_ACTIONS.changeStaffRole,
        targetCollection: USERS_COLLECTION,
        targetId: member.uid,
        targetLabel: `${member.name || member.email}: ${ROLE_LABELS[role] ?? "access removed"}`,
      })
      setStaff((current) => current.map((entry) => (entry.uid === member.uid ? { ...entry, role } : entry)))
      setPending(null)
    } catch (cause) {
      setPending(null)
      setRowError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    const member = pendingDelete
    setSaving(true)
    setRowError(null)
    try {
      await deleteStaff(member.uid)
      recordAuditEvent({
        action: AUDIT_ACTIONS.deleteStaff,
        targetCollection: USERS_COLLECTION,
        targetId: member.uid,
        targetLabel: member.name || member.email || member.uid,
      })
      setStaff((current) => current.filter((entry) => entry.uid !== member.uid))
      setPendingDelete(null)
    } catch (cause) {
      setPendingDelete(null)
      setRowError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  // A super admin manages anyone but themselves; an admin only providers and
  // accounts with no access (roles.js canManageMember, firestore.rules canActOn).
  const canManage = (member) => canManageMember(actor, member)

  const sorted = [...(staff ?? [])].sort(
    (a, b) => Number(!a.role) - Number(!b.role) || (a.name || a.email || "").localeCompare(b.name || b.email || ""),
  )

  return (
    <div className="pb-6">
      <PageHeader title="Staff" description="Who can sign in to the admin." />

      <section className="rounded-2xl border border-ink-950/10 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-950">Add staff</h2>
        <p className="mt-1 text-sm text-ink-950/60">
          They'll get an email to set their own password.
          {(actor.role === "admin" || actor.role === "coAdmin") && " You can add providers and co-admins."}
        </p>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_11rem_auto] sm:items-end">
          <label className="block">
            <span className={labelClass}>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Jordan Lee, NP"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className={inputClass}
            />
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
          <button
            type="submit"
            disabled={adding}
            className="h-[38px] cursor-pointer rounded-lg bg-ink-950 px-4 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
        {formError && (
          <p role="alert" className="mt-3 text-sm text-brand-dark">
            {formError}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 text-sm text-accent-text">
            {notice}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-ink-950/10 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-950">Everyone with an account</h2>
        {rowError && (
          <p role="alert" className="mt-3 text-sm text-brand-dark">
            {rowError}
          </p>
        )}
        {loadError ? (
          <p className="mt-3 text-sm text-brand-dark">Couldn't load staff ({loadError}).</p>
        ) : !staff ? (
          <p className="mt-3 text-sm text-ink-950/50">Loading…</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-950/10">
            {sorted.map((member) => (
              <li key={member.uid} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-950">
                    {member.name || member.email || "Unnamed account"}
                    {member.uid === actor.uid && <span className="font-normal text-ink-950/50"> (you)</span>}
                  </p>
                  <p className="truncate text-xs text-ink-950/55">
                    {[member.email, asDate(member.addedAt) && `added ${asDate(member.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
                {canManage(member) ? (
                  <div className="flex items-center gap-2">
                    {/* Picking a role only asks for confirmation; the row keeps
                        its current role until that's confirmed. */}
                    <div className="w-36">
                      <Select
                        ariaLabel={`Role for ${member.name || member.email}`}
                        value={member.role || ""}
                        onChange={(role) => role !== (member.role || "") && setPending({ member, role })}
                        placeholder="No access"
                        options={grantable.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                        triggerClassName="px-3 py-1.5 text-sm"
                      />
                    </div>
                    {member.role && (
                      <button
                        type="button"
                        onClick={() => setPending({ member, role: "" })}
                        className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-950/60 transition-colors duration-200 hover:bg-red-600/10 hover:text-red-600"
                      >
                        Remove access
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingDelete(member)}
                      aria-label={`Delete ${member.name || member.email}'s account`}
                      className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors duration-200 hover:bg-red-600/10"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      member.role ? "bg-paper-100 text-ink-950/70" : "bg-ink-950/5 text-ink-950/45"
                    }`}
                  >
                    {ROLE_LABELS[member.role] ?? "No access"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.role ? "Change this role?" : "Remove access?"}
        description={
          pending
            ? pending.role
              ? `${pending.member.name || pending.member.email} becomes ${ROLE_LABELS[pending.role]}.`
              : `${pending.member.name || pending.member.email} won't be able to sign in to the admin. Their account and anything they signed are kept.`
            : ""
        }
        confirmLabel={saving ? "Saving…" : pending?.role ? "Change role" : "Remove access"}
        confirmDisabled={saving}
        onConfirm={applyRole}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this account?"
        description={
          pendingDelete
            ? `${pendingDelete.name || pendingDelete.email} is removed from Staff and can't open the admin. Notes they signed keep their name. Their sign-in itself can only be fully deleted in the Firebase console.`
            : ""
        }
        confirmLabel={saving ? "Deleting…" : "Delete"}
        confirmDisabled={saving}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
