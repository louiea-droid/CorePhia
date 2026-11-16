import { Fragment, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { plainText } from "../../../functions/emailRender.js"
import ConfirmDialog from "../ui/ConfirmDialog"
import { CloseIcon } from "../ui/icons"
import { formatStamp } from "../ui/formUi"
import { getAdminPortalRoot } from "../ui/portalRoot"
import { useDialog } from "../ui/useDialog"
import { diffWords } from "./templateMath"
import { loadVersions, restoreVersion } from "./templateStore"

const smallButton =
  "cursor-pointer rounded-lg border border-ink-950/15 px-2.5 py-1 text-xs font-medium text-ink-950 transition-colors duration-200 hover:bg-ink-950/5"

// Slides in from the right: every saved version of one template, newest first.
// Compare shows the old message against the live one; Restore saves the old
// wording as a new version, so nothing is lost.
export default function TemplateHistory({ template, editable, actorName, hasUnsavedChanges, onClose, onRestored }) {
  const [versions, setVersions] = useState(null)
  const [error, setError] = useState(null)
  const [comparing, setComparing] = useState(null)
  const [restoring, setRestoring] = useState(null)
  const [busy, setBusy] = useState(false)
  const closeRef = useRef(null)
  useDialog({ onClose, focusRef: closeRef })

  useEffect(() => {
    let live = true
    loadVersions(template.id)
      .then((list) => live && setVersions(list))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [template.id, template.updatedAt])

  const restore = async () => {
    setBusy(true)
    try {
      await restoreVersion(template.id, restoring, actorName, template)
      setRestoring(null)
      setComparing(null)
      onRestored()
    } catch (e) {
      setError(e.message)
      setRestoring(null)
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-40" role="presentation">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-scrim/40" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`History of ${template.name}`}
        className="absolute transition-transform duration-300 ease-out-smooth starting:translate-x-full motion-reduce:transition-none inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-ink-950/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink-950">History</p>
            <p className="truncate text-xs text-ink-950/60">{template.name}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="cursor-pointer rounded-lg p-2 text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
          >
            <CloseIcon className="size-5" />
          </button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {error && (
            <p role="alert" className="p-4 text-sm text-red-700 [.dark_&]:text-red-400">
              Couldn't load the history ({error}).
            </p>
          )}
          {!versions && !error && <p className="p-4 text-sm text-ink-950/50">Loading…</p>}
          {versions && !versions.length && <p className="p-4 text-sm text-ink-950/60">No saved versions yet.</p>}
          <ol>
            {versions?.map((version, index) => {
              const live = index === 0
              return (
                <li key={version.id} className="grid grid-cols-[0.875rem_1fr] gap-3 border-b border-ink-950/10 px-4 py-3.5">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 rounded-full ${live ? "bg-green-600 ring-4 ring-green-600/20" : "bg-ink-950/25"}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-950">{live ? "Live version" : formatStamp(version.updatedAt)}</p>
                    <p className="mt-0.5 text-xs text-ink-950/60">
                      {version.updatedBy || "Unknown"}
                      {live && ` on ${formatStamp(version.updatedAt)}`}
                    </p>
                    {!live && (
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          aria-expanded={comparing === version.id}
                          onClick={() => setComparing((id) => (id === version.id ? null : version.id))}
                          className={smallButton}
                        >
                          Compare
                        </button>
                        {editable && (
                          <button type="button" onClick={() => setRestoring(version)} className={smallButton}>
                            Restore
                          </button>
                        )}
                      </div>
                    )}
                    {comparing === version.id && <Diff from={version} to={template} />}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </aside>

      <ConfirmDialog
        open={Boolean(restoring)}
        title="Restore this version?"
        description={`The wording from ${formatStamp(restoring?.updatedAt)} becomes the live version. The current wording stays in History.${
          hasUnsavedChanges ? " Your unsaved changes will be lost." : ""
        }`}
        confirmLabel={busy ? "Restoring…" : "Restore"}
        confirmDisabled={busy}
        onConfirm={restore}
        onCancel={() => setRestoring(null)}
      />
    </div>,
    getAdminPortalRoot(),
  )
}

const TAGS = { same: "span", remove: "del", add: "ins" }
const DIFF_CLASS = {
  same: undefined,
  remove: "bg-red-100 text-red-800 [.dark_&]:bg-red-950 [.dark_&]:text-red-300",
  add: "bg-green-100 text-green-800 no-underline [.dark_&]:bg-green-950 [.dark_&]:text-green-300",
}

// Old message against the live one: removed words red and struck through, added words green.
function Diff({ from, to }) {
  const parts = diffWords(plainText(from.body), plainText(to.body))
  const changed = parts.some((part) => part.type !== "same")
  return (
    <div className="mt-3 rounded-xl border border-ink-950/10 bg-paper-50 p-3 text-sm leading-relaxed text-ink-950">
      <p className="mb-1.5 text-xs font-medium text-ink-950/60">Compared with the live version</p>
      {from.subject !== to.subject && (
        <p className="mb-1.5 text-xs text-ink-950/70">
          Subject was “{from.subject}”
        </p>
      )}
      {!changed ? (
        <p className="text-ink-950/60">The message is the same.</p>
      ) : (
        <p>
          {parts.map((part, i) => {
            const Tag = TAGS[part.type]
            return (
              <Fragment key={i}>
                <Tag className={DIFF_CLASS[part.type]}>{part.text}</Tag>{" "}
              </Fragment>
            )
          })}
        </p>
      )}
    </div>
  )
}
