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
const CALLABLE = { region: REGION, cors: ["https://corephia.com", /localhost/], secrets: [STRIPE_SECRET_KEY] }
// Fixed here, never taken from the caller.
const SUCCESS_URL = "https://corephia.com/account?checkout=done"
const RETURN_URL = "https://corephia.com/account"
const LIVE_STATUSES = ["active", "trialing", "past_due"]

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

// Portal plan choice: returns a Stripe Checkout URL for that plan, or the
// billing-portal URL when the patient already has a membership.
export const startCheckout = onCall(CALLABLE, async (request) => {
  const chartId = await linkedChartId(request.auth)
  const chartSnap = await db().doc(`patients/${chartId}`).get()
  const chart = chartSnap.exists ? chartSnap.data() : null
  const decision = checkoutDecision(chart, chart?.membership)
  if (decision === "refuse") throw new HttpsError("permission-denied", "Your record isn't open for a membership.")

  const stripe = stripeClient()
  const billingRef = db().doc(`billing/${chartId}`)
  let customer = (await billingRef.get()).data()?.customerId

  if (decision === "portal") {
    // A manual membership has no Stripe customer, so there is nothing to manage.
    if (!customer) throw new HttpsError("failed-precondition", "Your membership is already active.")
    return portalUrl(stripe, customer)
  }
  // The webhook may not have landed yet (a second click right after paying):
  // ask Stripe directly, so a patient can never hold two live subscriptions.
  if (customer) {
    const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 100 })
    if (subs.data.some((s) => LIVE_STATUSES.includes(s.status))) return portalUrl(stripe, customer)
  }

  const price = priceForPlan(request.data?.plan)
  if (!price) throw new HttpsError("invalid-argument", "Unknown plan.")

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
// membership from Stripe's current state, so repeats and out-of-order events
// are harmless. Failures after the signature check answer 500, so Stripe retries.
export const stripeWebhook = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
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
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const chartId = sub.metadata?.chartId
      if (!chartId) {
        console.error("Stripe subscription has no chartId:", sub.id, event.id)
        res.status(200).send("no chart")
        return
      }
      const result = await db().runTransaction(async (tx) => {
        const chartRef = db().doc(`patients/${chartId}`)
        const billingRef = db().doc(`billing/${chartId}`)
        const [chartSnap, billingSnap] = await Promise.all([tx.get(chartRef), tx.get(billingRef)])
        if (!chartSnap.exists) return "unknown chart"
        const m = membershipFromSubscription(sub, chartSnap.data().membership)
        if (!m) return `no membership (status ${sub.status}: unknown price or unfinished checkout)`
        // A late notice about an older, ended subscription must not end a newer one.
        const current = billingSnap.data()?.subscriptionId
        if (m.status === "ended" && current && current !== sub.id) return "stale subscription"
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
        return "updated"
      })
      console.log("Stripe event", event.type, event.id, "chart", chartId, ":", result)
      res.status(200).send(result)
    } catch (error) {
      console.error("Stripe webhook failed:", event.type, event.id, error)
      res.status(500).send("error")
    }
  },
)

// Discharge ("Make inactive") ends the membership. A Stripe one is cancelled
// at the end of the paid month: no further charges, no refund issued by us.
// That timing is a default until Dr. Antonious decides the refund policy (see
// "Discharge cancels the membership" in the spec above). The webhook then
// records the change on the chart. A manual membership just ends, no email.
export const onChartDischarged = onDocumentUpdated(
  { region: REGION, document: "patients/{chartId}", secrets: [STRIPE_SECRET_KEY, SMTP_PASSWORD] },
  async (event) => {
    const before = event.data.before.data()
    const after = event.data.after.data()
    const chartId = event.params.chartId

    if (cancelOnDischarge(before, after)) {
      const billing = (await db().doc(`billing/${chartId}`).get()).data()
      if (!billing?.subscriptionId) return console.error("Discharge: no Stripe subscription on file for", chartId)
      const sub = await stripeClient().subscriptions.update(billing.subscriptionId, { cancel_at_period_end: true })
      const endsOn = periodEnd(sub)
      if (!validDate(endsOn)) return console.error("Discharge: cancelled, but no valid period end, email skipped:", sub.id)
      if (!billing.email) return console.error("Discharge: cancelled, but no email on file for", chartId)
      await send({ kind: "membershipCancelled", to: billing.email, endsOn })
        .catch((error) => console.error("Membership cancelled email failed:", chartId, error))
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
