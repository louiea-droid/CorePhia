import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import ConfirmDialog from "../ui/ConfirmDialog"
import { signOutAdmin } from "../lib/firebase"
import { ChevronLeftIcon, PersonIcon, SignOutIcon } from "../ui/icons"
import { ROLE_LABELS } from "../staff/roles"

const itemClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-950/75 transition-colors duration-150 hover:bg-ink-950/5 hover:text-ink-950 focus-visible:bg-ink-950/5 focus-visible:outline-none"

const nameFromEmail = (email = "") =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")

// Top-right account button: who is signed in, plus Profile (display name,
// password, two-step sign-in) and sign out. A disclosure (button + plain links), not an ARIA menu, so Tab
// moves through it the way it does everywhere else in the admin.
export default function AccountMenu({ user, role, displayName, onSignOut = signOutAdmin }) {
  const [open, setOpen] = useState(false)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  // The button shows a name, never the full email: with none set, the part
  // before the @ ("jordan.lee@…" → "Jordan Lee"). The email stays in the menu.
  const buttonName = displayName || (user ? nameFromEmail(user.email) : "Demo admin (preview)")
  const name = buttonName || user?.email
  const roleLabel = ROLE_LABELS[role] ?? "No role assigned"

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onFocusIn = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("focusin", onFocusIn)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("focusin", onFocusIn)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`Account: ${name}`}
        className="flex cursor-pointer items-center gap-2 rounded-full border border-ink-950/10 bg-white py-1 pr-2.5 pl-1 transition-colors duration-200 hover:bg-paper-100"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-paper-100 text-ink-950/70">
          <PersonIcon className="size-4" />
        </span>
        {buttonName && <span className="hidden max-w-44 truncate text-sm font-medium text-ink-950 sm:block">{buttonName}</span>}
        <ChevronLeftIcon
          className={`size-4 shrink-0 text-ink-950/50 transition-transform duration-200 ${open ? "rotate-90" : "-rotate-90"}`}
        />
      </button>

      <div
        id="account-menu"
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-2 w-64 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-ink-950/10"
      >
        <div className="border-b border-ink-950/10 px-3 pt-2 pb-3">
          <p className="truncate text-sm font-semibold text-ink-950">{name}</p>
          {user?.email && user.email !== name && <p className="truncate text-xs text-ink-950/55">{user.email}</p>}
          <p className={`mt-0.5 text-xs ${role ? "text-ink-950/55" : "text-brand-dark"}`}>{roleLabel}</p>
        </div>
        <div className="pt-1.5">
          <Link to="/admin/security" onClick={() => setOpen(false)} className={itemClass}>
            <PersonIcon className="size-4 shrink-0" />
            Profile
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setConfirmingSignOut(true)
            }}
            className={itemClass}
          >
            <SignOutIcon className="size-4 shrink-0" />
            Sign out
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out of CorePhia Admin?"
        description="You'll need to sign in again to view patient records."
        confirmLabel="Sign out"
        onConfirm={() => {
          setConfirmingSignOut(false)
          onSignOut()
        }}
        onCancel={() => setConfirmingSignOut(false)}
      />
    </div>
  )
}
