import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { AUDIT_ACTIONS, INTAKE_COLLECTION, recordAuditEvent } from "./firebase"
import { CloseIcon, TrashIcon } from "./icons"
import { getAdminPortalRoot } from "./portalRoot"

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
      <p className="mt-0.5 text-sm text-ink-950">{display || "—"}</p>
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

export default function PatientModal({ record, onClose, canDelete, onRequestDelete, audit = true }) {
  const closeButtonRef = useRef(null)
  const open = Boolean(record)

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
          <div className="flex items-start justify-between gap-4 border-b border-ink-950/10 px-6 py-5 sm:px-8">
            <div>
              <p className="font-serif text-2xl text-ink-950">{fullName}</p>
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

          <div className="space-y-5 overflow-y-auto px-6 py-5 sm:px-8">
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

            <Section title="Insurance">
              <Field label="Provider" value={insurance?.provider} />
              <Field label="Member ID" value={insurance?.memberId} />
              <Field label="Group number" value={insurance?.groupNumber} />
              <Field label="Policyholder" value={insurance?.policyholderName} />
            </Section>

            <Section title="Vitals">
              <Field
                label="Height"
                value={
                  vitals?.heightFeet ? `${vitals.heightFeet} ft ${vitals.heightInches || 0} in` : null
                }
              />
              <Field label="Current weight" value={vitals?.currentWeightLb && `${vitals.currentWeightLb} lb`} />
              <Field label="Goal weight" value={vitals?.goalWeightLb && `${vitals.goalWeightLb} lb`} />
              <Field
                label="Highest adult weight"
                value={vitals?.highestAdultWeightLb && `${vitals.highestAdultWeightLb} lb`}
              />
            </Section>

            <Section title="Medical history">
              <Field label="Conditions" value={medicalHistory?.conditions} span />
              <Field label="Medications" value={medicalHistory?.medications} span />
              <Field label="Allergies" value={medicalHistory?.allergies} />
              <Field label="Prior weight loss treatment" value={medicalHistory?.priorWeightLossTreatment} />
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
              <Field label="Est. daily calories" value={nutrition?.estimatedDailyCalories} />
              <Field label="Meals per day" value={nutrition?.mealsPerDay} />
              <Field label="Diet notes" value={nutrition?.dietNotes} span />
            </Section>

            <Section title="Visit">
              <Field label="Membership plan" value={visit?.membershipPlan} />
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
