import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import DatePicker from "../../components/DatePicker"
import Select from "../../components/Select"
import { bookAppointment, changeAppointment, loadAppointments, loadChanges } from "./appointmentStore"
import { addDays, changeFor, fromTampa, overlaps, tampaParts, todayInTampa } from "./calendarMath"
import { loadStaff } from "../patients/chartStore"
import { AUDIT_ACTIONS, loadIntakeRecords, recordAuditEvent } from "../lib/firebase"
import { CloseIcon } from "../ui/icons"
import { DISCIPLINE_LABELS, formatStamp, inputClass, labelClass } from "../patients/noteUi"
import { getAdminPortalRoot } from "../ui/portalRoot"
import { ROLE_LABELS, canSeeAppointmentHistory, isClinicalRole } from "../staff/roles"

const COMPACT = "px-3 py-2 text-sm"
const LENGTHS = [15, 30, 45, 60].map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))
const DISCIPLINE_OPTIONS = Object.entries(DISCIPLINE_LABELS).map(([value, label]) => ({ value, label }))
// 6:00 AM to 9:00 PM in 15-minute steps.
const TIMES = Array.from({ length: 61 }, (_, index) => {
  const minutes = 6 * 60 + index * 15
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
  const label = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)).toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  })
  return { value, label }
})
const STATUS_LABELS = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", noShow: "No-show" }
const STALE = "This appointment changed somewhere else. Close it to see the latest."

const whenText = (value) =>
  value
    ? new Date(value.toDate ? value.toDate() : value).toLocaleString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : ""

function historyLine(change) {
  const by = `${change.by?.name ?? "Someone"}, ${formatStamp(change.at)}`
  if (change.kind === "cancelled") return `Cancelled${change.reason ? ` (${change.reason})` : ""}, by ${by}`
  if (change.kind === "completed") return `Marked completed, by ${by}`
  if (change.kind === "noShow") return `Marked no-show, by ${by}`
  if (change.kind === "noteEdited") return `Note changed, by ${by}`
  const parts = []
  if (change.from.start || change.to.start) parts.push(`from ${whenText(change.from.start)} to ${whenText(change.to.start)}`)
  if (change.from.minutes || change.to.minutes) parts.push(`length ${change.from.minutes} to ${change.to.minutes} min`)
  if (change.from.staffName || change.to.staffName) parts.push(`${change.from.staffName} to ${change.to.staffName}`)
  return `Moved ${parts.join(", ")}, by ${by}`
}

function Field({ label, children }) {
  return (
    <div>
      <span className={labelClass} aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  )
}

// Book a new appointment, or view and change an existing one. Every change
// is written with a history entry naming who made it (appointmentStore,
// firestore.rules), so there is no free-form edit of "Added by".
export default function AppointmentDialog({ appointment, prefill = {}, actor, onClose, onSaved }) {
  const isNew = !appointment
  const editable = isNew || appointment.status === "scheduled"
  const startParts = appointment ? tampaParts(appointment.start) : null
  const [form, setForm] = useState(() => ({
    intakeId: appointment?.intakeId ?? prefill.intakeId ?? "",
    patientName: appointment?.patientName ?? prefill.patientName ?? "",
    staffUid: appointment?.staffUid ?? (isClinicalRole(actor.role) && actor.role !== "superAdmin" ? actor.uid : ""),
    staffName: appointment?.staffName ?? (isClinicalRole(actor.role) && actor.role !== "superAdmin" ? actor.name : ""),
    discipline: appointment?.discipline ?? prefill.discipline ?? (actor.role === "dietitian" ? "dietitian" : "medical"),
    day: startParts?.day ?? prefill.day ?? todayInTampa(),
    time: startParts?.time ?? prefill.time ?? "09:00",
    minutes: appointment?.minutes ?? 30,
    note: appointment?.note ?? "",
  }))
  const [staff, setStaff] = useState([])
  const [patients, setPatients] = useState(null)
  const [search, setSearch] = useState("")
  const [sameDay, setSameDay] = useState([])
  const [history, setHistory] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("")
  const closeRef = useRef(null)
  const set = (patch) => setForm((previous) => ({ ...previous, ...patch }))

  useEffect(() => {
    closeRef.current?.focus()
    loadStaff(actor.role)
      .then((members) => setStaff(members.filter((member) => isClinicalRole(member.role) && member.role !== "superAdmin")))
      .catch((cause) => console.error("Staff list failed:", cause.code ?? cause.message))
    if (isNew && !prefill.intakeId) {
      loadIntakeRecords()
        .then((records) => setPatients(records.filter((record) => record.status !== "declined")))
        .catch((cause) => console.error("Patient list failed:", cause.code ?? cause.message))
    }
    if (!isNew && canSeeAppointmentHistory(actor.role)) {
      loadChanges(appointment.id)
        .then(setHistory)
        .catch((cause) => console.error("History failed:", cause.code ?? cause.message))
    }
  }, [actor.role, appointment?.id, isNew, prefill.intakeId])

  // Same-day bookings, for the overlap warning.
  useEffect(() => {
    let active = true
    loadAppointments(fromTampa(form.day), fromTampa(addDays(form.day, 1)))
      .then((list) => active && setSameDay(list))
      .catch(() => active && setSameDay([]))
    return () => {
      active = false
    }
  }, [form.day])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [busy, onClose])

  const start = fromTampa(form.day, form.time)
  const clashes = overlaps({ id: appointment?.id, staffUid: form.staffUid, start, minutes: form.minutes }, sameDay)
  const matches = useMemo(() => {
    if (!patients || !search.trim()) return []
    const needle = search.trim().toLowerCase()
    return patients
      .filter((record) => `${record.demographics?.firstName ?? ""} ${record.demographics?.lastName ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [patients, search])
  const problem = !form.intakeId ? "Choose a patient." : !form.staffUid ? "Choose who the appointment is with." : null

  const fail = (cause, fallback) => {
    console.error("Appointment write failed:", cause.code ?? cause.message)
    setError(cause?.code === "permission-denied" ? (isNew ? "Your role can't do this." : STALE) : fallback)
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const fields = {
      start,
      minutes: Number(form.minutes),
      staffUid: form.staffUid,
      staffName: form.staffName,
      note: form.note.trim(),
    }
    try {
      if (isNew) {
        const saved = await bookAppointment(
          { ...fields, intakeId: form.intakeId, patientName: form.patientName, discipline: form.discipline },
          actor,
        )
        recordAuditEvent({ action: AUDIT_ACTIONS.bookAppointment, targetCollection: "appointments", targetId: saved.id, targetLabel: saved.patientName })
        onSaved(saved)
        return
      }
      const change = changeFor(appointment, fields)
      if (!change) {
        onClose()
        return
      }
      const saved = await changeAppointment(appointment, fields, change, actor)
      recordAuditEvent({ action: AUDIT_ACTIONS.moveAppointment, targetCollection: "appointments", targetId: saved.id, targetLabel: saved.patientName })
      onSaved(saved)
    } catch (cause) {
      fail(cause, "Couldn't save. Nothing was changed. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (status) => {
    setBusy(true)
    setError(null)
    try {
      const saved = await changeAppointment(appointment, { status }, changeFor(appointment, { status }, reason.trim()), actor)
      recordAuditEvent({
        action: status === "cancelled" ? AUDIT_ACTIONS.cancelAppointment : AUDIT_ACTIONS.updateAppointmentStatus,
        targetCollection: "appointments",
        targetId: saved.id,
        targetLabel: saved.patientName,
      })
      onSaved(saved)
    } catch (cause) {
      setCancelling(false)
      fail(cause, "Couldn't update. Nothing was changed. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const staffOptions = staff.map((member) => ({
    value: member.uid,
    label: `${member.name || member.email} (${ROLE_LABELS[member.role]})`,
  }))

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div aria-hidden="true" onClick={() => !busy && onClose()} className="absolute inset-0 bg-scrim/50" />
      <div className="flex h-full items-end justify-center sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isNew ? "Book appointment" : `Appointment for ${appointment.patientName}`}
          className="relative flex max-h-[96dvh] w-full max-w-xl flex-col rounded-t-3xl bg-paper-50 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-950/10 px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <p className="font-serif text-xl text-ink-950">{isNew ? "Book appointment" : appointment.patientName}</p>
              {!isNew && (
                <p className="mt-0.5 text-sm text-ink-950/55">
                  {DISCIPLINE_LABELS[appointment.discipline]}, {STATUS_LABELS[appointment.status]}
                </p>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>

          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
            {isNew && !prefill.intakeId ? (
              <div>
                <label className="block">
                  <span className={labelClass}>Patient or applicant</span>
                  <input
                    value={form.intakeId ? form.patientName : search}
                    onChange={(event) => {
                      set({ intakeId: "", patientName: "" })
                      setSearch(event.target.value)
                    }}
                    placeholder={patients ? "Search by name" : "Loading…"}
                    className={inputClass}
                  />
                </label>
                {!form.intakeId && matches.length > 0 && (
                  <ul className="mt-1 divide-y divide-ink-950/5 rounded-lg border border-ink-950/10 bg-white">
                    {matches.map((record) => {
                      const name = `${record.demographics?.firstName ?? ""} ${record.demographics?.lastName ?? ""}`.trim()
                      return (
                        <li key={record.id}>
                          <button
                            type="button"
                            onClick={() => set({ intakeId: record.id, patientName: name })}
                            className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-ink-950 transition-colors duration-150 hover:bg-paper-100"
                          >
                            {name || "Unnamed"}{" "}
                            <span className="text-ink-950/50">{record.status === "admitted" ? "patient" : "applicant"}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ) : (
              isNew && <p className="text-sm text-ink-950">For {form.patientName}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="With">
                <Select
                  ariaLabel="With"
                  options={staffOptions}
                  value={form.staffUid}
                  onChange={(uid) => {
                    const member = staff.find((entry) => entry.uid === uid)
                    set({ staffUid: uid, staffName: member?.name || member?.email || "" })
                  }}
                  placeholder="Choose"
                  triggerClassName={COMPACT}
                />
              </Field>
              <Field label="Kind of visit">
                {isNew ? (
                  <Select
                    ariaLabel="Kind of visit"
                    options={DISCIPLINE_OPTIONS}
                    value={form.discipline}
                    onChange={(discipline) => set({ discipline })}
                    triggerClassName={COMPACT}
                  />
                ) : (
                  <p className="py-2 text-sm text-ink-950">{DISCIPLINE_LABELS[form.discipline]}</p>
                )}
              </Field>
              <Field label="Date">
                <DatePicker ariaLabel="Date" value={form.day} onChange={(day) => set({ day })} triggerClassName={COMPACT} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Time">
                  <Select ariaLabel="Time" options={TIMES} value={form.time} onChange={(time) => set({ time })} triggerClassName={COMPACT} />
                </Field>
                <Field label="Length">
                  <Select
                    ariaLabel="Length"
                    options={LENGTHS}
                    value={String(form.minutes)}
                    onChange={(minutes) => set({ minutes: Number(minutes) })}
                    triggerClassName={COMPACT}
                  />
                </Field>
              </div>
            </div>
            <p className="text-xs text-ink-950/50">Times are Tampa time.</p>

            {clashes.length > 0 && editable && (
              <p className="rounded-lg bg-paper-100 px-3 py-2 text-sm text-ink-950/75">
                {form.staffName || "This person"} already has {clashes.map((other) => `${other.patientName} at ${tampaParts(other.start).time}`).join(", ")} then.
                You can still book it.
              </p>
            )}

            <label className="block">
              <span className={labelClass}>Note (optional, no clinical details)</span>
              <input value={form.note} maxLength={500} onChange={(event) => set({ note: event.target.value })} className={inputClass} />
            </label>

            {!isNew && (
              <p className="text-xs text-ink-950/55">
                Added by {appointment.addedBy?.name} ({ROLE_LABELS[appointment.addedBy?.role] ?? appointment.addedBy?.role}),{" "}
                {formatStamp(appointment.addedAt)}
              </p>
            )}

            {history && (
              <section>
                <h3 className="text-xs font-semibold tracking-wide text-ink-950/50 uppercase">History</h3>
                {history.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-950/55">No changes since it was added.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm text-ink-950/80">
                    {history.map((change) => (
                      <li key={change.id}>{historyLine(change)}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {cancelling && (
              <label className="block">
                <span className={labelClass}>Reason for cancelling (optional). It stays on record with your name.</span>
                <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} className={inputClass} />
              </label>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-ink-950/10 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
            <div className="flex flex-wrap gap-1.5">
              {cancelling && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCancelling(false)}
                    className="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-50"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus("cancelled")}
                    className="cursor-pointer rounded-full bg-brand-dark px-4 py-2 text-sm font-semibold text-oncolor transition-colors duration-200 hover:bg-ink-950 disabled:opacity-50"
                  >
                    {busy ? "Cancelling…" : "Confirm cancel"}
                  </button>
                </>
              )}
              {!isNew && editable && !cancelling && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCancelling(true)}
                    className="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-50"
                  >
                    Cancel appointment
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus("completed")}
                    className="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-50"
                  >
                    Mark completed
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus("noShow")}
                    className="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-50"
                  >
                    No-show
                  </button>
                </>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {(error || (editable && problem)) && (
                <p role={error ? "alert" : undefined} className={`text-sm ${error ? "text-brand-dark" : "text-ink-950/55"}`}>
                  {error ?? problem}
                </p>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || Boolean(problem)}
                  className="cursor-pointer rounded-full bg-ink-950 px-6 py-2.5 text-sm font-semibold whitespace-nowrap text-paper-50 shadow-lg shadow-ink-950/15 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Saving…" : isNew ? "Book" : "Save changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>,
    getAdminPortalRoot(),
  )
}
