import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { bmi } from "./chartMath"
import { addAmendment, loadAmendments } from "./chartStore"
import ConfirmDialog from "./ConfirmDialog"
import { AUDIT_ACTIONS, recordAuditEvent } from "./firebase"
import { CloseIcon } from "./icons"
import {
  NOTE_TYPE_LABELS,
  SECTION_FIELDS,
  formatDay,
  formatStamp,
  inputClass,
  prescriptionLine,
  signerLine,
  vitalsLine,
} from "./noteUi"
import { getAdminPortalRoot } from "./portalRoot"
import { ROLE_LABELS } from "./roles"

// A signed note, read-only: signed notes are locked by firestore.rules. The
// one thing anyone can do here is add an addendum, which is dated, signed by
// its own author and shown under the original, which itself never changes.
// The rules cap an addendum at 5000 characters.
const MAX_ADDENDUM = 5000

export default function NoteView({ chart, intake, note, actor, onClose }) {
  const closeRef = useRef(null)
  const [amendments, setAmendments] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  // Closing with a half-typed addendum asks first instead of dropping it.
  const requestClose = () => (draft.trim() ? setConfirmingDiscard(true) : onClose())

  useEffect(() => {
    let active = true
    loadAmendments(chart.id, note.id)
      .then((result) => active && setAmendments(result))
      .catch((cause) => active && setLoadError(cause.code ?? cause.message))
    return () => {
      active = false
    }
  }, [chart.id, note.id])

  useEffect(() => {
    closeRef.current?.focus()
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  // Re-attached as the draft changes, so Escape sees the current text; the
  // confirm dialog handles its own Escape while it's open.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || document.querySelector('[role="alertdialog"]')) return
      if (draft.trim()) setConfirmingDiscard(true)
      else onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [draft, onClose])

  const save = async () => {
    const text = draft.trim()
    if (!text) return
    setSaving(true)
    setError(null)
    try {
      const amendment = await addAmendment(chart.id, note.id, text, actor)
      recordAuditEvent({
        action: AUDIT_ACTIONS.addAmendment,
        targetCollection: "patients",
        targetId: chart.id,
        targetLabel: `${chart.firstName} ${chart.lastName}`.trim(),
      })
      setAmendments((current) => [...(current ?? []), amendment])
      setDraft("")
      setAdding(false)
    } catch (cause) {
      setError(
        cause?.code === "permission-denied" ? "Your role can't do this." : "Couldn't save the addendum. Nothing was changed. Try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  const sections = SECTION_FIELDS[note.type].filter(([key]) => note.sections?.[key]?.trim())
  const noteBmi = bmi(intake?.vitals?.heightFeet, intake?.vitals?.heightInches, note.vitals?.weightLb)
  const vitals = [vitalsLine(note.vitals), noteBmi && `BMI ${noteBmi}`].filter(Boolean).join(", ")
  const name = `${chart.firstName} ${chart.lastName}`.trim()

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div aria-hidden="true" onClick={requestClose} className="absolute inset-0 bg-scrim/50" />
      <div className="flex h-full items-end justify-center sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${NOTE_TYPE_LABELS[note.type]} for ${name}, ${formatDay(note.visitDate)}`}
          className="relative flex max-h-[96dvh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-950/10 px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <p className="font-serif text-xl text-ink-950">
                {NOTE_TYPE_LABELS[note.type]}, {formatDay(note.visitDate)}
              </p>
              <p className="mt-0.5 text-sm text-ink-950/55">{signerLine(note.signedBy, note.signedAt)}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>

          <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
            {sections.map(([key, label]) => (
              <section key={key}>
                <h3 className="text-xs font-semibold tracking-wide text-ink-950/50 uppercase">{label}</h3>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-950">{note.sections[key]}</p>
              </section>
            ))}
            {vitals && (
              <section>
                <h3 className="text-xs font-semibold tracking-wide text-ink-950/50 uppercase">Vitals</h3>
                <p className="mt-1.5 text-sm text-ink-950">{vitals}</p>
              </section>
            )}
            {note.prescriptions?.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold tracking-wide text-ink-950/50 uppercase">Prescriptions</h3>
                <ul className="mt-1.5 space-y-1 text-sm text-ink-950">
                  {note.prescriptions.map((entry) => (
                    <li key={entry.id}>{prescriptionLine(entry)}</li>
                  ))}
                </ul>
              </section>
            )}
            {note.nextFollowUp && (
              <section>
                <h3 className="text-xs font-semibold tracking-wide text-ink-950/50 uppercase">Next follow-up</h3>
                <p className="mt-1.5 text-sm text-ink-950">{formatDay(note.nextFollowUp)}</p>
              </section>
            )}
            {!sections.length && !vitals && !note.prescriptions?.length && (
              <p className="text-sm text-ink-950/55">This note was signed with no sections filled in.</p>
            )}

            <section className="border-t border-ink-950/10 pt-5">
              <h3 className="text-sm font-semibold text-ink-950">Addenda</h3>
              {loadError ? (
                <p className="mt-2 text-sm text-brand-dark">Couldn't load addenda ({loadError}).</p>
              ) : !amendments ? (
                <p className="mt-2 text-sm text-ink-950/50">Loading…</p>
              ) : amendments.length === 0 ? (
                <p className="mt-2 text-sm text-ink-950/55">None. Corrections to a signed note are added here.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {amendments.map((amendment) => (
                    <li key={amendment.id} className="rounded-xl border-l-2 border-accent-dark/40 bg-paper-50 px-4 py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-950">{amendment.text}</p>
                      <p className="mt-1.5 text-xs text-ink-950/55">
                        {amendment.authorName} ({ROLE_LABELS[amendment.authorRole] ?? amendment.authorRole}),{" "}
                        {formatStamp(amendment.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {adding ? (
                <div className="mt-4">
                  <label className="block">
                    <span className="sr-only">Addendum</span>
                    <textarea
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={3}
                      maxLength={MAX_ADDENDUM}
                      placeholder="What's being corrected or added, and why."
                      className={`${inputClass} resize-y`}
                    />
                  </label>
                  <p className="mt-1 text-right text-xs text-ink-950/45 tabular-nums">
                    {draft.length} / {MAX_ADDENDUM}
                  </p>
                  {error && (
                    <p role="alert" className="mt-2 text-sm text-brand-dark">
                      {error}
                    </p>
                  )}
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false)
                        setDraft("")
                        setError(null)
                      }}
                      className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving || !draft.trim()}
                      className="cursor-pointer rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Signing…" : "Sign addendum"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="mt-4 cursor-pointer rounded-lg border border-dashed border-ink-950/25 px-3 py-2 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:border-ink-950/50 hover:text-ink-950"
                >
                  Add addendum
                </button>
              )}
            </section>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmingDiscard}
        title="Discard this addendum?"
        description="It hasn't been signed, so nothing is added to the note."
        confirmLabel="Discard"
        cancelLabel="Keep writing"
        onConfirm={onClose}
        onCancel={() => setConfirmingDiscard(false)}
      />
    </div>,
    getAdminPortalRoot(),
  )
}
