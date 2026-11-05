import { useEffect, useId, useRef, useState } from "react"
import WeightChart from "../../components/WeightChart"
import { series, summary, vitalsText } from "../../lib/progressMath"
import { deleteWeighIn, getMyProgress } from "../lib/patientAuth"
import { listenMyChartStatus } from "../lib/messageStore"
import LogWeightForm from "./LogWeightForm"
import Collapse from "../../components/Collapse"
import { Loading, Skeleton } from "../Skeleton"

const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

function changeLine(changeLb) {
  if (changeLb == null) return null
  if (changeLb === 0) return "Same as when you started"
  return `${changeLb < 0 ? "Down" : "Up"} ${Math.abs(changeLb)} lbs since you started`
}

// The weight line as a soft wave, oldest to newest, heavier higher, drawn on
// an 800 x 120 box: the line stays between y 30 and 92, the fill runs under it.
function wavePath(points) {
  const weights = points.map((point) => point.weightLb)
  const max = Math.max(...weights)
  const min = Math.min(...weights)
  const xy =
    points.length > 1
      ? points.map((point, i) => [(i / (points.length - 1)) * 800, max === min ? 60 : 30 + ((max - point.weightLb) / (max - min)) * 62])
      : [
          [0, 60],
          [800, 60],
        ]
  let line = `M0 ${xy[0][1].toFixed(1)}`
  for (let i = 1; i < xy.length; i++) {
    const mid = ((xy[i - 1][0] + xy[i][0]) / 2).toFixed(1)
    line += ` C${mid} ${xy[i - 1][1].toFixed(1)} ${mid} ${xy[i][1].toFixed(1)} ${xy[i][0].toFixed(1)} ${xy[i][1].toFixed(1)}`
  }
  return { line, area: `${line} L800 120 L0 120 Z` }
}

function Wave({ points }) {
  const id = useId()
  const { line, area } = wavePath(points)
  return (
    <svg viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true" className="mt-6 block h-12 w-full text-accent sm:h-14">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".18" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const signedLb = (lb) => (lb < 0 ? `−${Math.abs(lb)} lbs` : lb > 0 ? `+${lb} lbs` : "No change")

// The Overview's progress, inside the What's next card (WhatsNextCard has no
// bottom padding): the headline numbers, then the weight wave along the
// card's bottom edge, in the flow below the numbers so it never sits under text.
function CompactProgress({ current, points, numbers, onRetry }) {
  const box = "mt-6 px-6 pb-6 sm:px-8 sm:pb-7"
  if (!current)
    return (
      <Loading label="Loading your progress…" className={`${box} flex gap-8`}>
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-12 w-24" />
      </Loading>
    )
  if (current.failed)
    return (
      <p className={`${box} text-sm text-ink-950/75`}>
        We couldn't load your progress.{" "}
        <button type="button" onClick={onRetry} className="cursor-pointer font-semibold text-accent-dark underline underline-offset-2 hover:text-ink-950">
          Try again
        </button>
      </p>
    )
  if (!points.length)
    return <p className={`${box} max-w-prose text-sm leading-relaxed text-ink-950/70`}>Your weight from each visit will show here. You can also log your own weigh-ins.</p>
  const stats = [
    ["Starting weight", numbers.startLb != null && `${numbers.startLb} lbs`],
    ["Latest weight", `${numbers.latestLb} lbs`],
    ["Change", numbers.changeLb != null && signedLb(numbers.changeLb), numbers.changeLb < 0 ? "text-good" : ""],
    ["To your goal", numbers.toGoalLb != null && (numbers.toGoalLb === 0 ? "Reached" : `${numbers.toGoalLb} lbs`)],
  ].filter(([, value]) => value)
  return (
    <div className="mt-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 sm:flex sm:flex-wrap sm:gap-x-10 sm:px-8">
        {stats.map(([label, value, tone = ""]) => (
          <div key={label}>
            <dt className="text-[12.5px] text-ink-950/65">{label}</dt>
            <dd className={`mt-0.5 font-serif text-[22px] leading-tight sm:text-[28px] ${tone || "text-ink-950"}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <Wave points={points} />
    </div>
  )
}

// The portal's Track progress box: visit weights and the patient's own
// weigh-ins on one chart, visit BP and heart rate, and logging a weigh-in.
// `compact` (the Overview): the headline numbers and the weight wave, for
// inside the What's next card. onLoad gets the entries once they load ([] if
// they can't), for the card's weigh-in reminder.
export default function PortalProgress({ intakeId, compact = false, onLoad }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null) // { attempt, data } | { attempt, failed }
  const [logging, setLogging] = useState(false)
  // Only an active chart takes new weigh-ins (firestore.rules isHomeEntry).
  const [active, setActive] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [removing, setRemoving] = useState(false)
  const dialogRef = useRef(null)
  const [deleteError, setDeleteError] = useState(null)

  // The Overview's compact view has no Log button, so it skips the listener.
  useEffect(() => (compact ? undefined : listenMyChartStatus(intakeId, (status) => setActive(status === "active"))), [intakeId, compact])

  useEffect(() => {
    let live = true
    getMyProgress(intakeId).then(
      (data) => {
        if (!live) return
        setResult({ attempt, data })
        onLoad?.(data.entries)
      },
      (cause) => {
        console.error("Could not load progress:", cause.code ?? cause.message)
        if (!live) return
        setResult({ attempt, failed: true })
        onLoad?.([])
      },
    )
    return () => {
      live = false
    }
  }, [intakeId, attempt, onLoad])

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

  if (compact) return <CompactProgress current={current} points={points} numbers={numbers} onRetry={reload} />

  return (
    <section id="progress" aria-labelledby="progress-heading" className="scroll-mt-24 rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="progress-heading" className="font-serif text-2xl text-ink-950">
          Track progress
        </h2>
        {current?.data && active && !logging && (
          <button
            type="button"
            onClick={() => setLogging(true)}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
          >
            Log your weight
          </button>
        )}
      </div>

      <Collapse open={logging}>
        <LogWeightForm
          intakeId={intakeId}
          onCancel={() => setLogging(false)}
          onSaved={() => {
            setLogging(false)
            reload()
          }}
        />
      </Collapse>

      {!current ? (
        <Loading label="Loading your progress…">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="mt-3 h-4 w-56" />
          <Skeleton className="mt-6 h-52 w-full rounded-2xl" />
        </Loading>
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
          <WeightChart points={points} goalLb={numbers.goalLb} animate />

          {visits.length + weighIns.length > 0 && (
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
        className="animate-sheet-in m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white p-6 shadow-2xl backdrop:bg-ink-950/50"
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
