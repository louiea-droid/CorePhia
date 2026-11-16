import { useDeferredValue, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PURPOSES, PURPOSE_LABELS, renderTemplate } from "../../../functions/emailRender.js"
import Select from "../../components/Select"
import PageHeader from "../layout/PageHeader"
import { canEditTemplates } from "../staff/roles"
import ConfirmDialog from "../ui/ConfirmDialog"
import { inputClass, labelClass } from "../ui/formUi"
import {
  CheckIcon,
  DesktopIcon,
  HistoryIcon,
  MoreIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  ShieldIcon,
  TemplateIcon,
} from "../ui/icons"
import EmailFrame from "./EmailFrame"
import MessageEditor from "./MessageEditor"
import TemplateHistory from "./TemplateHistory"
import { groupByPurpose, validateTemplate } from "./templateMath"
import { deleteTemplate, saveTemplate, seedDefaultsIfEmpty, sendPatientEmail, watchTemplates } from "./templateStore"

// The editor hands back the body with its own key order and attributes, so the
// bodies are compared by what the patient would get, not by their JSON.
const FIELDS = ["name", "purpose", "status", "isDefault", "subject", "headline"]
const sameFields = (a, b) =>
  Boolean(a && b) && FIELDS.every((k) => a[k] === b[k]) && renderTemplate(a).html === renderTemplate(b).html
const blankTemplate = (purpose) => ({
  name: "",
  purpose,
  status: "draft",
  isDefault: false,
  subject: "",
  headline: "Hi {firstName}",
  body: { type: "doc", content: [{ type: "paragraph" }] },
})

const PURPOSE_OPTIONS = PURPOSES.map((p) => ({ value: p, label: PURPOSE_LABELS[p] }))
const STATUS_LABELS = { draft: "Draft", published: "Published", default: "Published, default" }

const statusKey = (t) => (t.status !== "published" ? "draft" : t.isDefault ? "default" : "published")
const STATUS_DOT = { default: "bg-green-600", published: "bg-ink-950/25", draft: "bg-amber-500" }
const STATUS_TEXT = { default: "Default", published: "Published", draft: "Draft, never sent" }

const button =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
const primary = `${button} bg-accent-dark text-oncolor hover:bg-brand-dark`
const secondary = `${button} border border-ink-950/15 bg-white text-ink-950 hover:bg-ink-950/5`
const quiet = `${button} text-ink-950/70 hover:bg-ink-950/5 hover:text-ink-950`

// Every email patients get. The admin and super admin edit; the other admitters read.
export default function EmailTemplates({ role, actorName }) {
  const editable = canEditTemplates(role)
  const navigate = useNavigate()
  const [templates, setTemplates] = useState(null)
  const [loadError, setLoadError] = useState(null)
  // id: the open template (null for a new one); draft: unsaved edits, or null.
  const [sel, setSel] = useState({ id: null, draft: null })
  const [search, setSearch] = useState("")
  const [confirm, setConfirm] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => watchTemplates(setTemplates, (e) => setLoadError(e.message)), [])
  useEffect(() => {
    if (!editable) return
    seedDefaultsIfEmpty(actorName).catch((e) => setLoadError(e.message))
  }, [editable, actorName])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const groups = groupByPurpose(templates ?? [])
  const first = PURPOSES.map((p) => groups[p][0]).find(Boolean)
  const isNew = Boolean(sel.draft) && !sel.id
  const saved = isNew ? undefined : (templates?.find((t) => t.id === sel.id) ?? first)
  const current = sel.draft ?? saved
  const dirty = Boolean(sel.draft) && !sameFields(sel.draft, saved)
  const reason = current && editable ? validateTemplate(current) : null
  // The saved default stays the default until another template takes over.
  const lockedDefault = Boolean(saved?.isDefault)

  // Runs `action` now, or after "Discard your changes?" when there are edits.
  const guard = (action) => {
    setNotice(null)
    if (!dirty) return action()
    setConfirm({ kind: "discard", then: action })
  }
  const latestGuard = useRef(guard)
  useEffect(() => {
    latestGuard.current = guard
  })

  // Leaving the page with unsaved edits: the tab closing, or a link anywhere
  // in the admin (the app uses BrowserRouter, which has no navigation blocker).
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event) => event.preventDefault()
    const onClick = (event) => {
      const link = event.target.closest?.("a[href]")
      if (!link || link.target === "_blank" || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
      const url = new URL(link.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      event.preventDefault()
      event.stopPropagation()
      latestGuard.current(() => navigate(url.pathname + url.search + url.hash))
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty, navigate])

  // The first edit pins the open template (the list may be showing the fallback first one).
  const edit = (patch) => setSel((s) => ({ id: s.draft ? s.id : (saved?.id ?? null), draft: { ...(s.draft ?? current), ...patch } }))
  // Stacked (phone width): bring the editor into view, it sits below the list.
  const showEditor = () => {
    if (!window.matchMedia("(min-width: 48rem)").matches)
      requestAnimationFrame(() => document.getElementById("template-editor")?.scrollIntoView({ block: "start" }))
  }
  const open = (id) =>
    guard(() => {
      setSel({ id, draft: null })
      showEditor()
    })
  const startNew = (purpose) =>
    guard(() => {
      setSel({ id: null, draft: blankTemplate(purpose) })
      showEditor()
    })
  const duplicate = () =>
    guard(() =>
      setSel({ id: null, draft: { ...saved, name: `Copy of ${saved.name}`, status: "draft", isDefault: false } }),
    )

  const save = async () => {
    setSaving(true)
    setNotice(null)
    try {
      const id = await saveTemplate(sel.id, current, actorName)
      setSel({ id, draft: null })
      setToast("Saved")
    } catch (e) {
      setNotice(`Couldn't save (${e.message}).`)
    } finally {
      setSaving(false)
    }
  }

  const askDelete = () => {
    if (saved.isDefault) return setNotice("Make another template the default first.")
    setConfirm({ kind: "delete" })
  }

  const runConfirm = async () => {
    const { kind, then } = confirm
    if (kind === "discard") {
      setSel((s) => ({ ...s, draft: null }))
      setConfirm(null)
      then?.()
      return
    }
    setConfirm({ ...confirm, busy: true })
    try {
      await deleteTemplate(saved.id)
      setSel({ id: null, draft: null })
      setToast(`Deleted ${saved.name}`)
    } catch (e) {
      setNotice(`Couldn't delete (${e.message}).`)
    }
    setConfirm(null)
  }

  const sendTest = async () => {
    setNotice(null)
    try {
      const { to } = await sendPatientEmail({ mode: "test", templateId: saved.id })
      setToast(`Test sent to ${to}`)
    } catch (e) {
      setNotice(`Couldn't send the test (${e.message}).`)
    }
  }

  // The saved default stays published and default until another template takes over.
  const statusOptions = (lockedDefault ? ["default"] : current?.purpose === "manual" ? ["draft", "published"] : ["draft", "published", "default"]).map(
    (value) => ({ value, label: STATUS_LABELS[value] }),
  )
  const setStatus = (value) =>
    edit(lockedDefault ? { status: value === "draft" ? "draft" : "published" } : { status: value === "draft" ? "draft" : "published", isDefault: value === "default" })

  const needle = search.trim().toLowerCase()
  const shown = (t) => !needle || t.name.toLowerCase().includes(needle) || t.subject?.toLowerCase().includes(needle)
  const selectedId = isNew ? null : saved?.id

  return (
    <div className="pb-6">
      <PageHeader title="Email templates" />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-950/60">
          Every email patients get from CorePhia. Changes apply to the next email sent.
        </p>
        {editable && (
          <button type="button" onClick={() => startNew(current?.purpose ?? "declined")} className={primary}>
            <PlusIcon className="size-4" />
            New template
          </button>
        )}
      </div>
      {!editable && <p className="mb-3 text-sm text-ink-950/70">Only the admin and super admin can change these emails.</p>}
      {notice && (
        <p role="alert" className="mb-3 text-sm text-red-700 [.dark_&]:text-red-400">
          {notice}
        </p>
      )}

      {loadError ? (
        <p className="rounded-2xl border border-ink-950/10 bg-white p-5 text-sm text-red-700 [.dark_&]:text-red-400">
          Couldn't load the templates ({loadError}).
        </p>
      ) : !templates ? (
        <p className="rounded-2xl border border-ink-950/10 bg-white p-5 text-sm text-ink-950/50">Loading…</p>
      ) : (
        <div className="grid rounded-2xl border border-ink-950/10 bg-white md:grid-cols-[16rem_minmax(0,1fr)]">
          {/* List */}
          <nav
            aria-label="Templates"
            className="rounded-t-2xl border-b border-ink-950/10 bg-paper-50/60 pb-3 md:rounded-l-2xl md:rounded-tr-none md:border-r md:border-b-0"
          >
            <label className="relative m-3 block">
              <span className="sr-only">Search templates</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-950/40" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search templates"
                className="w-full rounded-xl border border-ink-950/15 bg-white py-2 pr-3 pl-9 text-sm text-ink-950 outline-none placeholder:text-ink-950/40 focus:border-ink-950/40"
              />
            </label>
            {PURPOSES.map((purpose) => {
              const items = groups[purpose].filter(shown)
              if (needle && !items.length) return null
              const label = PURPOSE_LABELS[purpose]
              return (
                <div key={purpose} className="px-3 pt-1">
                  <h2 className="mx-1 mt-2 mb-1.5 flex justify-between text-xs font-semibold text-ink-950/60">
                    {label} <span className="font-medium">{groups[purpose].length}</span>
                  </h2>
                  {items.length ? (
                    <ul className="space-y-0.5">
                      {items.map((t) => {
                        const on = t.id === selectedId
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              aria-current={on ? "true" : undefined}
                              onClick={() => open(t.id)}
                              className={`relative block w-full cursor-pointer rounded-xl px-3 py-2 text-left transition-colors duration-200 ${
                                on ? "bg-accent/15" : "hover:bg-ink-950/5"
                              }`}
                            >
                              {on && <span aria-hidden="true" className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-accent-dark" />}
                              <span className="block truncate text-sm font-semibold text-ink-950">{t.name}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-950/60">
                                <span aria-hidden="true" className={`size-1.5 rounded-full ${STATUS_DOT[statusKey(t)]}`} />
                                {STATUS_TEXT[statusKey(t)]}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <div className="rounded-xl border border-dashed border-ink-950/15 px-3 py-3 text-center">
                      <p className="text-sm font-medium text-ink-950">No templates for {label} yet</p>
                      <p className="mt-0.5 text-xs text-ink-950/60">
                        {purpose === "welcome"
                          ? "Until there is one, the built-in wording is sent."
                          : `Nothing can be sent for ${label} until one is published.`}
                      </p>
                      {editable && (
                        <button type="button" onClick={() => startNew(purpose)} className={`${quiet} mt-1.5 px-2 py-1 text-xs`}>
                          <PlusIcon className="size-3.5" />
                          New template
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {needle && !templates.some(shown) && <p className="px-4 py-2 text-sm text-ink-950/60">No templates match your search.</p>}
          </nav>

          {current ? (
            <div className="grid min-w-0 min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
              <Editor
                current={current}
                saved={saved}
                editable={editable}
                dirty={dirty}
                reason={reason}
                saving={saving}
                lockedDefault={lockedDefault}
                statusOptions={statusOptions}
                onEdit={edit}
                onStatus={setStatus}
                onHistory={() => setHistoryOpen(true)}
                onDuplicate={duplicate}
                onDelete={askDelete}
                onDiscard={() => setConfirm({ kind: "discard", then: isNew ? () => setSel({ id: null, draft: null }) : null })}
                onSave={save}
              />
              <Preview template={current} canTest={editable} testDisabled={!saved || dirty} onTest={sendTest} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <TemplateIcon className="size-7 text-ink-950/50" />
              <p className="mt-2 font-semibold text-ink-950">No templates yet</p>
            </div>
          )}
        </div>
      )}

      {historyOpen && saved && (
        <TemplateHistory
          template={saved}
          editable={editable}
          actorName={actorName}
          hasUnsavedChanges={dirty}
          onClose={() => setHistoryOpen(false)}
          onRestored={() => {
            setSel({ id: saved.id, draft: null })
            setToast("Version restored")
          }}
        />
      )}

      <ConfirmDialog
        open={confirm?.kind === "discard"}
        title={`Discard your changes to ${(saved ?? current)?.name?.trim() || "this template"}?`}
        description="What you changed since the last save will be lost."
        confirmLabel="Discard"
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title={`Delete ${saved?.name}?`}
        description="It can't be sent again, and this can't be undone."
        confirmLabel={confirm?.busy ? "Deleting…" : "Delete"}
        confirmDisabled={Boolean(confirm?.busy)}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />

      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50">
        {toast && (
          <p className="flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-medium text-paper-50 shadow-xl">
            <CheckIcon className="size-4" />
            {toast}
          </p>
        )}
      </div>
    </div>
  )
}

function Editor({
  current,
  saved,
  editable,
  dirty,
  reason,
  saving,
  lockedDefault,
  statusOptions,
  onEdit,
  onStatus,
  onHistory,
  onDuplicate,
  onDelete,
  onDiscard,
  onSave,
}) {
  return (
    <section id="template-editor" aria-label="Template" className="@container scroll-mt-16 flex min-w-0 flex-col px-4 pt-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 basis-full flex-wrap items-center gap-2 @lg:basis-0 @lg:flex-1">
          <input
            aria-label="Template name"
            value={current.name}
            onChange={(event) => onEdit({ name: event.target.value })}
            disabled={!editable}
            maxLength={80}
            placeholder="Template name"
            className="-ml-2 w-full min-w-0 rounded-lg @lg:w-auto @lg:flex-1 border border-dashed border-transparent bg-transparent px-2 py-1 font-serif text-2xl text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-950/35 hover:border-ink-950/15 focus:border-ink-950/40 disabled:hover:border-transparent"
          />
          {saved?.isDefault && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 [.dark_&]:bg-green-950 [.dark_&]:text-green-300">
              <CheckIcon className="size-3.5" />
              Default for {PURPOSE_LABELS[saved.purpose]}
            </span>
          )}
        </div>
        {saved && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={onHistory} className={quiet}>
              <HistoryIcon className="size-4" />
              History
            </button>
            {editable && (
              <MoreMenu
                items={[
                  { label: "Duplicate", onClick: onDuplicate },
                  { label: "Delete", onClick: onDelete, danger: true },
                ]}
              />
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className={labelClass}>Used for</span>
          <Select
            ariaLabel="Used for"
            value={current.purpose}
            options={PURPOSE_OPTIONS}
            disabled={!editable || lockedDefault}
            onChange={(purpose) => onEdit(purpose === "manual" ? { purpose, isDefault: false } : { purpose })}
            triggerClassName="rounded-lg! px-3 py-2 text-sm"
          />
        </div>
        <div>
          <span className={labelClass}>Status</span>
          <Select
            ariaLabel="Status"
            value={statusKey(current)}
            options={statusOptions}
            disabled={!editable}
            onChange={onStatus}
            triggerClassName="rounded-lg! px-3 py-2 text-sm"
          />
        </div>
      </div>
      {editable && lockedDefault && (
        <p className="mt-1.5 text-xs text-ink-950/60">
          This is the default for {PURPOSE_LABELS[saved.purpose]}. To move it, make another template the default first.
        </p>
      )}

      <label className="mt-3.5 block">
        <span className={labelClass}>Subject line</span>
        <input
          value={current.subject}
          onChange={(event) => onEdit({ subject: event.target.value })}
          disabled={!editable}
          maxLength={200}
          className={inputClass}
        />
      </label>
      <label className="mt-3.5 block">
        <span className={labelClass}>Headline</span>
        <input
          value={current.headline}
          onChange={(event) => onEdit({ headline: event.target.value })}
          disabled={!editable}
          maxLength={200}
          className={inputClass}
        />
      </label>
      <p className="mt-1 text-xs text-ink-950/60">{"{firstName}"} in the subject or headline becomes the patient's first name.</p>

      <span className={`${labelClass} mt-3.5`}>Message</span>
      <MessageEditor value={current.body} onChange={(body) => onEdit({ body })} readOnly={!editable} />
      <p className="mt-2 text-xs text-ink-950/60">
        The contact line, the privacy note and the CorePhia footer are added to every email automatically.
      </p>
      <p className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 [.dark_&]:border-amber-900 [.dark_&]:bg-amber-950 [.dark_&]:text-amber-200">
        <ShieldIcon className="mt-0.5 size-4 shrink-0 text-amber-700 [.dark_&]:text-amber-300" />
        Keep it general. No health details, and medication only ever as part of the program.
      </p>

      {editable ? (
        <div className={`${dirty ? "sticky" : ""} bottom-0 -mx-4 mt-5 border-t border-ink-950/10 bg-white/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6`}>
          {reason && (
            <p role="alert" className="mb-2 text-sm text-red-700 [.dark_&]:text-red-400">
              {reason}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-ink-950/70">
              {dirty ? (
                <>
                  <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
                  Unsaved changes
                </>
              ) : (
                "All changes saved"
              )}
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={onDiscard} disabled={!dirty || saving} className={secondary}>
                Discard
              </button>
              <button type="button" onClick={onSave} disabled={!dirty || Boolean(reason) || saving} className={primary}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </span>
          </div>
        </div>
      ) : (
        <div className="h-5" />
      )}
    </section>
  )
}

// The ⋯ menu (Duplicate, Delete), closed by a click outside or Escape.
function MoreMenu({ items }) {
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
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`${quiet} px-2.5`}
      >
        <MoreIcon className="size-5" />
      </button>
      {open && (
        <div role="menu" className="animate-pop-in absolute top-full right-0 z-20 mt-1.5 w-40 rounded-xl bg-white p-1 shadow-xl ring-1 ring-ink-950/10">
          {items.map((item) => (
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
          ))}
        </div>
      )}
    </div>
  )
}

// What Jane sees. The email's HTML renders in a sandboxed frame, so its inline
// styles stay out of the admin and nothing in it can run.
function Preview({ template, canTest, testDisabled, onTest }) {
  const [phone, setPhone] = useState(false)
  const [sending, setSending] = useState(false)
  const deferred = useDeferredValue(template)
  const { subject, html } = renderTemplate(deferred, { firstName: "Jane" })
  const seg = (on) =>
    `inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
      on ? "bg-ink-950 text-paper-50" : "text-ink-950/70 hover:text-ink-950"
    }`
  return (
    <aside
      aria-label="Preview"
      className="min-w-0 rounded-b-2xl border-t border-ink-950/10 bg-paper-100 p-4 md:rounded-bl-none min-[1440px]:rounded-tr-2xl min-[1440px]:border-t-0 min-[1440px]:border-l"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-950">Preview</p>
        <div role="group" aria-label="Preview size" className="inline-flex rounded-xl border border-ink-950/10 bg-white p-0.5">
          <button type="button" aria-pressed={!phone} onClick={() => setPhone(false)} className={seg(!phone)}>
            <DesktopIcon className="size-4" />
            Desktop
          </button>
          <button type="button" aria-pressed={phone} onClick={() => setPhone(true)} className={seg(phone)}>
            <PhoneIcon className="size-4" />
            Phone
          </button>
        </div>
      </div>
      <div className={`mx-auto overflow-hidden rounded-xl border border-ink-950/10 bg-white ${phone ? "max-w-[375px]" : ""}`}>
        <div className="border-b border-ink-950/10 px-3.5 py-3 text-sm">
          <p className="font-semibold break-words text-ink-950">{subject || "(no subject)"}</p>
          <p className="text-xs break-all text-ink-950/60">CorePhia &lt;info@corephia.com&gt; to jane.doe@example.com</p>
        </div>
        <EmailFrame key={phone ? "phone" : "desktop"} html={html} />
      </div>
      {canTest && (
        <div className="mt-3 flex flex-col items-center gap-1">
          <button
            type="button"
            disabled={testDisabled || sending}
            onClick={async () => {
              setSending(true)
              await onTest()
              setSending(false)
            }}
            className={secondary}
          >
            <SendIcon className="size-4" />
            {sending ? "Sending…" : "Send me a test"}
          </button>
          {testDisabled && <p className="text-xs text-ink-950/60">Save first. The test sends the saved version.</p>}
        </div>
      )}
    </aside>
  )
}
