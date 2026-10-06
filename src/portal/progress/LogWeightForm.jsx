import { useState } from "react"
import { withinDays } from "../../lib/progressMath"
import { logWeight } from "../lib/patientAuth"

const isoDay = (date) => date.toLocaleDateString("en-CA")
const field =
  "w-full rounded-xl border border-ink-950/15 bg-white px-3 py-2.5 text-ink-950 outline-none transition-colors duration-200 focus:border-ink-950/45"

export default function LogWeightForm({ intakeId, onSaved, onCancel }) {
  // Fixed when the form opens, so the window doesn't shift while it's open.
  const [{ today, earliest }] = useState(() => ({ today: isoDay(new Date()), earliest: isoDay(new Date(Date.now() - 30 * 86_400_000)) }))
  const [weight, setWeight] = useState("")
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const weightLb = Number(weight)
    if (!weight || !Number.isFinite(weightLb) || weightLb < 50 || weightLb > 800) {
      return setError("Check the number. Weights between 50 and 800 lbs can be saved.")
    }
    if (!withinDays(date, today, 30)) return setError("Pick a date in the last 30 days.")
    setBusy(true)
    setError(null)
    try {
      await logWeight(intakeId, { date, weightLb: Math.round(weightLb * 10) / 10 })
      onSaved()
    } catch {
      setError("Couldn't save your weigh-in. Try again.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 rounded-2xl bg-paper-100 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-950/75">Weight (lbs)</span>
          <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-950/75">Date</span>
          <input type="date" value={date} min={earliest} max={today} onChange={(event) => setDate(event.target.value)} className={field} />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-dark">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold text-ink-950/70 transition-colors duration-200 hover:bg-paper-200"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
