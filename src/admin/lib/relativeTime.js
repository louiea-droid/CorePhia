import { useEffect, useState } from "react"

// "2:56pm" — no leading zero, no space, lowercase meridiem.
export function formatClockTime(iso) {
  const date = new Date(iso)
  const hour24 = date.getHours()
  const hour = hour24 % 12 || 12
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${hour}:${minute}${hour24 < 12 ? "am" : "pm"}`
}

function pluralize(count, unit) {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`
}

// Only meaningful for the most recent handful of rows in a list, and only
// while they're under a day old — a live "3 secs ago" is what makes something
// just submitted visibly new, but that stops being useful (and starts being
// distracting) once it's counting in hours, so it hands off to
// formatClockTime beyond that.
export function formatRelativeTime(iso, now) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 5) return "just now"
  if (seconds < 60) return pluralize(seconds, "sec")
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return pluralize(minutes, "min")
  const hours = Math.round(minutes / 60)
  if (hours < 24) return pluralize(hours, "hour")
  return formatClockTime(iso)
}

// One shared ticking clock for a whole table rather than a timer per row.
// `active` gates the interval so a table with nothing in the relative-time
// window (e.g. page 2 of a list) doesn't re-render every second for no reason.
export function useRelativeTimeClock(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}
