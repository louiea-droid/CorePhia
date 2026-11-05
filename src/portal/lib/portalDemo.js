// Portal demo mode, like the admin's: development only (import.meta.env.DEV is
// false in a production build, so none of this can run there) and only when
// Firebase isn't configured. Open /account?demoPortal=unpaid (or another
// scenario below) to see the portal as a pretend patient. The scenario sticks
// for the tab, so moving between portal pages keeps it. "Choose" pretends to
// pay: back on the portal, the chart turns into a member a few seconds later,
// the way Stripe's notice would land.

import { addDays, fromTampa, tampaParts } from "../../admin/calendar/calendarMath.js"

const DAY = 86400000
const now = Date.now()
const member = (plan, extra = {}) => ({
  plan,
  status: "active",
  source: "stripe",
  since: new Date(now - 40 * DAY),
  currentPeriodEnd: new Date(now + 18 * DAY),
  cancelAtPeriodEnd: false,
  ...extra,
})

// visits: "booked" (a visit with the provider in 3 days), "past" (one
// completed visit, nothing booked) or none; unread: a care-team reply not yet
// opened. Every member scenario also has 3 weights, 2 conversations and an update.
export const DEMO_SCENARIOS = {
  unpaid: { label: "Just admitted, not paid", chart: { status: "active", formPlan: "Core" } },
  member: { label: "Paying member", visits: "booked", unread: true, chart: { status: "active", membership: member("Core Complete") } },
  nothingBooked: { label: "Member, nothing booked", chart: { status: "active", membership: member("Core", { since: new Date(now - 5 * DAY) }) } },
  ending: { label: "Member, cancelling", visits: "past", chart: { status: "active", membership: member("Core", { cancelAtPeriodEnd: true }) } },
  pastDue: { label: "Payment problem", visits: "booked", unread: true, chart: { status: "active", membership: member("Core", { status: "pastDue" }) } },
  manual: { label: "Member marked by staff", visits: "past", chart: { status: "active", membership: { plan: "Core", status: "active", source: "manual", since: new Date(now - 10 * DAY) } } },
  ended: { label: "Membership ended", chart: { status: "active", membership: member("Core", { status: "ended", currentPeriodEnd: new Date(now - 3 * DAY) }) } },
  closed: { label: "Discharged", chart: { status: "inactive" } },
}

const KEY = "corephia-portal-demo"
const fromUrl = () => {
  if (typeof window === "undefined") return null
  const asked = new URLSearchParams(window.location.search).get("demoPortal")
  try {
    if (asked && DEMO_SCENARIOS[asked]) sessionStorage.setItem(KEY, asked)
    return sessionStorage.getItem(KEY)
  } catch {
    return asked
  }
}

export const portalDemo = import.meta.env.DEV && !import.meta.env.VITE_FIREBASE_API_KEY ? fromUrl() : null

export const DEMO_USER = { uid: "demo-patient", email: "jordan@example.com" }
export const DEMO_LINK = { intakeId: "demo-chart", firstName: "Jordan" }

let chart = portalDemo ? { id: DEMO_LINK.intakeId, ...DEMO_SCENARIOS[portalDemo].chart } : null
const listeners = new Set()

export function listenDemoChart(onChange) {
  listeners.add(onChange)
  onChange(chart)
  return () => listeners.delete(onChange)
}

// Pretend Checkout: "pay" now, and let the notice land 3 seconds after the
// patient is back on the portal, so "Confirming your payment" shows first.
export function demoCheckout(plan) {
  try {
    sessionStorage.setItem(`${KEY}-paid`, plan)
  } catch {
    // Without storage the demo just stays on the plan choice.
  }
  return "/account?checkout=done"
}

if (portalDemo) {
  let paid = null
  try {
    paid = sessionStorage.getItem(`${KEY}-paid`)
    sessionStorage.removeItem(`${KEY}-paid`)
  } catch {
    // ignore
  }
  if (paid)
    setTimeout(() => {
      chart = { ...chart, membership: member(paid, { since: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * DAY) }) }
      listeners.forEach((listener) => listener(chart))
    }, 3000)
}

export function demoBillingPortal() {
  window.alert("Demo: in the real portal this opens Stripe's billing page, where the patient changes their card, sees receipts or cancels.")
  return window.location.href
}

export function switchDemoScenario(name) {
  try {
    sessionStorage.setItem(KEY, name)
  } catch {
    // ignore
  }
  window.location.assign(`/account?demoPortal=${name}`)
}

// Sample data for the portal's readers (patientAuth, messageStore, visitStore).
const scenario = portalDemo ? DEMO_SCENARIOS[portalDemo] : {}
const daysAgo = (days) => new Date(now - days * DAY)
const isoDaysAgo = (days) => daysAgo(days).toISOString().slice(0, 10)

export function demoVisits() {
  if (scenario.visits === "booked") {
    const day = addDays(tampaParts(new Date(now)).day, 3)
    return [{ id: "demo-visit", start: fromTampa(day, "10:30"), minutes: 30, discipline: "medical", staffRole: "provider", status: "scheduled" }]
  }
  if (scenario.visits === "past") return [{ id: "demo-visit", start: daysAgo(14), minutes: 30, discipline: "medical", staffRole: "provider", status: "completed" }]
  return []
}

export const demoProgress = () => ({
  entries: [
    { id: "demo-w1", source: "visit", date: isoDaysAgo(42), weightLb: 201, systolic: 128, diastolic: 82, heartRate: 74 },
    { id: "demo-w2", source: "visit", date: isoDaysAgo(21), weightLb: 196, systolic: 124, diastolic: 80, heartRate: 72 },
    { id: "demo-w3", source: "home", date: isoDaysAgo(2), weightLb: 192 },
  ],
  baseline: { source: "baseline", currentWeightLb: "201", goalWeightLb: "180", heightFeet: "5", heightInches: "9" },
})

export const demoUpdates = () => [
  {
    id: "demo-update",
    createdAt: daysAgo(4),
    author: { name: "Taylor Reed", role: "dietitian" },
    body: "Good progress this month. We're keeping your plan the same and adding a fifth day of activity. A new meal guide is on its way this week.",
  },
]

// Opening a conversation marks it read, as the real one does.
let topics = [
  {
    id: "demo-snack",
    subject: "Swapping the evening snack",
    status: "open",
    lastFrom: "staff",
    lastMessageAt: daysAgo(1),
    patientReadAt: scenario.unread ? daysAgo(3) : daysAgo(0.5),
  },
  { id: "demo-walking", subject: "Starting the exercise plan", status: "open", lastFrom: "patient", lastMessageAt: daysAgo(6), patientReadAt: daysAgo(6) },
]
const topicListeners = new Set()

export function listenDemoTopics(onChange) {
  topicListeners.add(onChange)
  onChange(topics)
  return () => topicListeners.delete(onChange)
}

export function demoMarkRead(topicId) {
  topics = topics.map((topic) => (topic.id === topicId ? { ...topic, patientReadAt: new Date() } : topic))
  topicListeners.forEach((listener) => listener(topics))
}

const staff = { kind: "staff", name: "Taylor Reed", role: "dietitian" }
const DEMO_MESSAGES = {
  "demo-snack": [
    { id: "m1", from: { kind: "patient" }, createdAt: daysAgo(2), body: "Can I swap my evening snack for something with less sugar?" },
    { id: "m2", from: staff, createdAt: daysAgo(1), body: "Greek yogurt with berries works well. Let's check in at your next visit." },
  ],
  "demo-walking": [{ id: "m3", from: { kind: "patient" }, createdAt: daysAgo(6), body: "Is walking after dinner enough for now?" }],
}
export const demoMessages = (topicId) => DEMO_MESSAGES[topicId] ?? []
