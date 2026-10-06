import { useEffect, useState } from "react"
import WeightChart from "../../components/WeightChart"
import { series, summary, vitalsText } from "../../lib/progressMath"
import { NOTE_TYPE_LABELS, formatDay } from "./noteUi"
import { ensureBaseline, loadProgress } from "./progressStore"

const lbs = (n) => `${n} lbs`

// The chart's Track progress card: what the patient sees in their portal,
// plus deleted home entries, greyed. Reloads when `version` changes (a note
// was signed). Writes the baseline from the intake the first time.
export default function ProgressCard({ chartId, intake, notes, version }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let live = true
    ensureBaseline(chartId, intake)
      .catch((cause) => console.error("Could not save the progress baseline:", cause.code ?? cause.message))
      .then(() => loadProgress(chartId))
      .then(
        (next) => {
          if (!live) return
          setData(next)
          setFailed(false)
        },
        (cause) => {
          console.error("Could not load progress:", cause.code ?? cause.message)
          if (live) setFailed(true)
        },
      )
    return () => {
      live = false
    }
  }, [chartId, intake, version])

  const points = data ? series(data.entries) : []
  const numbers = data ? summary(data.entries, data.baseline) : null
  const listed = data ? [...data.entries].sort((a, b) => b.date.localeCompare(a.date)) : []
  const noteOf = (id) => notes?.find((note) => note.id === id)
  const stats = numbers
    ? [
        ["Starting weight", numbers.startLb != null && lbs(numbers.startLb)],
        ["Latest weight", numbers.latestLb != null && lbs(numbers.latestLb)],
        ["Change", numbers.changeLb != null && `${numbers.changeLb > 0 ? "+" : ""}${lbs(numbers.changeLb)}`],
        ["To goal", numbers.toGoalLb != null && lbs(numbers.toGoalLb)],
        ["BMI", numbers.bmi],
      ].filter(([, value]) => value != null && value !== false)
    : []

  return (
    <section aria-labelledby="progress-heading" className="rounded-2xl border border-ink-950/10 bg-white p-5">
      <h2 id="progress-heading" className="text-sm font-semibold text-ink-950">
        Progress
      </h2>
      <div className="mt-3 text-sm">
        {failed ? (
          <p className="text-brand-dark">Couldn't load progress.</p>
        ) : !data ? (
          <p className="text-ink-950/50">Loading…</p>
        ) : !listed.length ? (
          <p className="text-ink-950/55">No weights yet. Weights from signed notes and the patient's own weigh-ins show here.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {stats.map(([term, value]) => (
                <div key={term}>
                  <dt className="text-xs text-ink-950/55">{term}</dt>
                  <dd className="font-semibold text-ink-950">{value}</dd>
                </div>
              ))}
            </dl>
            <WeightChart points={points} goalLb={numbers.goalLb} />
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((open) => !open)}
              className="mt-3 cursor-pointer text-xs font-semibold text-accent-text hover:underline"
            >
              {showAll ? "Hide entries" : "Show all entries"}
            </button>
            {showAll && (
              <ol className="mt-2 divide-y divide-ink-950/10">
                {listed.map((entry) => {
                  const note = entry.source === "visit" && noteOf(entry.noteId)
                  return (
                    <li key={entry.id} className={`py-2 ${entry.removed ? "opacity-55" : ""}`}>
                      <p className="text-ink-950">
                        <span className="font-medium">{formatDay(entry.date)}</span>
                        {": "}
                        {vitalsText(entry)}
                      </p>
                      <p className="text-xs text-ink-950/55">
                        {entry.source === "home"
                          ? entry.removed
                            ? `Logged at home. Deleted by patient on ${formatDay(entry.removed)}`
                            : "Logged at home"
                          : note
                            ? `From the ${formatDay(note.visitDate)} ${NOTE_TYPE_LABELS[note.type]?.toLowerCase() ?? "note"}`
                            : "From a visit"}
                      </p>
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  )
}
