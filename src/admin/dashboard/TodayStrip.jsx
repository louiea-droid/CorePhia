import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { needsReply } from "../../lib/messageMath"
import { loadAppointments } from "../calendar/appointmentStore"
import { TIME_ZONE, addDays, fromTampa, todayInTampa } from "../calendar/calendarMath"
import { useTopics } from "../inbox/useTopics"
import { loadActiveChartNotes } from "../patients/chartStore"
import { asDate, dueTasks } from "../patients/chartMath"
import { canOpen } from "../staff/roles"

const timeLabel = (value) => asDate(value).toLocaleTimeString("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" })

// null while loading, "error" when the read failed, else the number. One
// card failing never blanks the others.
function useCount(load, arg) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let active = true
    load(arg)
      .then((value) => active && setState(value))
      .catch((cause) => {
        console.error("Today strip:", cause.code ?? cause.message)
        if (active) setState("error")
      })
    return () => {
      active = false
    }
  }, [load, arg])
  return state
}

// Module-level so each is one stable function for useCount's effect.
async function loadScheduledToday() {
  const today = todayInTampa()
  const list = await loadAppointments(fromTampa(today), fromTampa(addDays(today, 1)))
  return list.filter((appointment) => appointment.status === "scheduled")
}

async function loadDue(uid) {
  const today = todayInTampa()
  const perChart = await loadActiveChartNotes(uid)
  // A first consultation has no due date; it's counted on the To-do page
  // but isn't "due this week", so the strip counts dated items only.
  const tasks = perChart.flatMap(({ notes }) => dueTasks(notes, today)).filter((task) => task.kind !== "firstConsult")
  return { total: tasks.length, overdue: tasks.filter((task) => task.days < 0).length }
}

// Whole card is the link: the number says what's waiting, the page it opens
// is where it gets done. Hover is a colour change only.
function TodayCard({ to, label, count, caption, urgent = false, captionStrong = false }) {
  const loading = count === null
  const failed = count === "error"
  return (
    <Link
      to={to}
      className="group block rounded-2xl border border-ink-950/10 bg-white p-4 outline-none transition-colors duration-200 hover:bg-paper-50 focus-visible:ring-2 focus-visible:ring-accent-dark"
    >
      <p className="text-sm font-medium text-ink-950/60 transition-colors duration-200 group-hover:text-accent-text">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-12 animate-pulse rounded-full bg-ink-950/10" />
      ) : (
        <p
          className={`mt-1 text-3xl leading-none font-semibold tabular-nums ${urgent && count > 0 ? "text-brand-dark" : "text-ink-950"}`}
        >
          {failed ? "-" : count}
        </p>
      )}
      <p className={`mt-1.5 truncate text-xs ${captionStrong ? "font-semibold text-brand-dark" : "text-ink-950/45"}`}>{failed ? "Could not load" : loading ? " " : caption}</p>
    </Link>
  )
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`

// What needs doing now, ahead of the intake charts: today's visits, what the
// charts say is due, patient messages waiting, applicants to decide on.
// Counts are practice-wide for every role.
export default function TodayStrip({ actor, pending }) {
  const appointments = useCount(loadScheduledToday)
  const due = useCount(loadDue, actor.uid)

  const { topics, error: topicsError } = useTopics({ enabled: canOpen("inbox", actor.role) })
  const replies = topicsError ? "error" : topics ? topics.filter(needsReply).length : null

  const now = new Date()
  const next = Array.isArray(appointments) ? appointments.find((appointment) => asDate(appointment.start) > now) : null

  return (
    <section aria-label="Today" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <TodayCard
        to="/admin/calendar"
        label="Visits today"
        count={appointments === "error" || appointments === null ? appointments : appointments.length}
        caption={next ? `Next: ${timeLabel(next.start)}, ${next.patientName}` : "None left today"}
      />
      <TodayCard
        to="/admin/todo"
        label="Due this week"
        count={due === "error" || due === null ? due : due.total}
        caption={due && due !== "error" && due.overdue ? `${plural(due.overdue, "item")} overdue` : "Renewals and follow-ups"}
        urgent
        captionStrong={Boolean(due && due !== "error" && due.overdue)}
      />
      <TodayCard to="/admin/messages" label="Needs a reply" count={replies} caption="Patient messages waiting" urgent />
      <TodayCard to="/admin/applicants" label="Pending applicants" count={pending} caption="Awaiting an admission decision" />
    </section>
  )
}
