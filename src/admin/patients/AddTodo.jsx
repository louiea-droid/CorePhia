import { useState } from "react"
import DatePicker from "../../components/DatePicker"
import PatientPicker from "../ui/PatientPicker"
import { inputClass, labelClass } from "./noteUi"
import { addTodo } from "./todoStore"

const COMPACT = "px-3 py-2 text-sm"
const NO_PATIENT = { intakeId: "", patientName: "", patientKind: "" }

const VISIBILITY = [
  ["me", "Just me"],
  ["everyone", "Everyone"],
]

export function VisibilityChoice({ value, onChange }) {
  return (
    <div role="group" aria-label="Visible to" className="flex gap-1.5">
      {VISIBILITY.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
            value === key ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/70 hover:bg-ink-950/10"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// Add your own to-do or note: what, optionally which patient and by when, and
// whether it's just for you or the whole team.
export default function AddTodo({ actor, onAdded }) {
  const [text, setText] = useState("")
  const [patient, setPatient] = useState(NO_PATIENT)
  const [due, setDue] = useState("")
  const [visibility, setVisibility] = useState("me")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Remounts the patient picker and date picker so they clear after adding.
  const [round, setRound] = useState(0)

  const add = async (event) => {
    event.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const todo = await addTodo({ text, intakeId: patient.intakeId, patientName: patient.patientName, due, visibility }, actor)
      onAdded(todo)
      setText("")
      setPatient(NO_PATIENT)
      setDue("")
      setRound((value) => value + 1)
    } catch (cause) {
      console.error("Adding a to-do failed:", cause.code ?? cause.message)
      setError(cause?.code === "permission-denied" ? "Your role can't do this." : "Couldn't add this. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={add} aria-labelledby="add-todo" className="mb-4 rounded-2xl border border-ink-950/10 bg-white p-5">
      <h2 id="add-todo" className="text-sm font-semibold text-ink-950">
        Add a to-do
      </h2>
      <label className="mt-3 block">
        <span className="sr-only">What needs doing?</span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          placeholder="What needs doing?"
          className={inputClass}
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <PatientPicker key={`patient-${round}`} value={patient} onChange={setPatient} label="Patient" optional />
        <div>
          <span className={labelClass} aria-hidden="true">
            Due (optional)
          </span>
          <DatePicker key={`due-${round}`} ariaLabel="Due date" value={due} onChange={setDue} triggerClassName={COMPACT} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <VisibilityChoice value={visibility} onChange={setVisibility} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {error && (
            <p role="alert" className="text-sm text-brand-dark">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!text.trim() || busy}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold whitespace-nowrap text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </form>
  )
}
