import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import WeightChart from "../../components/WeightChart"
import { series, summary, vitalsText } from "../../lib/progressMath"
import { deleteWeighIn, getMyProgress } from "../lib/patientAuth"
import LogWeightForm from "./LogWeightForm"

const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

function changeLine(changeLb) {
  if (changeLb == null) return null
  if (changeLb === 0) return "Same as when you started"
  return `${changeLb < 0 ? "Down" : "Up"} ${Math.abs(changeLb)} lbs since you started`
}

// The portal's Track progress box: visit weights and the patient's own
// weigh-ins on one chart, visit BP and heart rate, and logging a weigh-in.
// `compact` (the Overview): the headline numbers and a link to the full page.
export default function PortalProgress({ intakeId, compact = false }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null) // { attempt, data } | { attempt, failed }
  const [logging, setLogging] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [removing, setRemoving] = useState(false)
  const dialogRef = useRef(null)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    let live = true
    getMyProgress(intakeId).then(
      (data) => live && setResult({ attempt, data }),
      (cause) => {
        console.error("Could not load progress:", cause.code ?? cause.message)
        if (live) setResult({ attempt, failed: true })
      },
    )
    return () => {
      live = false
    }
  }, [intakeId, attempt])

  // Keep the last answer on screen while a reload (after logging or deleting)
  // is in flight, so the box and its open history don't flicker shut.
  const current = result
  const reload = () => setAttempt((n) => n + 1)
  const entries = current?.data?.entries ?? []
  const points = series(entries)
  const numbers = current?.data ? summary(entries, current.data.baseline) : null
  const visits = entries.filter((entry) => entry.source === "visit").sort((a, b) => b.date.localeCompare(a.date))
  const weighIns = entries.filter((entry) => entry.source === "home").sort((a, b) => b.date.localeCompare(a.date))

  useEffect(() => {
    if (deleting && !dialogRef.current?.open) dialogRef.current?.showModal()
  }, [deleting])

  // One delete at a time: a second click while the first is saving would be
  // refused (it's already deleted) and show a false error.
  const confirmDelete = async () => {
    if (removing) return
    setRemoving(true)
    try {
      await deleteWeighIn(intakeId, deleting.id)
      setDeleteError(null)
      reload()
    } catch {
      setDeleteError("Couldn't delete that weigh-in. Try again.")
    }
    setRemoving(false)
    dialogRef.current?.close()
  }

  return (
    <section id="progress" aria-labelledby="progress-heading" className="scroll-mt-24 rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="progress-heading" className="font-serif text-2xl text-ink-950">
          Track progress
        </h2>
        {compact ? (
          <Link
            to="/account/progress"
            className="rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-200 hover:bg-paper-100"
          >
            View progress
          </Link>
        ) : (
          current?.data &&
          !logging && (
          <button
            type="button"
            onClick={() => setLogging(true)}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
          >
            Log your weight
          </button>
          )
        )}
      </div>

      {logging && (
        <LogWeightForm
          intakeId={intakeId}
          onCancel={() => setLogging(false)}
          onSaved={() => {
            setLogging(false)
            reload()
          }}
        />
      )}

      {!current ? (
        <p className="mt-6 text-sm text-ink-950/60">Loading your progress…</p>
      ) : current.failed ? (
        <div className="mt-6">
          <p className="text-ink-950/75">We couldn't load your progress.</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 cursor-pointer rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
          >
            Try again
          </button>
        </div>
      ) : !entries.length ? (
        <p className="mt-6 max-w-prose text-ink-950/70">Your weight from each visit will show here. You can also log your own weigh-ins.</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            {numbers.latestLb != null && <p className="font-serif text-4xl text-ink-950">{numbers.latestLb} lbs</p>}
            <div className="space-y-0.5 text-sm text-ink-950/70">
              {changeLine(numbers.changeLb) && <p>{changeLine(numbers.changeLb)}</p>}
              {numbers.toGoalLb != null && (
                <p>{numbers.toGoalLb === 0 ? "You've reached your goal weight" : `${numbers.toGoalLb} lbs to your goal`}</p>
              )}
            </div>
          </div>
          {!compact && <WeightChart points={points} goalLb={numbers.goalLb} />}

          {!compact && visits.length + weighIns.length > 0 && (
            <div className="mt-2">
              {visits.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-ink-950">From your visits</h3>
                  <ul className="mt-2 divide-y divide-ink-950/10 text-sm">
                    {visits.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap justify-between gap-x-4 py-2.5">
                        <span className="text-ink-950/70">{dayLabel(entry.date)}</span>
                        <span className="text-ink-950">{vitalsText(entry)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {weighIns.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-ink-950">Your weigh-ins</h3>
                  {deleteError && (
                    <p role="alert" className="mt-2 text-sm text-brand-dark">
                      {deleteError}
                    </p>
                  )}
                  <ul className="mt-2 divide-y divide-ink-950/10 text-sm">
                    {weighIns.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 py-2.5">
                        <span className="text-ink-950/70">{dayLabel(entry.date)}</span>
                        <span className="flex items-center gap-4">
                          <span className="text-ink-950">{entry.weightLb} lbs</span>
                          <button
                            type="button"
                            onClick={() => setDeleting(entry)}
                            className="cursor-pointer text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:text-brand-dark"
                          >
                            Delete
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* The browser's own modal dialog: Escape closes it, focus stays inside
          and returns to the Delete button afterwards. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="delete-weigh-in-title"
        onClose={() => setDeleting(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white p-6 shadow-2xl backdrop:bg-ink-950/50"
      >
        <p id="delete-weigh-in-title" className="font-serif text-xl text-ink-950">
          Delete this weigh-in?
        </p>
        <p className="mt-2 text-sm text-ink-950/70">Your care team will still see that it was deleted.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:bg-paper-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={removing}
            onClick={confirmDelete}
            className="cursor-pointer rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {removing ? "Deleting…" : "Delete"}
          </button>
        </div>
      </dialog>
    </section>
  )
}
