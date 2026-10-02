import { useMemo, useState } from "react"
import { loadIntakeRecords } from "../lib/firebase"
import { inputClass, labelClass } from "../patients/noteUi"

const nameOf = (record) => `${record.demographics?.firstName ?? ""} ${record.demographics?.lastName ?? ""}`.trim()

// Pick a patient or applicant by name: a search box until one is chosen, then
// a chip with Change. Used by the booking dialog and the To-do form. Intake
// records (not declined) load the first time the search box is used.
// value / onChange: { intakeId, patientName, patientKind }.
export default function PatientPicker({ value, onChange, label = "Patient or applicant", optional = false, canChange = true }) {
  const [records, setRecords] = useState(null)
  const [search, setSearch] = useState("")

  const load = () => {
    if (records) return
    loadIntakeRecords()
      .then((all) => setRecords(all.filter((record) => record.status !== "declined")))
      .catch((cause) => {
        console.error("Patient list failed:", cause.code ?? cause.message)
        setRecords([])
      })
  }

  const matches = useMemo(() => {
    if (!records || !search.trim()) return []
    const needle = search.trim().toLowerCase()
    return records.filter((record) => nameOf(record).toLowerCase().includes(needle)).slice(0, 8)
  }, [records, search])

  const pick = (record) =>
    onChange({ intakeId: record.id, patientName: nameOf(record), patientKind: record.status === "admitted" ? "patient" : "applicant" })

  if (value.intakeId)
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-950/10 bg-white px-3 py-2">
        <p className="min-w-0 truncate text-sm text-ink-950">
          <span className="font-medium">{value.patientName || "Unnamed"}</span>
          {value.patientKind && <span className="text-ink-950/50">, {value.patientKind}</span>}
        </p>
        {canChange && (
          <button
            type="button"
            onClick={() => {
              onChange({ intakeId: "", patientName: "", patientKind: "" })
              setSearch("")
            }}
            className="shrink-0 cursor-pointer text-xs font-semibold text-accent-text hover:underline"
          >
            Change
          </button>
        )}
      </div>
    )

  return (
    <div>
      <label className="block">
        <span className={labelClass}>
          {label}
          {optional && " (optional)"}
        </span>
        <input
          value={search}
          onFocus={load}
          onChange={(event) => {
            load()
            setSearch(event.target.value)
          }}
          placeholder={records || !search ? "Search by name" : "Loading…"}
          autoComplete="off"
          // Enter picks the first match. It never submits a form the picker
          // sits in (the To-do form), which would save without the patient.
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            if (matches[0]) pick(matches[0])
          }}
          className={inputClass}
        />
      </label>
      {search.trim() && records && (
        <ul className="mt-1.5 overflow-hidden rounded-lg border border-ink-950/10 bg-white">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-950/55">No patient or applicant matches "{search.trim()}".</li>
          ) : (
            matches.map((record) => {
              const name = nameOf(record)
              const kind = record.status === "admitted" ? "patient" : "applicant"
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => pick(record)}
                    className="flex w-full cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-left text-sm text-ink-950 transition-colors duration-150 hover:bg-accent-dark/10 focus-visible:bg-accent-dark/10 focus-visible:outline-none"
                  >
                    <span className="truncate">{name || "Unnamed"}</span>
                    <span className="shrink-0 text-xs text-ink-950/50 capitalize">{kind}</span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
