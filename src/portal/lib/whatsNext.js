// The portal Overview's "What's next" card: the most useful reminder first, then up to two more.
// New replies are not a reminder: the Messages card just below already marks them (Louie, 2026-11-05).
import { tampaParts, TIME_ZONE } from "../../admin/lib/calendarMath.js"

const DAY = 86400000
const WEIGH_IN_AFTER_DAYS = 7
const OVER = ["cancelled", "completed", "noShow"]

const asDate = (v) => {
  const d = v?.toDate ? v.toDate() : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
const role = (staffRole) => (staffRole === "provider" || staffRole === "admin" ? "provider" : staffRole === "dietitian" ? "dietitian" : "care team")
const fmt = (date, options) => new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, ...options }).format(date)
const clock = (d) => fmt(d, { hour: "numeric", minute: "2-digit" })
const dayUtc = (day) => Date.UTC(...day.split("-").map((n, i) => (i === 1 ? n - 1 : +n)))

export function whatsNext({ membership, chartStatus, visits = [], updates = [], lastSeenUpdateId, progress = [], now }) {
  const closed = chartStatus === "inactive"
  const today = tampaParts(now).day
  const live = visits.filter((v) => !OVER.includes(v.status) && v.start.getTime() + v.minutes * 60000 > now.getTime())
  live.sort((a, b) => a.start - b.start)
  const next = live[0]
  const isToday = next && tampaParts(next.start).day === today
  const latestWeighIn = progress.reduce((m, p) => (p.date > m ? p.date : m), "")
  const daysSince = latestWeighIn ? Math.round((dayUtc(today) - dayUtc(latestWeighIn)) / DAY) : 0

  const periodEnd = membership?.currentPeriodEnd && asDate(membership.currentPeriodEnd)
  const list = []
  const add = (applies, reminder) => applies && list.push(reminder())
  add(membership?.status === "pastDue", () => ({ kind: "pastDue", title: "We couldn't take your last payment. Update your card.", action: "billing" }))
  add(isToday, () => ({ kind: "visitToday", title: `Your visit is today at ${clock(next.start)} with your ${role(next.staffRole)}`, action: "message-us" }))
  add(next && !isToday, () => ({
    kind: "nextVisit",
    title: `Your next visit: ${fmt(next.start, { weekday: "long", month: "long", day: "numeric" })} at ${clock(next.start)} with your ${role(next.staffRole)}`,
    action: "message-us",
  }))
  add(updates.length > 0 && updates[0].id !== lastSeenUpdateId, () => ({ kind: "newUpdate", title: "Your care team posted an update", action: "updates" }))
  add(!closed && daysSince > WEIGH_IN_AFTER_DAYS,() => ({ kind: "weighIn", title: `Time for a weigh-in. Your last one was ${daysSince} days ago.`, action: "log-weight" }))
  add(membership?.status === "active" && membership.cancelAtPeriodEnd && periodEnd, () => ({
    kind: "ending",
    title: `Your membership ends on ${fmt(periodEnd, { month: "long", day: "numeric", year: "numeric" })}`,
    action: "billing",
  }))

  const everBooked = visits.some((v) => v.status !== "cancelled" && v.status !== "noShow")
  const fallback = closed
    ? {
        kind: "closed",
        title: `Your program with CorePhia is closed.${periodEnd ? ` Your membership ends on ${fmt(periodEnd, { month: "long", day: "numeric", year: "numeric" })}.` : ""}`,
        action: "message-us",
      }
    : everBooked
    ? { kind: "nextVisitUnbooked", title: "Our team will contact you when it's time for your next visit.", action: "message-us" }
    : { kind: "firstVisit", title: "Our team will contact you to book your first visit.", action: "message-us" }

  return list.length ? { main: list[0], more: list.slice(1, 3) } : { main: fallback, more: [] }
}

// "Seen" for updates is per device (spec): the id of the newest update the
// patient has had open on the Updates page.
const SEEN_UPDATE_KEY = "corephia-portal-seen-update"

export function seenUpdateId() {
  try {
    return localStorage.getItem(SEEN_UPDATE_KEY)
  } catch {
    return null
  }
}

export function markUpdatesSeen(updates) {
  try {
    if (updates[0]) localStorage.setItem(SEEN_UPDATE_KEY, updates[0].id)
  } catch {
    // Without storage the update reminder simply stays on.
  }
}
