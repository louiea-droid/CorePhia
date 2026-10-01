import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import ApplicantModal from "./ApplicantModal"
import { medicationInterestLabel } from "./analytics"
import { ageFrom, asDate, bmi, currentPrescriptions } from "./chartMath"
import { countAmendments, createDraftNote, loadChart, loadIntakeRecord, loadNotes } from "./chartStore"
import { AUDIT_ACTIONS, recordAuditEvent } from "./firebase"
import { ChevronLeftIcon } from "./icons"
import NoteEditor from "./NoteEditor"
import NoteView from "./NoteView"
import { NOTE_TYPE_LABELS, STATUS_PILL, formatDay, prescriptionLine, signerLine } from "./noteUi"
import PageHeader from "./PageHeader"
import { isClinicalRole } from "./roles"

const list = (value) => (Array.isArray(value) ? value.filter((item) => item && item !== "None of the above").join(", ") : value)

// Pertinent history for a new consultation, drafted from what the patient
// told the intake. The provider edits it; nothing here is final until signed.
function historyFromIntake(intake) {
  const history = intake?.medicalHistory ?? {}
  const lines = [
    ["Conditions", list(history.conditions)],
    ["Medications", history.medications],
    ["Allergies", history.allergies],
    ["Surgeries", history.surgeries],
    ["Family history", list(intake?.familyHistory?.conditions)],
    ["Prior weight loss treatment", history.priorWeightLossTreatment],
  ]
  return lines
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n")
}

function SummaryRow({ label, value }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2">
      <dt className="text-ink-950/55">{label}</dt>
      <dd className="wrap-break-word text-ink-950">{value || "None reported"}</dd>
    </div>
  )
}

// fill: on desktop, stretch to the row's height (the Notes card beside the
// taller summary column), so the columns end level instead of leaving a gap.
function Card({ title, action, children, fill = false }) {
  return (
    <section className={`rounded-2xl border border-ink-950/10 bg-white p-5 ${fill ? "lg:flex lg:h-full lg:flex-col" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-950">{title}</h2>
        {action}
      </div>
      <div className={`mt-3 ${fill ? "lg:flex lg:flex-1 lg:flex-col" : ""}`}>{children}</div>
    </section>
  )
}

export default function PatientChart({ actor }) {
  const { chartId } = useParams()
  const [chart, setChart] = useState(undefined) // undefined = loading, null = not found
  const [intake, setIntake] = useState(null)
  const [notes, setNotes] = useState(null)
  const [error, setError] = useState(null)
  const [openNote, setOpenNote] = useState(null)
  const [creating, setCreating] = useState(null)
  const [createError, setCreateError] = useState(null)
  const [showIntake, setShowIntake] = useState(false)

  const reload = async () => {
    const [nextChart, nextNotes] = await Promise.all([loadChart(chartId), loadNotes(chartId, actor.uid)])
    setChart(nextChart)
    setNotes(nextNotes)
  }

  useEffect(() => {
    let active = true
    Promise.all([loadChart(chartId), loadIntakeRecord(chartId), loadNotes(chartId, actor.uid)])
      .then(([nextChart, nextIntake, nextNotes]) => {
        if (!active) return
        setChart(nextChart)
        setIntake(nextIntake)
        setNotes(nextNotes)
      })
      .catch((cause) => active && setError(cause.code ?? cause.message))
    return () => {
      active = false
    }
  }, [chartId, actor.uid])

  // Opening a chart is an access event. The ref keeps StrictMode's double
  // effect run from logging it twice.
  const logged = useRef(null)
  useEffect(() => {
    if (!chart || logged.current === chart.id) return
    logged.current = chart.id
    recordAuditEvent({
      action: AUDIT_ACTIONS.viewChart,
      targetCollection: "patients",
      targetId: chart.id,
      targetLabel: `${chart.firstName} ${chart.lastName}`.trim(),
    })
  }, [chart])

  const current = useMemo(() => (notes ? currentPrescriptions(notes) : []), [notes])
  const signedNotes = notes?.filter((note) => note.status === "signed") ?? []
  // The last signed weight, or the intake's if no note has one yet; the
  // editor says which ("since last note" / "since intake").
  const noteWeight = signedNotes.find((note) => note.vitals?.weightLb)?.vitals.weightLb ?? null
  const lastWeight = noteWeight ?? (Number(intake?.vitals?.currentWeightLb) || null)
  const lastWeightSource = noteWeight ? "note" : "intake"

  // Addenda per signed note, for the timeline. Recounted when the signed
  // set changes or a note view closes (it may have added one).
  const [addendaCounts, setAddendaCounts] = useState({})
  const [countsVersion, setCountsVersion] = useState(0)
  const signedKey = signedNotes.map((note) => note.id).join(",")
  useEffect(() => {
    if (!signedKey) return
    let active = true
    countAmendments(chartId, signedKey.split(","))
      .then((counts) => active && setAddendaCounts(counts))
      .catch((cause) => console.error("Addenda count failed:", cause.code ?? cause.message))
    return () => {
      active = false
    }
  }, [chartId, signedKey, countsVersion])

  const startNote = async (type) => {
    setCreating(type)
    setCreateError(null)
    try {
      const prefill = type === "consultation" ? { sections: { pertinentHistory: historyFromIntake(intake) } } : {}
      const note = await createDraftNote(chartId, type, actor, prefill)
      setNotes((existing) => [note, ...(existing ?? [])])
      setOpenNote(note)
    } catch (cause) {
      setCreateError(cause?.code === "permission-denied" ? "Your role can't do this." : "Couldn't start a note. Try again.")
    } finally {
      setCreating(null)
    }
  }

  const afterEditor = async () => {
    setOpenNote(null)
    await reload()
  }

  if (error)
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Patient chart" />
        <div className="rounded-2xl border border-ink-950/10 bg-white p-6 text-center">
          <h2 className="font-semibold text-ink-950">Could not load this chart</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
        </div>
      </div>
    )

  if (chart === undefined)
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Patient chart" />
        <div className="h-64 animate-pulse rounded-2xl bg-ink-950/5" />
      </div>
    )

  if (chart === null)
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Patient chart" />
        <div className="rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl text-ink-950">This chart doesn't exist</h2>
          <p className="mt-2 text-sm text-ink-950/60">It may be for an applicant who hasn't been admitted.</p>
          <Link to="/admin/patients" className="mt-5 inline-block text-sm font-semibold text-accent-text hover:underline">
            Back to patients
          </Link>
        </div>
      </div>
    )

  const name = `${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient"
  const age = ageFrom(chart.dateOfBirth)
  const demographics = intake?.demographics ?? {}
  const vitals = intake?.vitals ?? {}
  const intakeBmi = bmi(vitals.heightFeet, vitals.heightInches, vitals.currentWeightLb)
  const canWrite = isClinicalRole(actor.role) && chart.status === "active"
  const draftOpen = openNote?.status === "draft"

  return (
    <div className="pb-6">
      <PageHeader title="Patient chart" />

      <Link
        to="/admin/patients"
        className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:text-ink-950"
      >
        <ChevronLeftIcon className="size-4" />
        Patients
      </Link>

      <header className="mt-3 rounded-2xl border border-ink-950/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-serif text-3xl text-ink-950">{name}</h2>
          {chart.status === "inactive" && (
            <span className="rounded-full bg-ink-950/10 px-2.5 py-0.5 text-xs font-medium text-ink-950/60">Inactive</span>
          )}
        </div>
        <p className="mt-2 text-sm text-ink-950/65">
          {[age !== null && `${age} years`, chart.sexAssignedAtBirth, demographics.phone, demographics.email]
            .filter(Boolean)
            .join(", ")}
        </p>
        <p className="mt-1 text-sm text-ink-950/50">
          Admitted {asDate(chart.admittedAt)?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {chart.admittedBy?.name ? ` by ${chart.admittedBy.name}` : ""}
        </p>
        {chart.status === "inactive" && (
          <p className="mt-3 rounded-lg bg-paper-100 px-3 py-2 text-sm text-ink-950/70">
            This chart is inactive because the applicant is no longer admitted. It's kept as a record. Re-admit them from
            Applicants to write new notes.
          </p>
        )}
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* Notes first on a phone, where the provider is most likely writing. */}
        <div className="order-first lg:order-last">
          <Card
            title="Notes"
            fill
            action={
              canWrite && (
                <div className="flex gap-1.5">
                  {["consultation", "progress"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={Boolean(creating)}
                      onClick={() => startNote(type)}
                      className="cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50"
                    >
                      {creating === type ? "Starting…" : type === "consultation" ? "New consultation" : "New progress note"}
                    </button>
                  ))}
                </div>
              )
            }
          >
            {createError && (
              <p role="alert" className="mb-3 text-sm text-brand-dark">
                {createError}
              </p>
            )}
            {!notes ? (
              <p className="text-sm text-ink-950/50">Loading notes…</p>
            ) : notes.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-950/55 lg:my-auto">
                No notes yet.{canWrite ? " Start with a consultation." : ""}
              </p>
            ) : (
              <ol className="-mx-2 divide-y divide-ink-950/10">
                {notes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => setOpenNote(note)}
                      className="block w-full cursor-pointer rounded-xl px-2 py-3 text-left transition-colors duration-150 hover:bg-paper-50"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-950">{NOTE_TYPE_LABELS[note.type]}</span>
                        <span className="text-sm text-ink-950/55">{formatDay(note.visitDate)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[note.status]}`}>
                          {note.status === "draft" ? "Draft, only you can see it" : "Signed"}
                        </span>
                        {addendaCounts[note.id] > 0 && (
                          <span className="text-xs text-ink-950/55">
                            {addendaCounts[note.id]} {addendaCounts[note.id] === 1 ? "addendum" : "addenda"}
                          </span>
                        )}
                      </span>
                      {note.status === "signed" && (
                        <span className="mt-0.5 block text-xs text-ink-950/50">{signerLine(note.signedBy, note.signedAt)}</span>
                      )}
                      {note.sections?.plan && (
                        <span className="mt-1 line-clamp-2 block text-sm text-ink-950/70">Plan: {note.sections.plan}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Current prescriptions">
            {current.length === 0 ? (
              <p className="text-sm text-ink-950/55">None. Prescriptions appear here once a note that adds one is signed.</p>
            ) : (
              <ul className="space-y-2 text-sm text-ink-950">
                {current.map((rx) => (
                  <li key={rx.id}>{prescriptionLine({ ...rx, action: "start" }).replace(/^Start /, "")}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="From the intake"
            action={
              intake && (
                <button
                  type="button"
                  onClick={() => setShowIntake(true)}
                  className="cursor-pointer text-xs font-semibold text-accent-text hover:underline"
                >
                  View full intake
                </button>
              )
            }
          >
            {!intake ? (
              <p className="text-sm text-ink-950/55">The intake record for this chart couldn't be found.</p>
            ) : (
              <dl className="divide-y divide-ink-950/[0.07] text-sm">
                <SummaryRow
                  label="Goal"
                  value={vitals.goalWeightLb ? `${vitals.goalWeightLb} lbs` : vitals.weightLossGoalRange}
                />
                <SummaryRow
                  label="Weight, height"
                  value={[
                    vitals.currentWeightLb && `${vitals.currentWeightLb} lbs`,
                    vitals.heightFeet && `${vitals.heightFeet} ft ${vitals.heightInches || 0} in`,
                    intakeBmi && `BMI ${intakeBmi}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
                <SummaryRow label="Conditions" value={list(intake.medicalHistory?.conditions)} />
                <SummaryRow label="Medications" value={intake.medicalHistory?.medications} />
                <SummaryRow label="Allergies" value={intake.medicalHistory?.allergies} />
                <SummaryRow label="Surgeries" value={intake.medicalHistory?.surgeries} />
                <SummaryRow label="Medication interest" value={medicationInterestLabel(intake.medicalHistory?.medicationInterest)} />
                <SummaryRow label="Family history" value={list(intake.familyHistory?.conditions)} />
                <SummaryRow
                  label="Lifestyle"
                  value={[intake.socialHistory?.tobacco, intake.socialHistory?.alcohol, intake.socialHistory?.exerciseFrequency]
                    .filter(Boolean)
                    .join(", ")}
                />
              </dl>
            )}
          </Card>
        </div>
      </div>

      {openNote && draftOpen && (
        <NoteEditor
          chart={chart}
          intake={intake}
          note={openNote}
          current={current}
          lastWeight={lastWeight}
          lastWeightSource={lastWeightSource}
          actor={actor}
          onClose={afterEditor}
          onSigned={afterEditor}
          onDiscarded={afterEditor}
        />
      )}
      {openNote && !draftOpen && (
        <NoteView chart={chart} intake={intake} note={openNote} actor={actor} onClose={() => {
            setOpenNote(null)
            setCountsVersion((version) => version + 1)
          }}
        />
      )}

      <ApplicantModal record={showIntake ? intake : null} onClose={() => setShowIntake(false)} canReview={false} audit />
    </div>
  )
}
