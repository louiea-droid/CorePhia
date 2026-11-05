// Portal demo mode, like the admin's: development only (import.meta.env.DEV is
// false in a production build, so none of this can run there) and only when
// Firebase isn't configured. Open /account?demoPortal=unpaid (or another
// scenario below) to see the portal as a pretend patient. The scenario sticks
// for the tab, so moving between portal pages keeps it. "Choose" pretends to
// pay: back on the portal, the chart turns into a member a few seconds later,
// the way Stripe's notice would land.

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

export const DEMO_SCENARIOS = {
  unpaid: { label: "Just admitted, not paid", chart: { status: "active", formPlan: "Core" } },
  member: { label: "Paying member", chart: { status: "active", membership: member("Core Complete") } },
  ending: { label: "Member, cancelling", chart: { status: "active", membership: member("Core", { cancelAtPeriodEnd: true }) } },
  pastDue: { label: "Payment problem", chart: { status: "active", membership: member("Core", { status: "pastDue" }) } },
  manual: { label: "Member marked by staff", chart: { status: "active", membership: { plan: "Core", status: "active", source: "manual", since: new Date(now - 10 * DAY) } } },
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
