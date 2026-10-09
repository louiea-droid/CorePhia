import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import Select from "../../components/Select"
import { asDate } from "../patients/chartMath"
import { deleteStaff, loadStaff, setStaffRole } from "../patients/chartStore"
import { formatDay, formatStamp } from "../patients/noteUi"
import ConfirmDialog from "../ui/ConfirmDialog"
import { CheckIcon, ClockIcon, CloseIcon, MoreIcon, PencilIcon, SearchIcon } from "../ui/icons"
import Pagination from "../ui/Pagination"
import { AUDIT_ACTIONS, USERS_COLLECTION, recordAuditEvent, signOutAdmin } from "../lib/firebase"
import { PAGE_SIZE_OPTIONS } from "../lib/constants"
import PageHeader from "../layout/PageHeader"
import AddStaffDialog from "./AddStaffDialog"
import Avatar from "../ui/Avatar"
import { useStaffPhotos } from "../lib/staffPhotos"
import EditNameDialog from "./EditNameDialog"
import EditRoleDialog from "./EditRoleDialog"
import { ROLE_LABELS, canManageMember, canRenameMember, staffDisplayName } from "./roles"
import { filterStaff, staffErrorMessage } from "./staffMath"

const PAGE_SIZE_KEY = "corephia-admin-staff-page-size"
const readPageSize = () => {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : 10
  } catch {
    return 10
  }
}

const initialsOf = (member) =>
  staffDisplayName(member)
    .split(/[\s,]+/)
    .filter((part) => /^[A-Za-z]/.test(part))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?"

const iconButton =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-ink-950/15 text-ink-950/70 transition-colors duration-200 hover:bg-paper-100 hover:text-ink-950"

function RoleBadge({ role }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
        role ? "bg-paper-100 text-ink-950/75 ring-1 ring-ink-950/10" : "text-ink-950/45 ring-1 ring-ink-950/10"
      }`}
    >
      {ROLE_LABELS[role] ?? "No access"}
    </span>
  )
}

function Status({ role }) {
  return role ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-text">
      <CheckIcon className="size-3.5" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-950/50">
      <CloseIcon className="size-3.5" />
      No access
    </span>
  )
}

function LastSignIn({ value }) {
  return value ? (
    <span className="text-sm text-ink-950/70">{formatStamp(value)}</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm text-ink-950/45">
      <ClockIcon className="size-3.5" />
      Never
    </span>
  )
}

// The ⋯ menu: a short list of actions, closed by a click outside or Escape.
function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])
  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={iconButton}>
        <MoreIcon className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-20 mt-1.5 w-48 rounded-xl bg-white p-1 shadow-xl ring-1 ring-ink-950/10">
          {items.map((item) =>
            item.to ? (
              <Link key={item.label} role="menuitem" to={item.to} className="block rounded-lg px-3 py-2 text-sm text-ink-950 transition-colors duration-150 hover:bg-paper-100">
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className={`block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-paper-100 ${
                  item.danger ? "text-red-700 [.dark_&]:text-red-400" : "text-ink-950"
                }`}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

// Who can sign in to the admin, at what level, and when they last did.
// Permissions are unchanged: canManageMember here, canActOn in the rules;
// nobody changes their own role or removes their own account.
export default function Staff({ actor }) {
  const [staff, setStaff] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(readPageSize)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [pendingRemove, setPendingRemove] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [rowError, setRowError] = useState(null)
  const photos = useStaffPhotos()

  useEffect(() => {
    let active = true
    loadStaff(actor.role)
      .then((result) => active && setStaff(result))
      .catch((cause) => active && setLoadError(cause.code ?? cause.message))
    return () => {
      active = false
    }
  }, [actor.role])

  const patchMember = (uid, patch) => setStaff((current) => current.map((entry) => (entry.uid === uid ? { ...entry, ...patch } : entry)))

  const removeAccess = async () => {
    const member = pendingRemove
    setSaving(true)
    setRowError(null)
    try {
      await setStaffRole(member.uid, "")
      recordAuditEvent({
        action: AUDIT_ACTIONS.changeStaffRole,
        targetCollection: USERS_COLLECTION,
        targetId: member.uid,
        targetLabel: `${member.name || member.email}: access removed`,
      })
      patchMember(member.uid, { role: "" })
    } catch (cause) {
      setRowError(staffErrorMessage(cause))
    } finally {
      setPendingRemove(null)
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
    } catch (cause) {
      setRowError(staffErrorMessage(cause))
    } finally {
      setPendingDelete(null)
      setSaving(false)
    }
  }

  const roleOptions = [
    { value: "all", label: "All roles" },
    ...Object.entries(ROLE_LABELS)
      .filter(([key]) => key !== "superAdmin" || actor.role === "superAdmin")
      .map(([value, label]) => ({ value, label })),
    { value: "", label: "No access" },
  ]
  const filtered = staff ? filterStaff(staff, { search, role: roleFilter }) : []
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Your own row: Profile and Sign out, never your own role or removal.
  // Others: edit and remove/delete where your role allows (canManageMember).
  const actionsFor = (member) => {
    const name = staffDisplayName(member) || "this account"
    if (member.uid === actor.uid)
      return (
        <div className="flex items-center justify-end gap-1.5">
          <Link to="/admin/security" aria-label="Edit your profile" className={iconButton}>
            <PencilIcon className="size-4" />
          </Link>
          <RowMenu
            label="More for your account"
            items={[
              { label: "Profile", to: "/admin/security" },
              { label: "Sign out", onClick: () => setConfirmSignOut(true) },
            ]}
          />
        </div>
      )
    if (!canManageMember(actor, member)) return null
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" aria-label={`Change ${name}'s role`} onClick={() => setEditing(member)} className={iconButton}>
          <PencilIcon className="size-4" />
        </button>
        <RowMenu
          label={`More for ${name}`}
          items={[
            ...(canRenameMember(actor, member) ? [{ label: "Edit name", onClick: () => setRenaming(member) }] : []),
            ...(member.role ? [{ label: "Remove access", onClick: () => setPendingRemove(member) }] : []),
            { label: "Delete account", danger: true, onClick: () => setPendingDelete(member) },
          ]}
        />
      </div>
    )
  }

  const userCell = (member) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        photo={photos.get(member.uid)}
        initials={initialsOf(member)}
        className="size-9 text-xs font-semibold"
        fallbackClassName="bg-accent-dark/15 text-accent-text"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-950">
          {staffDisplayName(member) || "Unnamed account"}
          {member.uid === actor.uid && <span className="font-normal text-ink-950/50"> (you)</span>}
        </p>
        {member.email && <p className="truncate text-xs text-ink-950/55">{member.email}</p>}
      </div>
    </div>
  )

  return (
    <div className="pb-6">
      <PageHeader title="Staff" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <span className="sr-only">Search staff</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-950/40" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search by name or email"
            className="w-full rounded-xl border border-ink-950/15 bg-white py-2 pr-3 pl-9 text-sm text-ink-950 outline-none placeholder:text-ink-950/40 focus:border-ink-950/40"
          />
        </label>
        <div className="w-44">
          <Select
            ariaLabel="Role"
            value={roleFilter}
            onChange={(value) => {
              setRoleFilter(value)
              setPage(1)
            }}
            options={roleOptions}
            triggerClassName="px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="cursor-pointer rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold whitespace-nowrap text-paper-50 transition-colors duration-200 hover:bg-brand-dark"
        >
          + Add user
        </button>
      </div>

      {notice && (
        <p role="status" className="mb-3 text-sm text-accent-text">
          {notice}
        </p>
      )}
      {rowError && (
        <p role="alert" className="mb-3 text-sm text-brand-dark">
          {rowError}
        </p>
      )}

      <section aria-label="Staff" className="rounded-2xl border border-ink-950/10 bg-white">
        {loadError ? (
          <p className="p-5 text-sm text-brand-dark">Couldn't load staff ({loadError}).</p>
        ) : !staff ? (
          <p className="p-5 text-sm text-ink-950/50">Loading…</p>
        ) : !filtered.length ? (
          <p className="p-8 text-center text-sm text-ink-950/55">{staff.length ? "No staff match your search." : "No staff yet."}</p>
        ) : (
          <>
            <table className="hidden w-full table-fixed text-left sm:table">
              <thead>
                <tr className="border-b border-ink-950/10 text-[11px] font-semibold tracking-wider text-ink-950/50 uppercase">
                  <th className="w-[34%] px-5 py-3 font-semibold">User</th>
                  <th className="px-3 py-3 font-semibold">Role</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Added</th>
                  <th className="px-3 py-3 font-semibold">Last sign in</th>
                  <th className="w-32 px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-950/5">
                {rows.map((member) => (
                  <tr key={member.uid}>
                    <td className="px-5 py-3">{userCell(member)}</td>
                    <td className="px-3 py-3">
                      <RoleBadge role={member.role} />
                    </td>
                    <td className="px-3 py-3">
                      <Status role={member.role} />
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-950/70">{asDate(member.addedAt) ? formatDay(member.addedAt) : "—"}</td>
                    <td className="px-3 py-3">
                      <LastSignIn value={member.lastSignInAt} />
                    </td>
                    <td className="px-5 py-3">{actionsFor(member)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-ink-950/5 sm:hidden">
              {rows.map((member) => (
                <li key={member.uid} className="space-y-2.5 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    {userCell(member)}
                    {actionsFor(member)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-12">
                    <RoleBadge role={member.role} />
                    <Status role={member.role} />
                    <LastSignIn value={member.lastSignInAt} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="px-5 pb-3">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                  try {
                    localStorage.setItem(PAGE_SIZE_KEY, String(size))
                  } catch {
                    /* private browsing / storage disabled */
                  }
                }}
                totalRecords={filtered.length}
              />
            </div>
          </>
        )}
      </section>

      {adding && (
        <AddStaffDialog
          actor={actor}
          onClose={() => setAdding(false)}
          onAdded={(member) => {
            setAdding(false)
            setStaff((current) => [...(current ?? []), member])
            const who = staffDisplayName(member)
            setNotice(
              member.inviteEmailFailed
                ? `${who} was added, but the email to set their password didn't send. Ask them to use "Forgot password?" on the sign-in page.`
                : `${who} was added. They'll get an email to set their password.`,
            )
          }}
        />
      )}
      {editing && (
        <EditRoleDialog
          member={editing}
          actor={actor}
          onClose={() => setEditing(null)}
          onSaved={(role) => {
            patchMember(editing.uid, { role })
            setEditing(null)
          }}
        />
      )}
      {renaming && (
        <EditNameDialog
          member={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(name) => {
            patchMember(renaming.uid, { name })
            setRenaming(null)
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title="Remove access?"
        description={
          pendingRemove
            ? `${staffDisplayName(pendingRemove)} won't be able to sign in to the admin. Their account and anything they signed are kept.`
            : ""
        }
        confirmLabel={saving ? "Saving…" : "Remove access"}
        confirmDisabled={saving}
        onConfirm={removeAccess}
        onCancel={() => setPendingRemove(null)}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this account?"
        description={
          pendingDelete
            ? `${staffDisplayName(pendingDelete)} is removed from Staff and can't open the admin. Notes they signed keep their name. Their sign-in itself can only be fully deleted in the Firebase console.`
            : ""
        }
        confirmLabel={saving ? "Deleting…" : "Delete"}
        confirmDisabled={saving}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        description="You'll need to sign in again to use the admin."
        confirmLabel="Sign out"
        onConfirm={() => {
          setConfirmSignOut(false)
          signOutAdmin().catch((cause) => console.error("Sign out failed:", cause.code ?? cause.message))
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  )
}
