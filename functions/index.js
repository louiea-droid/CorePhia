// Email, sent through the info@corephia.com Google Workspace mailbox. The
// words and links live in emails.js. The app password is the SMTP_PASSWORD
// secret in Google Secret Manager.
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore"
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https"
import { defineSecret } from "firebase-functions/params"
import { initializeApp } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"
import nodemailer from "nodemailer"
import Stripe from "stripe"
import { buildEmail } from "./emails.js"
import {
  priceForPlan, membershipFromSubscription, checkoutDecision, cancelOnDischarge, subscriptionIdFromEvent,
  subscriptionConflict, isTransientStripeError, cancelForInactiveChart, LIVE_STATUSES, dischargeCancelAction,
} from "./billing.js"

initializeApp()
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD")
// Signs in and sends as info@; replies go to info@ (a no-reply sender was
// tried and dropped, Louie 2026-11-04).
const LOGIN = "info@corephia.com"
const FROM = "CorePhia <info@corephia.com>"
// Region must match the Firestore database's location (us-central1).
const OPTIONS = { secrets: [SMTP_PASSWORD], region: "us-central1" }

function send(mail) {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: LOGIN, pass: SMTP_PASSWORD.value() },
  })
  return transport.sendMail({ from: FROM, replyTo: LOGIN, ...buildEmail(mail) })
}

// Each new mail/{id} document the site queues (firestore.rules checks who may
// queue which kind, and to whom), then marks it sent or error.
export const sendMail = onDocumentCreated({ ...OPTIONS, document: "mail/{mailId}" }, async (event) => {
  const ref = event.data.ref
  try {
    await send(event.data.data())
    await ref.update({ state: "sent", sentAt: FieldValue.serverTimestamp() })
  } catch (error) {
    console.error("Email failed:", error)
    await ref.update({ state: "error", error: String(error.message).slice(0, 300) })
  }
})

// Each submitted intake alerts the doctors (INTAKE_ALERT_TO in emails.js) and
// sends the patient a receipt. Neither email carries anything from the intake
// beyond the patient's own address. One failing doesn't stop the other.
export const notifyNewIntake = onDocumentCreated({ ...OPTIONS, document: "intakeRecords/{recordId}" }, async (event) => {
  await send({ kind: "newIntake", receivedAt: event.time }).catch((error) => console.error("New intake alert failed:", error))
  const to = String(event.data.data().demographics?.email ?? "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return console.error("Intake receipt skipped: no valid email on", event.params.recordId)
  await send({ kind: "intakeReceipt", to }).catch((error) => console.error("Intake receipt failed:", error))
})

// ---------------------------------------------------------------------------
// Membership billing through Stripe (spec: docs/superpowers/specs/
// 2026-11-05-stripe-membership-billing-design.md). Stripe gets the patient's
// name, email, plan and the chart id, never anything medical. Both secrets
// live in Secret Manager.
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY")
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET")
const REGION = "us-central1"
const CALLABLE = { region: REGION, cors: ["https://corephia.com", /^http:\/\/localhost(:\d+)?$/], secrets: [STRIPE_SECRET_KEY] }
// Fixed here, never taken from the caller.
const SUCCESS_URL = "https://corephia.com/account?checkout=done"
const RETURN_URL = "https://corephia.com/account"
// How long a failing discharge cancellation keeps being retried before it is
// left to staff (the error log names the chart).
const DISCHARGE_RETRY_MS = 24 * 60 * 60 * 1000

const db = () => getFirestore()
const stripeClient = () => new Stripe(STRIPE_SECRET_KEY.value())
const validDate = (d) => d instanceof Date && !Number.isNaN(d.getTime())
// Period end of a Stripe subscription: on the item from API 2025-03-31, on the subscription before.
const periodEnd = (sub) => new Date((sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end) * 1000)

// The signed-in patient's chart id, from the login link made by the portal invite.
async function linkedChartId(auth) {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in first.")
  const account = await db().doc(`patientAccounts/${auth.uid}`).get()
  const chartId = account.data()?.intakeId
  if (!chartId) throw new HttpsError("permission-denied", "This login isn't linked to a patient record.")
  return chartId
}

async function portalUrl(stripe, customer) {
  const session = await stripe.billingPortal.sessions.create({ customer, return_url: RETURN_URL })
  return { url: session.url }
}

// Ends a discharged patient's membership: a past-due subscription is cancelled
// at once (stops Stripe's card retries), a paid-up one at the end of the paid
// month (dischargeCancelAction in billing.js), and emails them once per
// subscription, claimed on billing/{chartId}.cancelEmailedFor. Safe to repeat;
// throws so the caller's retry runs it again.
async function endMembership(stripe, chartId, sub) {
  const action = dischargeCancelAction(sub)
  if (action === "now") sub = await stripe.subscriptions.cancel(sub.id)
  else if (action === "periodEnd") sub = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true })
  // Already over (cancelled now, or on a retry after that): the email says so.
  const endedNow = sub.status === "canceled"
  const endsOn = endedNow ? new Date((sub.ended_at ?? sub.canceled_at ?? Date.now() / 1000) * 1000) : periodEnd(sub)
  if (!validDate(endsOn)) return console.error("Membership cancelled, but no valid period end, email skipped, chart", chartId, sub.id)
  const billingRef = db().doc(`billing/${chartId}`)
  const to = await db().runTransaction(async (tx) => {
    const billing = (await tx.get(billingRef)).data() ?? {}
    if (billing.cancelEmailedFor === sub.id) return null
    if (!billing.email) return ""
    tx.set(billingRef, { cancelEmailedFor: sub.id }, { merge: true })
    return billing.email
  })
  if (to === "") return console.error("Membership cancelled, but no email on file, chart", chartId)
  if (!to) return
  try {
    await send({ kind: "membershipCancelled", to, endsOn, endedNow })
  } catch (error) {
    console.error("Membership cancelled email failed, will retry, chart", chartId, error)
    await billingRef.update({ cancelEmailedFor: FieldValue.delete() })
    throw error
  }
}

async function liveSubscriptions(stripe, customer) {
  const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 100 })
  return subs.data.filter((s) => LIVE_STATUSES.includes(s.status))
}

// Portal plan choice: returns a Stripe Checkout URL for that plan, or the
// billing-portal URL when the patient already has a membership.
export const startCheckout = onCall(CALLABLE, async (request) => {
  const chartId = await linkedChartId(request.auth)
  const chartSnap = await db().doc(`patients/${chartId}`).get()
  const chart = chartSnap.exists ? chartSnap.data() : null
  const decision = checkoutDecision(chart, chart?.membership)
  if (decision === "refuse") throw new HttpsError("permission-denied", "Your record isn't open for a membership.")
  const price = priceForPlan(request.data?.plan)
  if (!price) throw new HttpsError("invalid-argument", "Unknown plan.")

  const stripe = stripeClient()
  const billingRef = db().doc(`billing/${chartId}`)
  let customer = (await billingRef.get()).data()?.customerId

  if (decision === "portal") {
    // A manual membership has no Stripe customer, so there is nothing to manage.
    if (!customer) throw new HttpsError("failed-precondition", "Your membership is already active.")
    return portalUrl(stripe, customer)
  }
  if (customer) {
    // The webhook may not have landed yet (a second click right after paying):
    // ask Stripe directly, so a patient can never hold two live subscriptions.
    if ((await liveSubscriptions(stripe, customer)).length) return portalUrl(stripe, customer)
    // Close any checkout still open in another tab (or left by Back), so only
    // the newest one can be paid.
    const open = await stripe.checkout.sessions.list({ customer, status: "open", limit: 100 })
    for (const s of open.data) {
      try {
        await stripe.checkout.sessions.expire(s.id)
      } catch (error) {
        // It was completed a moment ago: that payment stands, manage it instead.
        if ((await liveSubscriptions(stripe, customer)).length) return portalUrl(stripe, customer)
        throw error
      }
    }
  }

  if (!customer) {
    const email = request.auth.token.email
    // The idempotency key stops a double click from making two customers.
    const created = await stripe.customers.create(
      { name: `${chart.firstName ?? ""} ${chart.lastName ?? ""}`.trim(), email, metadata: { chartId } },
      { idempotencyKey: `customer-${chartId}` },
    )
    customer = created.id
    await billingRef.set({ customerId: customer, email, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    // Card only: the Terms, FAQ and llms.txt say "by card".
    payment_method_types: ["card"],
    line_items: [{ price, quantity: 1 }],
    client_reference_id: chartId,
    subscription_data: { metadata: { chartId } },
    success_url: SUCCESS_URL,
    cancel_url: RETURN_URL,
  })
  return { url: session.url }
})

// "Manage billing": Stripe's hosted customer portal. The chart need not be
// active, so a discharged patient can still cancel or see receipts.
export const openBillingPortal = onCall(CALLABLE, async (request) => {
  const chartId = await linkedChartId(request.auth)
  const customer = (await db().doc(`billing/${chartId}`).get()).data()?.customerId
  if (!customer) throw new HttpsError("failed-precondition", "There is no billing account yet.")
  return portalUrl(stripeClient(), customer)
})

// Stripe's notices. Each one re-reads the subscription and writes the whole
// membership from Stripe's current state. The read happens inside the chart's
// transaction, after the chart is read (and so locked), so two notices for one
// chart run one after the other and the last commit holds Stripe's latest
// state; a retried transaction reads Stripe again. Repeats and out-of-order
// notices are therefore harmless. Failures after the signature check answer
// 500, so Stripe retries.
export const stripeWebhook = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SMTP_PASSWORD] },
  async (req, res) => {
    const stripe = stripeClient()
    let event
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET.value())
    } catch (error) {
      console.error("Stripe webhook signature check failed:", error.message)
      res.status(400).send("Bad signature")
      return
    }
    try {
      const subscriptionId = subscriptionIdFromEvent(event)
      if (!subscriptionId) {
        console.log("Stripe event ignored:", event.type, event.id)
        res.status(200).send("ignored")
        return
      }
      // This first read only finds the chart (metadata.chartId never changes).
      const chartId = (await stripe.subscriptions.retrieve(subscriptionId)).metadata?.chartId
      if (!chartId) {
        console.error("Stripe subscription has no chartId:", subscriptionId, event.id)
        res.status(200).send("no chart")
        return
      }
      const result = await db().runTransaction(async (tx) => {
        const chartRef = db().doc(`patients/${chartId}`)
        const billingRef = db().doc(`billing/${chartId}`)
        const [chartSnap, billingSnap] = await Promise.all([tx.get(chartRef), tx.get(billingRef)])
        if (!chartSnap.exists) return "unknown chart"
        // Stripe's state now, read while this chart is locked (see above).
        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const existing = chartSnap.data().membership
        const m = membershipFromSubscription(sub, existing)
        if (!m) return `no membership (status ${sub.status}: unknown price or unfinished checkout)`
        const current = billingSnap.data()?.subscriptionId
        const conflict = subscriptionConflict(m, existing, current, sub.id)
        // A late notice about an older, ended subscription must not end a newer one.
        if (conflict === "stale") return "stale subscription"
        if (conflict === "duplicate") {
          console.error("Chart", chartId, "has two live Stripe subscriptions:", current, "and", sub.id, "- refund one in Stripe")
        }
        if (!validDate(m.currentPeriodEnd)) {
          console.error("Stripe subscription has no valid period end, field left out:", sub.id)
          delete m.currentPeriodEnd
        }
        if (!validDate(m.since) && typeof m.since?.toDate !== "function") {
          console.error("Stripe subscription has no valid start date, field left out:", sub.id)
          delete m.since
        }
        tx.update(chartRef, { membership: { ...m, updatedAt: FieldValue.serverTimestamp() } })
        tx.set(billingRef, { subscriptionId: sub.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        // Discharged before this notice landed (onChartDischarged saw no
        // membership then): end it here instead, after the transaction.
        if (cancelForInactiveChart(chartSnap.data(), sub)) return { result: "updated, ending (chart inactive)", end: sub }
        return "updated"
      })
      const summary = result?.result ?? result
      // A failure here answers 500, so Stripe resends and this runs again; both steps are safe to repeat.
      if (result?.end) await endMembership(stripe, chartId, result.end)
      console.log("Stripe event", event.type, event.id, "chart", chartId, ":", summary)
      res.status(200).send(summary)
    } catch (error) {
      console.error("Stripe webhook failed:", event.type, event.id, error)
      res.status(500).send("error")
    }
  },
)

// Discharge ("Make inactive") ends the membership. A Stripe one is cancelled
// at the end of the paid month (a past-due one at once): no further charges,
// no refund issued by us.
// That timing is a default until Dr. Antonious decides the refund policy (see
// "Discharge cancels the membership" in the spec above). The webhook then
// records the change on the chart. A manual membership just ends, no email.
// Retried on failure (retry: true): throwing means "try again". Every step is
// safe to repeat; the email is claimed on billing/{chartId}.cancelEmailedFor
// so it goes out once per subscription.
export const onChartDischarged = onDocumentUpdated(
  { region: REGION, document: "patients/{chartId}", retry: true, secrets: [STRIPE_SECRET_KEY, SMTP_PASSWORD] },
  async (event) => {
    const before = event.data.before.data()
    const after = event.data.after.data()
    const chartId = event.params.chartId

    if (cancelOnDischarge(before, after)) {
      if (Date.now() - Date.parse(event.time) > DISCHARGE_RETRY_MS) {
        return console.error("Discharge: gave up retrying for chart", chartId, "- check the subscription and email in Stripe by hand")
      }
      // A Stripe membership on the chart means the webhook has run, and it
      // writes subscriptionId in the same transaction. (Discharged before the
      // first notice: the chart has no membership yet and stripeWebhook ends it.)
      const subscriptionId = (await db().doc(`billing/${chartId}`).get()).data()?.subscriptionId
      if (!subscriptionId) return console.error("Discharge: no Stripe subscription on file for chart", chartId, "- check Stripe by hand")
      try {
        const stripe = stripeClient()
        await endMembership(stripe, chartId, await stripe.subscriptions.retrieve(subscriptionId))
      } catch (error) {
        // A Stripe error that won't fix itself (e.g. already fully cancelled) is
        // left to staff; anything else (network, email, Firestore) is retried.
        if (String(error?.type).startsWith("Stripe") && !isTransientStripeError(error)) {
          return console.error("Discharge: could not cancel the Stripe subscription for chart", chartId, "- cancel it in Stripe by hand:", error)
        }
        throw error
      }
      return
    }

    const manual = after?.membership
    if (before?.status === "active" && after?.status === "inactive" && manual?.source === "manual" && manual.status !== "ended") {
      await event.data.after.ref.update({
        membership: { ...manual, status: "ended", updatedAt: FieldValue.serverTimestamp() },
      })
    }
  },
)
