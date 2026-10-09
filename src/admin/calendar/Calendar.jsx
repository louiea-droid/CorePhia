import { useEffect, useMemo, useRef, useState } from "react"
import AppointmentDialog from "./AppointmentDialog"
import { loadAppointments } from "./appointmentStore"
import { addDays, fromTampa, lanes, monthDays, monthRange, slotTime, tampaParts, todayInTampa, unbookedFollowUps, weekRange } from "./calendarMath"
import { nextFollowUps } from "../patients/chartMath"
import { loadActiveChartNotes, loadStaff } from "../patients/chartStore"
import { DISCIPLINE_LABELS } from "../patients/noteUi"
import PageHeader from "../layout/PageHeader"
import { isClinicalRole, staffDisplayName } from "../staff/roles"

const HOUR_PX = 48
const DAY_START_HOUR = 7
// Discipline colours from the admin tokens only, so dark mode follows.
const TONE = {
  medical: "border-l-accent-dark bg-accent-dark/10",
  dietitian: "border-l-brand bg-brand/10",
  exercise: "border-l-ink-700 bg-ink-950/[0.06]",
}
const DOT = { medical: "bg-accent-dark", dietitian: "bg-brand", exercise: "bg-ink-700" }

const VIEWS = [
  ["week", "Week"],
  ["month", "Month"],
  ["agenda", "Agenda"],
]

const dayLabel = (day, options) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...options })
const timeLabel = (value) =>
  new Date(value.toDate ? value.toDate() : value).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })
const isPhone = () => {
  try {
    return window.matchMedia("(max-width: 639px)").matches
  } catch {
    return false
  }
}

function Chip({ appointment, onOpen, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      className={`block w-full cursor-pointer truncate rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs text-ink-950 transition-colors duration-150 hover:bg-paper-100 ${TONE[appointment.discipline]} ${
        appointment.status === "cancelled" ? "line-through opacity-60" : ""
      }`}
    >
      {!compact && <span className="text-ink-950/60">{timeLabel(appointment.start)} </span>}
      {appointment.patientName}
    </button>
  )
}

function Marker({ followUp, onBook }) {
  return (
    <button
      type="button"
      onClick={() => onBook(followUp)}
      title={`Follow-up due: ${followUp.patientName} (${DISCIPLINE_LABELS[followUp.discipline]})`}
      className="block w-full cursor-pointer truncate rounded-md border border-dashed border-ink-950/30 px-1.5 py-0.5 text-left text-xs text-ink-950/70 transition-colors duration-150 hover:border-accent-dark hover:text-ink-950"
    >
      Follow-up due: {followUp.patientName} ({DISCIPLINE_LABELS[followUp.discipline]})
    </button>
  )
}

function WeekView({ days, today, appointments, markers, onOpen, onBook, onSlot }) {
  const scrollRef = useRef(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = DAY_START_HOUR * HOUR_PX
  }, [])
  return (
    // Fills the space left on the page and clips vertically: only the hours
    // below scroll, so there's never a second scrollbar around them.
    <div className="flex min-h-80 flex-1 flex-col overflow-x-auto overflow-y-hidden rounded-2xl border border-ink-950/10 bg-white">
      <div className="flex min-h-0 min-w-176 flex-1 flex-col">
        <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          {/* Sticky inside the scrolling area, so the header and the hours share one
              width and their column lines match whatever the scrollbar takes. */}
          <div className="sticky top-0 z-10 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-ink-950/10 bg-white">
            <div />
            {days.map((day) => (
              <div key={day} className="space-y-1 border-l border-ink-950/5 px-1.5 py-2">
                <p className={`text-xs font-semibold ${day === today ? "text-accent-text" : "text-ink-950/70"}`}>
                  {dayLabel(day, { weekday: "short", month: "short", day: "numeric" })}
                </p>
                {markers
                  .filter((marker) => marker.date === day)
                  .map((marker) => (
                    <Marker key={`${marker.intakeId}-${marker.discipline}`} followUp={marker} onBook={onBook} />
                  ))}
              </div>
            ))}
          </div>
          <div className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_PX }}>
            <div>
              {Array.from({ length: 24 }, (_, hour) => (
                <p key={hour} className="pr-2 text-right text-[11px] text-ink-950/45" style={{ height: HOUR_PX }}>
                  {new Date(Date.UTC(2000, 0, 1, hour)).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric" })}
                </p>
              ))}
            </div>
            {days.map((day) => {
              const items = appointments
                .filter((appointment) => tampaParts(appointment.start).day === day)
                .map((appointment) => {
                  const startMin = tampaParts(appointment.start).minutes
                  return { appointment, id: appointment.id, startMin, endMin: startMin + appointment.minutes }
                })
              const placed = lanes(items)
              return (
                <div
                  key={day}
                  className="relative border-l border-ink-950/5 bg-[linear-gradient(to_bottom,transparent_47px,rgb(13_26_61/0.06)_47px)] bg-size-[100%_48px]"
                  onClick={(event) => {
                    if (event.target !== event.currentTarget) return
                    onSlot(day, slotTime((event.nativeEvent.offsetY / HOUR_PX) * 60))
                  }}
                >
                  {items.map(({ appointment, id, startMin }) => {
                    const { lane, lanes: count } = placed.get(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpen(appointment)}
                        title={`${appointment.patientName}, ${timeLabel(appointment.start)}, ${appointment.minutes} min, ${appointment.staffName}`}
                        style={{
                          top: (startMin / 60) * HOUR_PX,
                          height: Math.max((appointment.minutes / 60) * HOUR_PX - 2, 20),
                          left: `${(lane / count) * 100}%`,
                          width: `${100 / count}%`,
                        }}
                        className={`absolute cursor-pointer overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs text-ink-950 transition-colors duration-150 hover:bg-paper-100 ${TONE[appointment.discipline]} ${
                          appointment.status === "cancelled" ? "line-through opacity-60" : ""
                        }`}
                      >
                        {/* Under 45 minutes there's room for one line only. */}
                        {appointment.minutes < 45 ? (
                          <span className="block truncate">
                            <span className="font-medium">{appointment.patientName}</span>{" "}
                            <span className="text-ink-950/60">{timeLabel(appointment.start)}</span>
                          </span>
                        ) : (
                          <>
                            <span className="block truncate font-medium">{appointment.patientName}</span>
                            <span className="block truncate text-ink-950/60">
                              {timeLabel(appointment.start)}, {appointment.staffName}
                            </span>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const sameDay = (day) => (appointment) => tampaParts(appointment.start).day === day

// One appointment as a row: the Agenda and the month view's day panel.
function AppointmentRow({ appointment, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      className={`flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-lg border-l-4 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-paper-100 ${TONE[appointment.discipline]} ${
        appointment.status === "cancelled" ? "line-through opacity-60" : ""
      }`}
    >
      <span className="min-w-0 text-ink-950">
        <span className="block truncate font-medium">{appointment.patientName}</span>
        <span className="block truncate text-xs text-ink-950/60">
          {DISCIPLINE_LABELS[appointment.discipline]}, {appointment.staffName}
        </span>
      </span>
      <span className="shrink-0 text-xs whitespace-nowrap text-ink-950/60">
        {timeLabel(appointment.start)}, {appointment.minutes} min
      </span>
    </button>
  )
}

// Click any day to see everything on it in the panel beside the month.
function MonthView({ days, month, today, selected, appointments, markers, onOpen, onBook, onSelect }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-950/10 bg-white">
      <div className="grid grid-cols-7">
        {days.slice(0, 7).map((day) => (
          <p key={day} className="border-b border-ink-950/10 px-1 py-2 text-center text-xs font-semibold text-ink-950/60 sm:px-2 sm:text-left">
            {dayLabel(day, { weekday: "short" })}
          </p>
        ))}
        {days.map((day) => {
          const items = [
            ...markers.filter((marker) => marker.date === day).map((marker) => ({ marker })),
            ...appointments.filter(sameDay(day)).map((appointment) => ({ appointment })),
          ]
          const isSelected = day === selected
          return (
            <div
              key={day}
              onClick={() => onSelect(day)}
              className={`min-h-14 min-w-0 cursor-pointer space-y-1 border-b border-l border-ink-950/5 p-1 transition-colors duration-150 sm:min-h-28 sm:p-1.5 ${
                isSelected
                  ? "bg-accent-dark/10 ring-2 ring-accent-dark/60 ring-inset"
                  : day.slice(0, 7) === month
                    ? "hover:bg-paper-100"
                    : "bg-paper-50 hover:bg-paper-100"
              }`}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(day)
                }}
                aria-pressed={isSelected}
                aria-label={`${dayLabel(day, { weekday: "long", month: "long", day: "numeric" })}, ${items.length} ${items.length === 1 ? "item" : "items"}`}
                className={`flex size-6 cursor-pointer items-center justify-center rounded-full text-xs transition-colors duration-150 ${
                  day === today
                    ? "bg-accent-dark font-semibold text-oncolor"
                    : isSelected
                      ? "font-semibold text-accent-text"
                      : "text-ink-950/55 hover:text-ink-950"
                }`}
              >
                {Number(day.slice(8))}
              </button>
              {/* A phone has no room for chips: a dot per item, details in the panel. */}
              {items.length > 0 && (
                <div aria-hidden="true" className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                  {items.slice(0, 4).map((item) =>
                    item.marker ? (
                      <span key={`d-${item.marker.intakeId}-${item.marker.discipline}`} className="size-1.5 rounded-full border border-ink-950/40" />
                    ) : (
                      <span key={`d-${item.appointment.id}`} className={`size-1.5 rounded-full ${DOT[item.appointment.discipline]}`} />
                    ),
                  )}
                </div>
              )}
              <div className="hidden space-y-1 sm:block">
                {items.slice(0, 3).map((item) =>
                  item.marker ? (
                    <Marker key={`m-${item.marker.intakeId}-${item.marker.discipline}`} followUp={item.marker} onBook={onBook} />
                  ) : (
                    <Chip key={item.appointment.id} appointment={item.appointment} onOpen={onOpen} />
                  ),
                )}
                {items.length > 3 && <p className="text-xs font-medium text-accent-text">+{items.length - 3} more</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Everything on the selected day: appointments, follow-ups still to book,
// and booking on that day.
function DayPanel({ day, today, appointments, markers, onOpen, onBook, onNew }) {
  const booked = appointments.filter(sameDay(day))
  const due = markers.filter((marker) => marker.date === day)
  return (
    <aside aria-label="Selected day" className="rounded-2xl border border-ink-950/10 bg-white p-4 lg:sticky lg:top-20 lg:self-start">
      <h2 className="font-serif text-lg text-ink-950">
        {dayLabel(day, { weekday: "long", month: "long", day: "numeric" })}
        {day === today && <span className="ml-2 align-middle font-sans text-xs font-semibold text-accent-text">Today</span>}
      </h2>
      <p className="mt-0.5 text-xs text-ink-950/55">
        {booked.length === 0 ? "Nothing booked" : `${booked.length} ${booked.length === 1 ? "appointment" : "appointments"}`}
        {due.length > 0 && `, ${due.length} follow-up${due.length === 1 ? "" : "s"} to book`}
      </p>
      <div className="mt-3 space-y-1.5">
        {booked.map((appointment) => (
          <AppointmentRow key={appointment.id} appointment={appointment} onOpen={onOpen} />
        ))}
        {due.map((marker) => (
          <Marker key={`${marker.intakeId}-${marker.discipline}`} followUp={marker} onBook={onBook} />
        ))}
      </div>
      {day >= today && (
        <button
          type="button"
          onClick={() => onNew(day)}
          className="mt-4 w-full cursor-pointer rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark"
        >
          {booked.length ? "Add appointment" : "Book on this day"}
        </button>
      )}
    </aside>
  )
}

// Every day of the month being viewed that has something on it.
function AgendaView({ days, today, appointments, markers, onOpen, onBook }) {
  const withItems = days
    .map((day) => ({
      day,
      markers: markers.filter((marker) => marker.date === day),
      appointments: appointments.filter(sameDay(day)),
    }))
    .filter((entry) => entry.markers.length || entry.appointments.length)
  if (!withItems.length)
    return (
      <div className="rounded-2xl border border-ink-950/10 bg-white p-8 text-center text-sm text-ink-950/60">
        Nothing booked in {dayLabel(days[0], { month: "long" })}.
      </div>
    )
  return (
    <div className="space-y-3">
      {withItems.map((entry) => (
        <section key={entry.day} className="rounded-2xl border border-ink-950/10 bg-white p-4">
          <h2 className={`text-sm font-semibold ${entry.day === today ? "text-accent-text" : "text-ink-950"}`}>
            {dayLabel(entry.day, { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <div className="mt-2 space-y-1.5">
            {entry.markers.map((marker) => (
              <Marker key={`${marker.intakeId}-${marker.discipline}`} followUp={marker} onBook={onBook} />
            ))}
            {entry.appointments.map((appointment) => (
              <AppointmentRow key={appointment.id} appointment={appointment} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// The practice's schedule: appointments plus each patient's follow-ups not
// booked yet (dashed), all in Tampa time. Opens on the viewer's own schedule.
export default function Calendar({ actor }) {
  const today = todayInTampa()
  const [view, setView] = useState(() => (isPhone() ? "agenda" : "week"))
  const [cursor, setCursor] = useState(today)
  // The month view's chosen day. The day panel beside the month always shows
  // it (Louie, 2026-10-02): today to start, and a click on a date switches it.
  const [selected, setSelected] = useState(today)
  const [who, setWho] = useState("mine") // "mine" | "all" | a staff uid
  const [showCancelled, setShowCancelled] = useState(false)
  const [staff, setStaff] = useState([])
  const [appointments, setAppointments] = useState(null)
  const [followUps, setFollowUps] = useState([])
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null) // { appointment } | { prefill }
  const [version, setVersion] = useState(0)

  const range = useMemo(() => {
    if (view === "month") return monthRange(cursor)
    if (view === "agenda") {
      const days = monthDays(cursor)
      return { days, start: fromTampa(days[0]), end: fromTampa(addDays(days.at(-1), 1)) }
    }
    return weekRange(cursor)
  }, [view, cursor])

  useEffect(() => {
    loadStaff(actor.role)
      .then((members) => setStaff(members.filter((member) => isClinicalRole(member.role) && member.role !== "superAdmin")))
      .catch((cause) => console.error("Staff list failed:", cause.code ?? cause.message))
    loadActiveChartNotes(actor.uid)
      .then((perChart) =>
        setFollowUps(
          perChart.flatMap(({ chart, notes }) =>
            nextFollowUps(notes).map((followUp) => ({
              ...followUp,
              intakeId: chart.id,
              patientName: `${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient",
            })),
          ),
        ),
      )
      .catch((cause) => console.error("Follow-ups failed:", cause.code ?? cause.message))
  }, [actor.role, actor.uid, version])

  // Padded 3 days either side so a follow-up near the edge still finds the
  // appointment that books it (calendarMath.matchingAppointment).
  useEffect(() => {
    let active = true
    loadAppointments(fromTampa(addDays(range.days[0], -3)), new Date(range.end.getTime() + 3 * 86_400_000))
      .then((list) => {
        if (!active) return
        setAppointments(list)
        // A load that works clears an earlier failure, so moving to another
        // week (or Today) recovers without reloading the page.
        setError(null)
      })
      .catch((cause) => active && setError(cause.code ?? cause.message))
    return () => {
      active = false
    }
  }, [range, version])

  const inRange = (day) => range.days.includes(day)
  const shown = (appointments ?? []).filter(
    (appointment) =>
      inRange(tampaParts(appointment.start).day) &&
      (showCancelled || appointment.status !== "cancelled") &&
      (who === "all" || appointment.staffUid === (who === "mine" ? actor.uid : who)),
  )
  const markers = appointments
    ? unbookedFollowUps(followUps, appointments).filter(
        (followUp) =>
          inRange(followUp.date) && (who === "all" || actor.role !== "dietitian" || followUp.discipline === "dietitian"),
      )
    : []

  // Month and Agenda step a month at a time, Week a week. Moving to another
  // month selects today if it's in that month, else its 1st.
  const step = (direction) => {
    if (view === "week") return setCursor((day) => addDays(day, direction * 7))
    const next = `${new Date(Date.UTC(+cursor.slice(0, 4), +cursor.slice(5, 7) - 1 + direction, 1)).toISOString().slice(0, 7)}-01`
    setCursor(next)
    setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : next)
  }
  const goToday = () => {
    setCursor(today)
    setSelected(today)
  }
  const title =
    view === "month" || view === "agenda"
      ? dayLabel(`${cursor.slice(0, 7)}-15`, { month: "long", year: "numeric" })
      : `${dayLabel(range.days[0], { month: "short", day: "numeric" })} to ${dayLabel(range.days[range.days.length - 1], { month: "short", day: "numeric", year: "numeric" })}`

  const whoOptions = [
    ["mine", "My schedule"],
    ["all", "Everyone"],
    ...staff.filter((member) => member.uid !== actor.uid).map((member) => [member.uid, staffDisplayName(member)]),
  ]
  const open = (appointment) => setDialog({ appointment })
  const book = (followUp) =>
    setDialog({ prefill: { intakeId: followUp.intakeId, patientName: followUp.patientName, discipline: followUp.discipline, day: followUp.date } })
  const saved = () => {
    setDialog(null)
    setVersion((value) => value + 1)
  }
  const pill = (active) =>
    `cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
      active ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/70 hover:bg-ink-950/10"
    }`

  return (
    <div className="flex h-full flex-col pb-6">
      <PageHeader title="Calendar" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={goToday} className={pill(false)}>
            Today
          </button>
          <button type="button" onClick={() => step(-1)} aria-label="Previous" className={pill(false)}>
            ‹
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next" className={pill(false)}>
            ›
          </button>
          <h2 className="ml-1 font-serif text-lg text-ink-950">{title}</h2>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ prefill: { day: view === "month" && selected >= today ? selected : cursor < today ? today : cursor } })}
          className="cursor-pointer rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark"
        >
          New appointment
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="View" className="flex gap-1.5">
          {VIEWS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={pill(view === value)}>
              {label}
            </button>
          ))}
        </div>
        <span className="mx-1 h-4 w-px bg-ink-950/15" aria-hidden="true" />
        <div role="group" aria-label="Whose schedule" className="flex flex-wrap gap-1.5">
          {whoOptions.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={who === value} onClick={() => setWho(value)} className={pill(who === value)}>
              {label}
            </button>
          ))}
        </div>
        <span className="mx-1 h-4 w-px bg-ink-950/15" aria-hidden="true" />
        <button type="button" aria-pressed={showCancelled} onClick={() => setShowCancelled((value) => !value)} className={pill(showCancelled)}>
          Show cancelled
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-ink-950/10 bg-white p-6 text-center">
          <h2 className="font-semibold text-ink-950">Could not load the calendar</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
          <button
            type="button"
            onClick={() => setVersion((value) => value + 1)}
            className="mt-4 cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark"
          >
            Try again
          </button>
        </div>
      ) : !appointments ? (
        <div className="h-96 animate-pulse rounded-2xl bg-ink-950/5" />
      ) : view === "week" ? (
        <WeekView
          days={range.days}
          today={today}
          appointments={shown}
          markers={markers}
          onOpen={open}
          onBook={book}
          onSlot={(day, time) => setDialog({ prefill: { day, time } })}
        />
      ) : view === "month" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <MonthView
            days={range.days}
            month={cursor.slice(0, 7)}
            today={today}
            selected={selected}
            appointments={shown}
            markers={markers}
            onOpen={open}
            onBook={book}
            onSelect={setSelected}
          />
          <DayPanel
            day={selected}
            today={today}
            appointments={shown}
            markers={markers}
            onOpen={open}
            onBook={book}
            onNew={(day) => setDialog({ prefill: { day } })}
          />
        </div>
      ) : (
        <AgendaView days={range.days} today={today} appointments={shown} markers={markers} onOpen={open} onBook={book} />
      )}

      {dialog && (
        <AppointmentDialog
          appointment={dialog.appointment ?? null}
          prefill={dialog.prefill}
          actor={actor}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </div>
  )
}
