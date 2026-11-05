import { getFunctions, httpsCallable } from "firebase/functions"
import { app } from "./patientAuth"
import { demoBillingPortal, demoCheckout, portalDemo } from "./portalDemo"

// The Stripe-facing Cloud Functions. Each returns a hosted page's URL to send
// the browser to (Checkout for a new plan, the billing portal for a member).
const call = async (name, data) => {
  if (!app) throw new Error("Firebase is not configured.")
  const result = await httpsCallable(getFunctions(app, "us-central1"), name)(data)
  return result.data.url
}

export const startCheckout = async (plan) => (portalDemo ? demoCheckout(plan) : call("startCheckout", { plan }))
export const openBillingPortal = async () => (portalDemo ? demoBillingPortal() : call("openBillingPortal"))
