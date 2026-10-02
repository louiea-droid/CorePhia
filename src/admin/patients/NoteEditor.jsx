import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import DatePicker from "../../components/DatePicker"
import Select from "../../components/Select"
import { bmi } from "./chartMath"
import { discardDraftNote, saveDraftNote, signNote } from "./chartStore"
import ConfirmDialog from "../ui/ConfirmDialog"
import { AUDIT_ACTIONS, recordAuditEvent } from "../lib/firebase"
import { CloseIcon } from "../ui/icons"
import { INTENSITIES, NOTE_TYPES, NOTE_TYPE_LABELS, SECTION_FIELDS, inputClass, labelClass, prescriptionLine } from "./noteUi"
import { getAdminPortalRoot } from "../ui/portalRoot"
import { canWriteNote } from "../staff/roles"

const AUTOSAVE_MS = 1500
const RENEWAL_PICKS = [30, 60, 90]

const today = () => new Date().toLocaleDateString("en-CA")
const addDays = (isoDay, days) => {
  const [y, m, d] = (isoDay || today()).split("-").map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString("en-CA")
}
const newId = () => `rx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const numberOrNull = (value) => (value === "" || value == null ? null : Number(value))
// Days and minutes are whole numbers (the rules check `is int`), so a typed
// 3.5 is rounded here rather than refused at signing.
const intOrNull = (value, max) => (value == null ? null : Math.min(max, Math.max(0, Math.round(value))))
const DAY_OPTIONS = Array.from({ length: 8 }, (_, days) => ({ value: String(days), label: String(days) }))
const INTENSITY_OPTIONS = INTENSITIES.map(([value, label]) => ({ value, label }))

// Only the author ever opens a draft. A refused write means either the draft
// changed somewhere else (signed or discarded in another tab), or the
// author's role no longer writes this note type (canWriteType in the rules).
const STALE_DRAFT =
  "This draft was signed or discarded somewhere else, so it can't be changed here. Close it to see the latest version."
const ROLE_CHANGED = "Your role can't edit this note any more. Close it, or ask an admin if your role should allow it."
const errorText = (cause, fallback, roleCanEdit) =>
  cause?.code === "permission-denied" ? (roleCanEdit ? STALE_DRAFT : ROLE_CHANGED) : fallback

// The rules cap a note at 30 prescription entries (isNoteShape).
const MAX_PRESCRIPTIONS = 30

function TextArea({ label, value, onChange, rows = 3 }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`${inputClass} resize-y`} />
    </label>
  )
}

function NumberField({ label, value, onChange, suffix }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(event) => onChange(numberOrNull(event.target.value))}
          className={`${inputClass} ${suffix ? "pr-10" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-950/45">{suffix}</span>
        )}
      </span>
    </label>
  )
}

// The intake's calendar (components/DatePicker), compact to match the admin's
// fields. A div, not a <label>: DatePicker's first labelable element is its
// hidden input, so the trigger is named through ariaLabel instead.
const COMPACT_DATE = "px-3 py-2 text-sm"

function DateField({ label, value, onChange }) {
  return (
    <div>
      <span className={labelClass} aria-hidden="true">
        {label}
      </span>
      <DatePicker ariaLabel={label} value={value} onChange={onChange} triggerClassName={COMPACT_DATE} />
    </div>
  )
}

function RenewalPicker({ from, value, onChange }) {
  return (
    <div>
      <span className={labelClass}>Renewal due</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {RENEWAL_PICKS.map((days) => {
          const date = addDays(from, days)
          return (
            <button
              key={days}
              type="button"
              aria-pressed={value === date}
              onClick={() => onChange(date)}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                value === date ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/70 hover:bg-ink-950/10"
              }`}
            >
              {days} days
            </button>
          )
        })}
        <div className="w-44">
          <DatePicker ariaLabel="Renewal due" value={value} onChange={onChange} triggerClassName={COMPACT_DATE} />
        </div>
      </div>
    </div>
  )
}

function PrescriptionRow({ entry, visitDate, onChange, onRemove }) {
  const set = (patch) => onChange({ ...entry, ...patch })
  return (
    <div className="rounded-xl border border-ink-950/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-ink-950/50 uppercase">
          {entry.action === "start" ? "New prescription" : entry.action === "renew" ? "Renewal" : "Stop"}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="-mt-1 -mr-1 cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
        >
          Remove
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {entry.action === "start" ? (
          <label className="block sm:col-span-2">
            <span className={labelClass}>Medication</span>
            <input value={entry.medication} onChange={(event) => set({ medication: event.target.value })} className={inputClass} />
          </label>
        ) : (
          <p className="text-sm font-medium text-ink-950 sm:col-span-2">{entry.medication}</p>
        )}
        {entry.action === "stop" ? (
          <label className="block sm:col-span-2">
            <span className={labelClass}>Reason (optional)</span>
            <input value={entry.stopReason} onChange={(event) => set({ stopReason: event.target.value })} className={inputClass} />
          </label>
        ) : (
          <>
            <label className="block sm:col-span-2">
              <span className={labelClass}>
                {entry.action === "renew" ? "Dose and instructions (leave blank to keep the same)" : "Dose and instructions"}
              </span>
              <input value={entry.instructions} onChange={(event) => set({ instructions: event.target.value })} className={inputClass} />
            </label>
            {entry.action === "start" && (
              <DateField label="Start date" value={entry.startDate} onChange={(startDate) => set({ startDate })} />
            )}
            <div className={entry.action === "start" ? "" : "sm:col-span-2"}>
              <RenewalPicker
                from={entry.action === "start" ? entry.startDate || visitDate : visitDate}
                value={entry.renewalDue}
                onChange={(renewalDue) => set({ renewalDue })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ExercisePlanFields({ plan, onChange }) {
  const set = (patch) => onChange({ ...plan, ...patch })
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink-950">Exercise prescription</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <span className={labelClass} aria-hidden="true">
            Days per week
          </span>
          <Select
            ariaLabel="Days per week"
            options={DAY_OPTIONS}
            value={plan.daysPerWeek == null ? "" : String(plan.daysPerWeek)}
            onChange={(value) => set({ daysPerWeek: value === "" ? null : Number(value) })}
            placeholder="Choose"
            triggerClassName={COMPACT_DATE}
          />
        </div>
        <div>
          <span className={labelClass} aria-hidden="true">
            Intensity
          </span>
          <Select
            ariaLabel="Intensity"
            options={INTENSITY_OPTIONS}
            value={plan.intensity}
            onChange={(intensity) => set({ intensity })}
            placeholder="Choose"
            triggerClassName={COMPACT_DATE}
          />
        </div>
        <NumberField
          label="Minutes per session"
          suffix="min"
          value={plan.minutesPerSession}
          onChange={(value) => set({ minutesPerSession: intOrNull(value, 300) })}
        />
        <label className="block sm:col-span-3">
          <span className={labelClass}>Type of exercise</span>
          <input value={plan.kind} onChange={(event) => set({ kind: event.target.value })} className={inputClass} />
        </label>
        <div className="sm:col-span-3">
          <TextArea label="Notes" value={plan.notes} onChange={(notes) => set({ notes })} rows={2} />
        </div>
      </div>
    </section>
  )
}

// Why a note can't be signed yet, or null when it can.
function signProblem(fields) {
  if (!fields.visitDate) return "Add the visit date."
  for (const entry of fields.prescriptions) {
    if (entry.action === "start" && !entry.medication.trim()) return "Each new prescription needs a medication."
    if (entry.action !== "stop" && !entry.renewalDue) return `Set a renewal date for ${entry.medication || "each prescription"}.`
  }
  return null
}

// A draft note, open over the chart. Autosaves as the author types; Sign
// locks it for good (firestore.rules refuses every later edit), Discard
// deletes the draft. Only the author ever sees a draft, so there is no
// "someone else is editing" state to handle.
export default function NoteEditor({
  chart,
  intake,
  note,
  current,
  lastWeight,
  lastWeightSource,
  actor,
  onClose,
  onSigned,
  onDiscarded,
}) {
  const [fields, setFields] = useState(() => ({
    visitDate: note.visitDate,
    sections: note.sections,
    vitals: note.vitals,
    prescriptions: note.prescriptions,
    nextFollowUp: note.nextFollowUp,
    ...(note.exercisePlan && { exercisePlan: note.exercisePlan }),
  }))
  const config = NOTE_TYPES[note.type]
  const roleCanEdit = canWriteNote(note.type, actor.role)
  // After a save the rules refused, a second Close leaves without saving:
  // that text can never be saved, so it must not trap the editor open.
  const closeAnyway = useRef(false)
  const [saveState, setSaveState] = useState("saved") // saved | pending | saving | error
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null) // "sign" | "discard" | null
  const latest = useRef(fields)
  const timer = useRef(null)
  const closeRef = useRef(null)
  // Every change bumps `version`; `savedVersion` is the last one Firestore
  // confirmed. They differ exactly when there's text not yet saved, including
  // keystrokes typed while an earlier save was still in flight.
  const version = useRef(0)
  const savedVersion = useRef(0)
  const lastSaveError = useRef(null)

  const save = useCallback(async () => {
    clearTimeout(timer.current)
    const sending = version.current
    setSaveState("saving")
    try {
      await saveDraftNote(chart.id, note.id, latest.current)
      savedVersion.current = Math.max(savedVersion.current, sending)
      setSaveState(version.current === savedVersion.current ? "saved" : "pending")
      return true
    } catch (cause) {
      console.error("Draft autosave failed:", cause.code ?? cause.message)
      lastSaveError.current = cause
      setSaveState("error")
      return false
    }
  }, [chart.id, note.id])

  const update = (patch) => {
    setFields((previous) => {
      const next = { ...previous, ...patch }
      latest.current = next
      return next
    })
    version.current += 1
    setSaveState("pending")
    clearTimeout(timer.current)
    timer.current = setTimeout(save, AUTOSAVE_MS)
  }
  const setSection = (key, value) => update({ sections: { ...latest.current.sections, [key]: value } })
  const setVital = (key, value) => update({ vitals: { ...latest.current.vitals, [key]: value } })
  const setPrescriptions = (prescriptions) => update({ prescriptions })

  // Close saves anything not yet confirmed first, and if that save fails the
  // editor stays open with the text and the error, so nothing typed is lost.
  const close = useCallback(async () => {
    if (busy) return
    if (roleCanEdit && !closeAnyway.current && version.current !== savedVersion.current && !(await save())) {
      const refused = lastSaveError.current?.code === "permission-denied"
      closeAnyway.current = refused
      setError(
        refused
          ? `${errorText(lastSaveError.current, "", roleCanEdit)} Closing again leaves without saving.`
          : "Couldn't save your draft, so it's still open. Check your connection and try again.",
      )
      return
    }
    onClose()
  }, [busy, save, onClose, roleCanEdit])

  useEffect(() => {
    closeRef.current?.focus()
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
      clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !confirm) close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [close, confirm])

  const sign = async () => {
    setBusy(true)
    setError(null)
    clearTimeout(timer.current)
    try {
      await signNote(chart.id, note.id, note.type, latest.current, actor)
      recordAuditEvent({
        action: AUDIT_ACTIONS.signNote,
        targetCollection: "patients",
        targetId: chart.id,
        targetLabel: `${chart.firstName} ${chart.lastName}`.trim(),
      })
      onSigned()
    } catch (cause) {
      setConfirm(null)
      setError(errorText(cause, "Couldn't sign this note. Nothing was changed. Try again.", roleCanEdit))
    } finally {
      setBusy(false)
    }
  }

  const discard = async () => {
    setBusy(true)
    clearTimeout(timer.current)
    try {
      await discardDraftNote(chart.id, note.id)
      onDiscarded()
    } catch (cause) {
      setConfirm(null)
      setError(errorText(cause, "Couldn't discard this draft. Try again.", roleCanEdit))
    } finally {
      setBusy(false)
    }
  }

  const heightFeet = intake?.vitals?.heightFeet
  const heightInches = intake?.vitals?.heightInches
  const bmiNow = bmi(heightFeet, heightInches, fields.vitals.weightLb)
  const weightChange =
    fields.vitals.weightLb && lastWeight ? Math.round((fields.vitals.weightLb - lastWeight) * 10) / 10 : null

  // A current prescription already renewed or stopped in this draft can't be
  // acted on twice.
  const actedOn = new Set(fields.prescriptions.filter((entry) => entry.renewsId).map((entry) => entry.renewsId))
  const atCap = fields.prescriptions.length >= MAX_PRESCRIPTIONS
  const addEntry = (entry) => {
    if (latest.current.prescriptions.length >= MAX_PRESCRIPTIONS) return
    setPrescriptions([...latest.current.prescriptions, entry])
  }
  const problem = signProblem(fields)

  const saveLabel = {
    saved: "Draft saved",
    pending: "Unsaved changes",
    saving: "Saving…",
    error: "Not saved. Retrying on your next change.",
  }[saveState]

  const name = `${chart.firstName} ${chart.lastName}`.trim()

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-scrim/50" />
      <div className="flex h-full items-end justify-center sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${NOTE_TYPE_LABELS[note.type]} for ${name}`}
          className="relative flex h-[96dvh] w-full max-w-3xl flex-col rounded-t-3xl bg-paper-50 shadow-2xl sm:h-[90vh] sm:rounded-3xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-950/10 px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <p className="font-serif text-xl text-ink-950">{NOTE_TYPE_LABELS[note.type]}</p>
              <p className="mt-0.5 truncate text-sm text-ink-950/55">
                {name}. <span aria-live="polite">{saveLabel}</span>
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close (your draft is kept)"
              className="rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>

          <div className="scrollbar-thin flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
            {!roleCanEdit && (
              <p role="alert" className="rounded-lg bg-paper-100 px-3 py-2 text-sm text-ink-950/75">
                {ROLE_CHANGED} Changes here can't be saved.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField label="Visit date" value={fields.visitDate} onChange={(visitDate) => update({ visitDate })} />
            </div>

            <section className="space-y-4">
              {SECTION_FIELDS[note.type].map(([key, label]) => (
                <TextArea
                  key={key}
                  label={label}
                  value={fields.sections[key]}
                  onChange={(value) => setSection(key, value)}
                  rows={key === "hpi" || key === "plan" ? 4 : 3}
                />
              ))}
            </section>

            {fields.exercisePlan && (
              <ExercisePlanFields plan={fields.exercisePlan} onChange={(exercisePlan) => update({ exercisePlan })} />
            )}

            <section>
              {/* Weight-only notes skip the heading: the field's own label says it. */}
              {config.fullVitals && <h3 className="mb-3 text-sm font-semibold text-ink-950">Vitals</h3>}
              <div className={`grid gap-3 ${config.fullVitals ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
                <NumberField label="Weight" suffix="lbs" value={fields.vitals.weightLb} onChange={(v) => setVital("weightLb", v)} />
                {config.fullVitals && (
                  <>
                    <NumberField label="Systolic" value={fields.vitals.systolic} onChange={(v) => setVital("systolic", v)} />
                    <NumberField label="Diastolic" value={fields.vitals.diastolic} onChange={(v) => setVital("diastolic", v)} />
                    <NumberField label="Heart rate" suffix="bpm" value={fields.vitals.heartRate} onChange={(v) => setVital("heartRate", v)} />
                  </>
                )}
              </div>
              <p className="mt-2 min-h-5 text-xs text-ink-950/60" aria-live="polite">
                {[
                  bmiNow && `BMI ${bmiNow}`,
                  weightChange !== null &&
                    `${weightChange > 0 ? "+" : weightChange < 0 ? "−" : "±"}${Math.abs(weightChange)} lbs since ${lastWeightSource === "intake" ? "intake" : "last note"}`,
                ]
                  .filter(Boolean)
                  .join(". ")}
              </p>
            </section>

            {config.prescriptions && (
              <section>
                <h3 className="text-sm font-semibold text-ink-950">Prescriptions</h3>
                {current.length > 0 && (
                  <ul className="mt-3 divide-y divide-ink-950/10 rounded-xl border border-ink-950/10 bg-white">
                    {current.map((rx) => (
                      <li key={rx.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <span className="min-w-0 text-sm text-ink-950">
                          {prescriptionLine({ ...rx, action: "start" }).replace(/^Start /, "")}
                        </span>
                        {actedOn.has(rx.id) ? (
                          <span className="text-xs text-ink-950/50">Updated below</span>
                        ) : (
                          <span className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                addEntry({
                                  id: newId(),
                                  action: "renew",
                                  renewsId: rx.id,
                                  medication: rx.medication,
                                  instructions: "",
                                  startDate: "",
                                  renewalDue: "",
                                  stopReason: "",
                                })
                              }
                              className="cursor-pointer rounded-lg bg-paper-100 px-2.5 py-1 text-xs font-medium text-ink-950 transition-colors duration-200 hover:bg-ink-950/10"
                            >
                              Renew
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                addEntry({
                                  id: newId(),
                                  action: "stop",
                                  renewsId: rx.id,
                                  medication: rx.medication,
                                  instructions: "",
                                  startDate: "",
                                  renewalDue: "",
                                  stopReason: "",
                                })
                              }
                              className="cursor-pointer rounded-lg bg-paper-100 px-2.5 py-1 text-xs font-medium text-ink-950 transition-colors duration-200 hover:bg-ink-950/10"
                            >
                              Stop
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 space-y-3">
                  {fields.prescriptions.map((entry) => (
                    <PrescriptionRow
                      key={entry.id}
                      entry={entry}
                      visitDate={fields.visitDate}
                      onChange={(next) => setPrescriptions(latest.current.prescriptions.map((e) => (e.id === entry.id ? next : e)))}
                      onRemove={() => setPrescriptions(latest.current.prescriptions.filter((e) => e.id !== entry.id))}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    addEntry({
                      id: newId(),
                      action: "start",
                      renewsId: "",
                      medication: "",
                      instructions: "",
                      startDate: fields.visitDate || today(),
                      renewalDue: "",
                      stopReason: "",
                    })
                  }
                  disabled={atCap}
                  className="mt-3 cursor-pointer rounded-lg border border-dashed border-ink-950/25 px-3 py-2 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:border-ink-950/50 hover:text-ink-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add prescription
                </button>
                {atCap && (
                  <p className="mt-2 text-xs text-ink-950/55">
                    A note holds up to {MAX_PRESCRIPTIONS} prescription entries. Start another note for more.
                  </p>
                )}
              </section>
            )}

            <section className="grid gap-4 sm:grid-cols-2">
              <DateField
                label="Next follow-up"
                value={fields.nextFollowUp}
                onChange={(nextFollowUp) => update({ nextFollowUp })}
              />
            </section>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-ink-950/10 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
            <button
              type="button"
              onClick={() => setConfirm("discard")}
              disabled={busy}
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-50"
            >
              Discard draft
            </button>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {(error || problem) && (
                <p role={error ? "alert" : undefined} className={`text-sm ${error ? "text-brand-dark" : "text-ink-950/55"}`}>
                  {error ?? problem}
                </p>
              )}
              <button
                type="button"
                onClick={() => setConfirm("sign")}
                disabled={busy || Boolean(problem) || !roleCanEdit}
                className="cursor-pointer rounded-full bg-ink-950 px-6 py-2.5 text-sm font-semibold text-paper-50 shadow-lg shadow-ink-950/15 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sign note
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "sign"}
        title="Sign this note?"
        description="Signing locks the note. Any change after this is added as a dated addendum."
        confirmLabel={busy ? "Signing…" : "Sign note"}
        confirmDisabled={busy}
        onConfirm={sign}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "discard"}
        title="Discard this draft?"
        description="The draft is deleted. Nothing was signed, so the chart is unchanged."
        confirmLabel={busy ? "Discarding…" : "Discard"}
        confirmDisabled={busy}
        onConfirm={discard}
        onCancel={() => setConfirm(null)}
      />
    </div>,
    getAdminPortalRoot(),
  )
}
