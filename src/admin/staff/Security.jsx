import { useId, useRef, useState } from "react"
import Avatar from "../ui/Avatar"
import ConfirmDialog from "../ui/ConfirmDialog"
import { photoFromFile, removeStaffPhoto, saveStaffPhoto, useStaffPhotos } from "../lib/staffPhotos"
import {
  completeTotpSignIn,
  finishTotpEnrollment,
  listEnrolledFactors,
  reauthenticateAdmin,
  reloadAdminUser,
  removeEnrolledFactor,
  startTotpEnrollment,
  updateAdminDisplayName,
  updateAdminPassword,
} from "../lib/firebase"
import { EyeIcon, EyeOffIcon, PencilIcon } from "../ui/icons"
import { inputClass, labelClass } from "../patients/noteUi"
import PageHeader from "../layout/PageHeader"
import { ROLE_LABELS } from "./roles"

const primaryButton =
  "cursor-pointer rounded-lg bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
const quietButton =
  "cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium text-ink-950/65 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
const errorBox = "rounded-lg border border-brand-dark/30 bg-paper-50 px-3 py-2 text-sm text-ink-950"
const MIN_PASSWORD = 8

// Authenticator apps take the key in groups of four; unbroken it's a wall of
// characters to copy by eye.
function groupSecret(secretKey) {
  return (secretKey.match(/.{1,4}/g) ?? [secretKey]).join(" ")
}

// "Dr. Daniel Antonious" → "DA"; an email falls back to its first letter.
function initials(name) {
  const words = name.split(/[\s@.]+/).filter((word) => /^[a-z]/i.test(word))
  const picked = name.includes("@") ? words.slice(0, 1) : [words[0], words.length > 1 ? words.at(-1) : null]
  return picked.filter(Boolean).map((word) => word[0].toUpperCase()).join("") || "?"
}

function describeError(cause) {
  switch (cause?.code) {
    case "auth/operation-not-allowed":
    case "auth/unsupported-first-factor":
      return "Two-step sign-in isn't switched on for this project yet. It needs Identity Platform with TOTP enabled in the Firebase console."
    case "auth/requires-recent-login":
      return "For this change you need a fresh sign-in. Sign out, sign back in, and try again."
    case "auth/invalid-verification-code":
      return "That code wasn't accepted. Codes expire quickly, so try the current one."
    default:
      return cause?.message ?? "Something went wrong. Try again."
  }
}

function passwordError(cause) {
  switch (cause?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Your current password is incorrect."
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "That password is too weak. Use a longer one."
    case "auth/too-many-requests":
      return "Too many tries. Wait a few minutes and try again."
    default:
      return describeError(cause)
  }
}

// One settings row: what it is on the left, the controls on the right.
function SettingRow({ title, description, badge, children }) {
  return (
    <section className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-10">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-950">{title}</h2>
          {badge}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-950/60">{description}</p>
      </div>
      <div className="min-w-0 max-w-md">{children}</div>
    </section>
  )
}

// The <label> holds only the name: wrapping the eye button and hint too would
// make a screen reader read "New password Show new password At least…".
function PasswordInput({ label, hint, ...props }) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <span className="relative block">
        <input
          {...props}
          id={id}
          aria-describedby={hint ? `${id}-hint` : undefined}
          type={visible ? "text" : "password"}
          className={`${inputClass} pr-10 disabled:opacity-60`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md p-1 text-ink-950/45 transition-colors duration-200 hover:text-ink-950"
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </span>
      {hint && (
        <span id={`${id}-hint`} className="mt-1 block text-xs text-ink-950/50">
          {hint}
        </span>
      )}
    </div>
  )
}

function DisplayNameRow({ email, displayName, onDisplayNameChange }) {
  const [value, setValue] = useState(displayName ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const unchanged = value.trim() === (displayName ?? "")

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const next = await updateAdminDisplayName(value)
      setValue(next ?? "")
      onDisplayNameChange?.(next)
      setSaved(true)
    } catch (cause) {
      console.error("Could not save display name:", cause.code ?? cause.message)
      setError(describeError(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingRow title="Display name" description="Shown in the account menu. Leave it empty to show your email instead.">
      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-40">
          <span className={labelClass}>Name</span>
          <input
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setSaved(false)
            }}
            placeholder="e.g. Dr. Antonious"
            maxLength={80}
            autoComplete="name"
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={busy || unchanged} className={primaryButton}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
      {saved && !error && (
        <p role="status" className="mt-2 text-sm text-accent-text">
          Saved.
        </p>
      )}
      {error && (
        <p role="alert" className={`mt-3 ${errorBox}`}>
          {error}
        </p>
      )}
      {!value && email && <p className="mt-2 text-xs text-ink-950/50">Showing {email} for now.</p>}
    </SettingRow>
  )
}

function PasswordRow({ email }) {
  const [fields, setFields] = useState({ current: "", next: "", confirm: "", code: "" })
  const [resolver, setResolver] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const set = (key) => (event) => {
    setFields((current) => ({ ...current, [key]: event.target.value }))
    setSaved(false)
  }

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (fields.next.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`)
    if (fields.next !== fields.confirm) return setError("The new passwords don't match.")
    if (fields.next === fields.current) return setError("Choose a password different from your current one.")
    setBusy(true)
    try {
      if (resolver) await completeTotpSignIn(resolver, fields.code.trim(), { signIn: false })
      else {
        const needsCode = await reauthenticateAdmin(fields.current)
        if (needsCode) {
          setResolver(needsCode)
          return
        }
      }
      await updateAdminPassword(fields.next)
      setFields({ current: "", next: "", confirm: "", code: "" })
      setResolver(null)
      setSaved(true)
    } catch (cause) {
      console.error("Could not change password:", cause.code ?? cause.message)
      setError(passwordError(cause))
    } finally {
      setBusy(false)
    }
  }

  const mismatch = fields.confirm && fields.confirm !== fields.next
  return (
    <SettingRow title="Password" description="You stay signed in here after changing it.">
      <form onSubmit={submit} className="space-y-3">
        {/* Lets password managers file the new password under this account. */}
        <input type="email" autoComplete="username" value={email ?? ""} readOnly hidden />
        <PasswordInput
          label="Current password"
          required
          autoComplete="current-password"
          value={fields.current}
          onChange={set("current")}
          disabled={Boolean(resolver)}
        />
        <PasswordInput
          label="New password"
          hint={`At least ${MIN_PASSWORD} characters.`}
          required
          autoComplete="new-password"
          value={fields.next}
          onChange={set("next")}
          disabled={Boolean(resolver)}
        />
        <PasswordInput
          label="Confirm new password"
          hint={mismatch ? "Doesn't match yet." : null}
          required
          autoComplete="new-password"
          value={fields.confirm}
          onChange={set("confirm")}
          disabled={Boolean(resolver)}
        />
        {resolver && (
          <label className="block">
            <span className={labelClass}>6-digit code from your authenticator app</span>
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={fields.code}
              onChange={set("code")}
              className={`${inputClass} max-w-40 tracking-[0.3em]`}
            />
          </label>
        )}

        {error && (
          <p role="alert" className={errorBox}>
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-accent-text">
            Password changed.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? "Changing…" : resolver ? "Confirm and change" : "Change password"}
          </button>
          {resolver && (
            <button
              type="button"
              onClick={() => {
                setResolver(null)
                setError(null)
                setFields((current) => ({ ...current, code: "" }))
              }}
              className={quietButton}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </SettingRow>
  )
}

function TwoStepRow({ user }) {
  const [factors, setFactors] = useState(() => listEnrolledFactors(user))
  const [secret, setSecret] = useState(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [justEnrolled, setJustEnrolled] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState(null)

  const refreshFactors = async () => {
    const refreshed = await reloadAdminUser()
    setFactors(listEnrolledFactors(refreshed))
  }

  const beginEnrollment = async () => {
    setBusy(true)
    setError(null)
    setJustEnrolled(false)
    try {
      setSecret(await startTotpEnrollment())
    } catch (cause) {
      console.error("Could not start enrolment:", cause.code ?? cause.message)
      setError(describeError(cause))
    } finally {
      setBusy(false)
    }
  }

  const confirmEnrollment = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await finishTotpEnrollment(secret, code.trim())
      await refreshFactors()
      setSecret(null)
      setCode("")
      setJustEnrolled(true)
    } catch (cause) {
      console.error("Could not complete enrolment:", cause.code ?? cause.message)
      setError(describeError(cause))
    } finally {
      setBusy(false)
    }
  }

  const confirmRemoval = async () => {
    setBusy(true)
    setError(null)
    try {
      await removeEnrolledFactor(pendingRemoval.uid)
      await refreshFactors()
    } catch (cause) {
      console.error("Could not remove the second factor:", cause.code ?? cause.message)
      setError(describeError(cause))
    } finally {
      setPendingRemoval(null)
      setBusy(false)
    }
  }

  return (
    <SettingRow
      title="Two-step sign-in"
      description="This account can open patient records, so a password alone is thin protection. With a code from an authenticator app, a stolen password isn't enough."
      badge={
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            factors.length ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/60"
          }`}
        >
          {factors.length ? "On" : "Off"}
        </span>
      }
    >
      {justEnrolled && (
        <p role="status" className="mb-3 text-sm text-accent-text">
          Two-step sign-in is on. You'll be asked for a code next time you sign in.
        </p>
      )}
      {error && (
        <p role="alert" className={`mb-3 ${errorBox}`}>
          {error}
        </p>
      )}

      {factors.length > 0 && (
        <ul className="mb-3 divide-y divide-ink-950/5 rounded-lg border border-ink-950/10">
          {factors.map((factor) => (
            <li key={factor.uid} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-950">{factor.displayName || "Authenticator app"}</span>
                {factor.enrollmentTime && (
                  <span className="block text-xs text-ink-950/50">
                    Added {new Date(factor.enrollmentTime).toLocaleDateString("en-US")}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setPendingRemoval(factor)}
                className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-brand-dark/10 hover:text-brand-dark"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {!secret && (
        <button type="button" onClick={beginEnrollment} disabled={busy} className={primaryButton}>
          {busy ? "Working…" : factors.length ? "Add another authenticator" : "Set up two-step sign-in"}
        </button>
      )}

      {secret && (
        <form onSubmit={confirmEnrollment} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-ink-950">1. Add this key to your authenticator app</p>
            <p className="mt-0.5 text-sm text-ink-950/60">
              In Google Authenticator, 1Password or similar, add an account by entering a setup key.
            </p>
            <p className="mt-2 rounded-lg bg-paper-100 px-3 py-2 font-mono text-sm tracking-wide break-all text-ink-950">
              {groupSecret(secret.secretKey)}
            </p>
            <a
              href={secret.generateQrCodeUrl(user?.email ?? "CorePhia Admin", "CorePhia")}
              className="mt-1.5 inline-block text-sm font-medium text-accent-text transition-opacity duration-200 hover:opacity-70"
            >
              Or open it directly in your authenticator app
            </a>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-950">2. Enter the 6-digit code it shows</span>
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={`${inputClass} max-w-40 tracking-[0.3em]`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? "Checking…" : "Turn on two-step sign-in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSecret(null)
                setCode("")
                setError(null)
              }}
              className={quietButton}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Remove two-step sign-in?"
        description="This account will be protected by its password alone. You can set it up again at any time."
        confirmLabel={busy ? "Removing…" : "Remove"}
        confirmDisabled={busy}
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </SettingRow>
  )
}

// The photo in the Profile header: click it (or its pencil badge) to choose a
// new one; it's shrunk and cropped in the browser before saving (staffPhotos.js).
function ProfilePhoto({ uid, name, onError }) {
  const photo = useStaffPhotos().get(uid)
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const run = async (work) => {
    setBusy(true)
    onError(null)
    try {
      await work()
    } catch (cause) {
      console.error("Profile photo:", cause.code ?? cause.message)
      onError(cause.code === "permission-denied" ? "Couldn't save the photo. Your account can't change it right now." : cause.message)
    } finally {
      setBusy(false)
    }
  }

  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = "" // so choosing the same file again still fires
    if (file) run(async () => saveStaffPhoto(uid, await photoFromFile(file)))
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        aria-label={photo ? "Change profile photo" : "Add a profile photo"}
        className="group relative size-14 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent-dark focus-visible:ring-offset-2 disabled:cursor-wait"
      >
        <Avatar photo={photo} initials={initials(name)} className="size-14 font-serif text-xl" fallbackClassName="bg-accent-dark text-oncolor" />
        {/* Hover is colour, never movement: the overlay fades in, nothing shifts. */}
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-[11px] font-semibold text-white transition-opacity duration-200 ${
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
        >
          {busy ? "Saving…" : photo ? "Change" : "Add"}
        </span>
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-ink-950 text-paper-50"
        >
          <PencilIcon className="size-2.5" />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} className="sr-only" onChange={pick} />
      {photo && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => removeStaffPhoto(uid))}
          className="cursor-pointer text-xs text-ink-950/55 transition-colors duration-200 hover:text-brand-dark"
        >
          Remove photo
        </button>
      )}
    </div>
  )
}

// The signed-in person's own page ("Profile" in the account menu).
export default function Security({ user, uid, role, displayName, onDisplayNameChange }) {
  const name = displayName || user?.email || "Demo admin (preview)"
  const [photoError, setPhotoError] = useState(null)
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Profile" />

      <div className="mx-auto w-full max-w-4xl space-y-4 pb-6">
        <section className="flex items-center gap-4 rounded-2xl border border-ink-950/10 bg-white p-5 sm:p-6">
          <ProfilePhoto uid={uid} name={name} onError={setPhotoError} />
          <div className="min-w-0">
            <p className="font-serif text-xl break-words text-ink-950 sm:text-2xl">{name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-950/60">
              {user?.email && user.email !== name && <span className="truncate">{user.email}</span>}
              <span className="rounded-full bg-paper-100 px-2 py-0.5 text-xs font-medium text-ink-950/70">
                {ROLE_LABELS[role] ?? "No role assigned"}
              </span>
            </p>
            {photoError && (
              <p role="alert" className="mt-2 text-sm text-brand-dark">
                {photoError}
              </p>
            )}
          </div>
        </section>

        <div className="divide-y divide-ink-950/10 rounded-2xl border border-ink-950/10 bg-white">
          <DisplayNameRow email={user?.email} displayName={displayName} onDisplayNameChange={onDisplayNameChange} />
          <PasswordRow email={user?.email} />
          <TwoStepRow user={user} />
        </div>
      </div>
    </div>
  )
}
