import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { asDate, dueTasks } from "./chartMath"
import { loadCharts, loadNotes } from "./chartStore"
import { formatDay } from "./noteUi"
import PageHeader from "./PageHeader"
import { ApplicantsSkeleton } from "./Skeleton"

// A first consultation has no due date (days is null), so it only ever
// matches the last group.
const GROUPS = [
  { key: "overdue", title: "Overdue", test: (task) => task.days < 0 },
  { key: "today", title: "Today", test: (task) => task.days === 0 },
  { key: "week", title: "Next 7 days", test: (task) => task.days > 0 },
  { key: "first", title: "Waiting for a first consultation", test: (task) => task.kind === "firstConsult" },
]

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`

function whenLabel(task) {
  if (task.kind === "firstConsult") return `Admitted ${formatDay(task.admittedAt)}`
  if (task.days < 0) return `${plural(-task.days, "day")} overdue`
  if (task.days === 0) return "Due today"
  if (task.days === 1) return "Due tomorrow"
  return `Due in ${plural(task.days, "day")}`
}

const taskLabel = (task) =>
  task.kind === "renewal" ? `Renew ${task.medication || "prescription"}` : task.kind === "followUp" ? "Follow-up visit" : "First consultation"

// Today as a local calendar day, YYYY-MM-DD (en-CA formats it that way).
const localToday = () => new Date().toLocaleDateString("en-CA")

// Renewals, follow-ups and first consultations due, worked out from signed
// notes (chartMath.dueTasks). Nothing is ticked off here: signing the note
// that renews or follows up is what clears an item, so this can't drift from
// the charts.
// ponytail: reads every active chart's notes on open, fine for a few hundred
// patients; past that, store the next due date on the chart when a note is signed.
export default function Todo({ actor }) {
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    const today = localToday()
    loadCharts()
      .then((charts) =>
        Promise.all(
          charts
            .filter((chart) => chart.status === "active")
            .map(async (chart) => {
              const name = `${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient"
              const admittedAt = asDate(chart.admittedAt)
              return dueTasks(await loadNotes(chart.id, actor.uid), today).map((task, index) => ({
                ...task,
                id: `${chart.id}-${index}`,
                chartId: chart.id,
                name,
                admittedAt,
              }))
            }),
        ),
      )
      .then((perChart) => active && setTasks(perChart.flat()))
      .catch((cause) => active && setError(cause.code ?? cause.message))
    return () => {
      active = false
    }
  }, [actor.uid])

  const groups = tasks
    ? GROUPS.map((group) => ({
        ...group,
        tasks: tasks
          .filter(group.test)
          .sort((a, b) =>
            group.key === "first" ? (a.admittedAt?.getTime() ?? 0) - (b.admittedAt?.getTime() ?? 0) : a.days - b.days,
          ),
      })).filter((group) => group.tasks.length)
    : null

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="To-do" />

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-6 text-center">
          <h2 className="font-semibold text-ink-950">Could not load the to-do list</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
        </div>
      ) : !groups ? (
        <ApplicantsSkeleton />
      ) : !groups.length ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl text-ink-950">Nothing due this week</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-950/60">
            Prescription renewals and follow-up visits show here a week ahead, and stay until the note that handles them is
            signed.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`todo-${group.key}`} className="rounded-2xl border border-ink-950/10 bg-white p-5">
              <h2
                id={`todo-${group.key}`}
                className={`text-sm font-semibold ${group.key === "overdue" ? "text-brand-dark" : "text-ink-950"}`}
              >
                {group.title} <span className="font-normal text-ink-950/45 tabular-nums">{group.tasks.length}</span>
              </h2>
              <ul className="mt-2 divide-y divide-ink-950/5">
                {group.tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      to={`/admin/patients/${task.chartId}`}
                      className="-mx-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-lg px-2 py-3 outline-none transition-colors duration-150 hover:bg-paper-50 focus-visible:bg-paper-100"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-ink-950">{task.name}</span>
                        <span className="ml-2 text-sm text-ink-950/65">{taskLabel(task)}</span>
                      </span>
                      <span className="text-sm whitespace-nowrap text-ink-950/55">
                        <span className={group.key === "overdue" ? "font-medium text-brand-dark" : undefined}>{whenLabel(task)}</span>
                        {task.due && <span className="ml-2 text-ink-950/40">{formatDay(task.due)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
