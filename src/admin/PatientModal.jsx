import { useEffect, useRef, useState } from "react"
import { medicationInterestLabel } from "./analytics"
import { createPortal } from "react-dom"
import { AUDIT_ACTIONS, INTAKE_COLLECTION, recordAuditEvent } from "./firebase"
import { CloseIcon, NoteIcon, TrashIcon } from "./icons"
import { getAdminPortalRoot } from "./portalRoot"

// Every active colour here is deliberately one that .dark does NOT redefine,
// because these three sit side by side: ink-950 was tried for pending and
// flipped to near-white in dark mode, washing out to a pale outline while
// accent-dark and red-600 stayed solid. slate-200 and ink-800 aren't
// redefined either, so the light-grey pending pill keeps dark navy text on it
// in both themes rather than inheriting a flip and going invisible.
const STATUS_OPTIONS = [
  { value: "admitted", label: "Admit", activeClass: "bg-accent-dark text-oncolor" },
  { value: "pending", label: "Pending", activeClass: "bg-slate-200 text-ink-800" },
  { value: "declined", label: "Decline", activeClass: "bg-red-600 text-oncolor" },
]

const STATUS_BADGE = {
  admitted: "bg-accent-dark/10 text-accent-dark",
  pending: "bg-ink-950/10 text-ink-950/60",
  declined: "bg-red-600/10 text-red-600",
}

function formatDate(value, options) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", options)
}

function Field({ label, value, span }) {
  const display = Array.isArray(value) ? value.filter(Boolean).join(", ") : value
  return (
    <div className={span ? "col-span-2" : ""}>
      <p className="text-xs font-medium tracking-wide text-ink-950/45 uppercase">{label}</p>
      <p className="mt-0.5 text-sm wrap-break-word text-ink-950">{display || "—"}</p>
    </div>
  )
}

function Consent({ label, granted }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          granted ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/40"
        }`}
      >
        {granted ? "✓" : "–"}
      </span>
      <span className={granted ? "text-ink-950" : "text-ink-950/45"}>{label}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="border-t border-ink-950/10 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-ink-950">{title}</h3>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </section>
  )
}

export default function PatientModal({
  record,
  onClose,
  canDelete,
  onRequestDelete,
  canReview,
  onUpdateStatus,
  onSaveNote,
  audit = true,
}) {
  const closeButtonRef = useRef(null)
  const open = Boolean(record)

  const [noteRecordId, setNoteRecordId] = useState(record?.id ?? null)
  const [note, setNote] = useState(record?.adminNote ?? "")
  const [noteSaving, setNoteSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  // The note textarea is local state (so typing doesn't fire a write per
  // keystroke), reset to whatever's on the record whenever a different chart
  // opens. Adjusted during render rather than in an effect — the recommended
  // way to reset state on a prop change without an extra render pass.
  const recordId = record?.id ?? null
  if (recordId !== noteRecordId) {
    setNoteRecordId(recordId)
    setNote(record?.adminNote ?? "")
    setNoteOpen(false)
    setReviewError(null)
  }

  const status = record?.status ?? "pending"
  const hasNote = Boolean(record?.adminNote?.trim())
  const noteDirty = note !== (record?.adminNote ?? "")

  // Both writes surface their failure rather than swallowing it: until the
  // updated firestore.rules are deployed, intakeRecords is still update-denied,
  // so a click here fails server-side and would otherwise look like nothing
  // happened at all.
  const changeStatus = async (nextStatus) => {
    if (!record || nextStatus === status) return
    setStatusSaving(true)
    setReviewError(null)
    try {
      await onUpdateStatus(record, nextStatus)
    } catch (cause) {
      setReviewError(cause.code ?? cause.message ?? "Could not update this patient's status.")
    } finally {
      setStatusSaving(false)
    }
  }

  const saveNote = async () => {
    if (!record) return
    setNoteSaving(true)
    setReviewError(null)
    try {
      await onSaveNote(record, note)
      setNoteOpen(false)
    } catch (cause) {
      setReviewError(cause.code ?? cause.message ?? "Could not save this note.")
    } finally {
      setNoteSaving(false)
    }
  }

  // Opening a chart is the access event worth recording, so it's logged here
  // rather than at each call site — the patients table, the dashboard's recent
  // list and every chart drilldown all open this one component, and none of
  // them can forget to log. The ref stops a single open being recorded twice
  // (StrictMode runs effects twice in development) while still letting a
  // genuine second open of the same chart record a second access, because the
  // ref clears when the modal closes.
  const loggedRecordIdRef = useRef(null)
  useEffect(() => {
    if (!record?.id) {
      loggedRecordIdRef.current = null
      return
    }
    if (!audit || loggedRecordIdRef.current === record.id) return
    loggedRecordIdRef.current = record.id
    recordAuditEvent({
      action: AUDIT_ACTIONS.viewIntake,
      targetCollection: INTAKE_COLLECTION,
      targetId: record.id,
      targetLabel: [record.demographics?.firstName, record.demographics?.lastName].filter(Boolean).join(" "),
    })
  }, [record, audit])

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    document.body.style.overflow = "hidden"

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  if (!record) return null

  const { demographics, emergencyContact, insurance, vitals, medicalHistory } = record
  const { familyHistory, socialHistory, nutrition, visit, consent } = record
  const fullName = [demographics?.firstName, demographics?.lastName].filter(Boolean).join(" ") || "Patient"
  const address = demographics?.address ?? {}
  const cityState = [address.city, address.state].filter(Boolean).join(", ")

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-scrim/50 transition-opacity duration-200"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${fullName}'s intake details`}
          className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl"
        >
          <div className="border-b border-ink-950/10 px-6 py-5 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-serif text-2xl text-ink-950">{fullName}</p>
                  {/* Only shown when there's no button row below to convey status
                      instead — avoids saying "Pending" twice in the same header. */}
                  {!canReview && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[status]}`}>
                      {status}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-950/50">
                  Submitted {formatDate(record.submittedAt, { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onRequestDelete(record)}
                    aria-label="Delete this intake record"
                    className="rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-brand-dark/10 hover:text-brand-dark"
                  >
                    <TrashIcon className="size-5" />
                  </button>
                )}
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>
            </div>

            {canReview && (
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div role="group" aria-label="Admission status" className="flex items-center gap-1.5">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={statusSaving}
                        // Which option is active is otherwise conveyed only by
                        // colour, which a screen reader can't see.
                        aria-pressed={status === option.value}
                        onClick={() => changeStatus(option.value)}
                        className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                          status === option.value ? option.activeClass : "bg-white text-ink-950/60 hover:bg-ink-950/5"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="mx-0.5 h-5 w-px bg-ink-950/10" aria-hidden="true" />

                  <button
                    type="button"
                    onClick={() => setNoteOpen((current) => !current)}
                    aria-expanded={noteOpen}
                    aria-controls="patient-admin-note"
                    className={`relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                      noteOpen ? "bg-ink-950 text-paper-50" : "bg-white text-ink-950/60 hover:bg-ink-950/5"
                    }`}
                  >
                    <NoteIcon className="size-3.5" />
                    Note
                    {hasNote && !noteOpen && (
                      <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent-dark" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {reviewError && (
                  <p className="mt-2 text-xs text-brand-dark" role="alert">
                    {reviewError}
                  </p>
                )}

                {/* inert while collapsed: a zero-height grid row still leaves
                    the textarea and its save button in the tab order, so
                    keyboard focus would disappear into a panel nobody can see. */}
                <div
                  inert={!noteOpen}
                  className={`grid transition-all duration-200 ease-out-smooth motion-reduce:transition-none ${
                    noteOpen ? "mt-2.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <textarea
                      id="patient-admin-note"
                      // The visible label is the "Note" toggle that opens this
                      // panel, so the field needs its own name — a placeholder
                      // isn't one, and it disappears as soon as you type.
                      aria-label="Admin note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={3}
                      placeholder="Notes for the care team — not visible to the patient."
                      className="w-full resize-none rounded-lg border border-ink-950/15 bg-white px-3 py-2 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-950/40 focus:border-ink-950/40"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={saveNote}
                        disabled={!noteDirty || noteSaving}
                        className="cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-sm font-medium text-paper-50 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {noteSaving ? "Saving…" : "Save note"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="scrollbar-thin space-y-5 overflow-y-auto px-6 py-5 sm:px-8">
            <Section title="Demographics">
              <Field label="Date of birth" value={formatDate(demographics?.dateOfBirth)} />
              <Field label="Sex assigned at birth" value={demographics?.sexAssignedAtBirth} />
              <Field label="Phone" value={demographics?.phone} />
              <Field label="Email" value={demographics?.email} />
              <Field label="Address" value={address.line1} span />
              <Field label="City, state" value={cityState} />
              <Field label="Postal code" value={address.postalCode} />
            </Section>

            <Section title="Emergency contact">
              <Field label="Name" value={emergencyContact?.name} />
              <Field label="Relationship" value={emergencyContact?.relationship} />
              <Field label="Phone" value={emergencyContact?.phone} span />
            </Section>

            {/* CorePhia is cash only and the intake no longer asks about
                insurance, so this only appears on older records that have it. */}
            {insurance && Object.values(insurance).some(Boolean) && (
              <Section title="Insurance">
                <Field label="Provider" value={insurance.provider} />
                <Field label="Member ID" value={insurance.memberId} />
                <Field label="Group number" value={insurance.groupNumber} />
                <Field label="Policyholder" value={insurance.policyholderName} />
              </Section>
            )}

            <Section title="Vitals">
              <Field
                label="Height"
                value={
                  vitals?.heightFeet ? `${vitals.heightFeet} ft ${vitals.heightInches || 0} in` : null
                }
              />
              <Field label="Current weight" value={vitals?.currentWeightLb && `${vitals.currentWeightLb} lb`} />
              {/* Each weight question can be a typed number or a tapped range;
                  show whichever the patient gave. */}
              <Field
                label="Goal"
                value={vitals?.goalWeightLb ? `${vitals.goalWeightLb} lb` : vitals?.weightLossGoalRange}
              />
              <Field
                label="Highest adult weight"
                value={
                  vitals?.highestAdultWeightLb ? `${vitals.highestAdultWeightLb} lb` : vitals?.highestAdultWeightRange
                }
              />
            </Section>

            <Section title="Medical history">
              <Field label="Conditions" value={medicalHistory?.conditions} span />
              <Field label="Medications" value={medicalHistory?.medications} span />
              <Field label="Allergies" value={medicalHistory?.allergies} />
              <Field label="Prior weight loss treatment" value={medicalHistory?.priorWeightLossTreatment} />
              <Field
                label="Interest in medication"
                value={medicationInterestLabel(medicalHistory?.medicationInterest)}
              />
              <Field label="Surgeries" value={medicalHistory?.surgeries} span />
            </Section>

            <Section title="Family history">
              <Field label="Conditions" value={familyHistory?.conditions} span />
              <Field label="Notes" value={familyHistory?.notes} span />
            </Section>

            <Section title="Social history & nutrition">
              <Field label="Tobacco" value={socialHistory?.tobacco} />
              <Field label="Alcohol" value={socialHistory?.alcohol} />
              <Field label="Exercise frequency" value={socialHistory?.exerciseFrequency} />
              <Field label="Water intake" value={nutrition?.waterIntake} />
              <Field
                label="Est. daily calories"
                value={nutrition?.estimatedDailyCalories || nutrition?.estimatedDailyCaloriesRange}
              />
              <Field label="Meals per day" value={nutrition?.mealsPerDay} />
              <Field label="Diet notes" value={nutrition?.dietNotes} span />
            </Section>

            <Section title="Visit">
              {visit?.membershipPlan && <Field label="Membership plan" value={visit.membershipPlan} />}
              <Field label="Reason" value={visit?.reason} />
              <Field label="Preferred date" value={formatDate(visit?.preferredDate)} />
              <Field label="Preferred time" value={visit?.preferredTime} />
              <Field label="Notes" value={visit?.notes} span />
            </Section>

            <Section title="Consent">
              <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-2">
                <Consent label="Telehealth consent" granted={consent?.telehealth} />
                <Consent label="HIPAA acknowledged" granted={consent?.hipaaAcknowledged} />
                <Consent label="Insurance billing authorized" granted={consent?.insuranceBilling} />
              </div>
              <Field label="Signed by" value={consent?.signature} />
              <Field label="Signed on" value={formatDate(consent?.signedOn)} />
            </Section>
          </div>
        </div>
      </div>
    </div>,
    getAdminPortalRoot(),
  )
}
