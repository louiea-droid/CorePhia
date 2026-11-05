import { getFunctions, httpsCallable } from "firebase/functions"
import { app } from "./patientAuth"

// The Stripe-facing Cloud Functions. Each returns a hosted page's URL to send
// the browser to (Checkout for a new plan, the billing portal for a member).
const call = async (name, data) => {
  if (!app) throw new Error("Firebase is not configured.")
  const result = await httpsCallable(getFunctions(app, "us-central1"), name)(data)
  return result.data.url
}

export const startCheckout = (plan) => call("startCheckout", { plan })
export const openBillingPortal = () => call("openBillingPortal")
