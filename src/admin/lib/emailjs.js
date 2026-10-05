// Sends one email through EmailJS's REST endpoint (no SDK, so no new
// dependency). The public key ships in the admin bundle by design; limit what
// it can do in the EmailJS dashboard (allowed origins, rate limit).
// See docs/client-portal.md for the template it expects.
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export const emailjsConfigured = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)

// Throws with EmailJS's own error text (or "Network error") so the dialog can
// show why it didn't send.
export async function sendEmail(templateParams) {
  if (!emailjsConfigured) throw new Error("Email sending isn't set up yet.")
  let response
  try {
    response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: SERVICE_ID, template_id: TEMPLATE_ID, user_id: PUBLIC_KEY, template_params: templateParams }),
    })
  } catch {
    throw new Error("Network error")
  }
  if (!response.ok) throw new Error((await response.text().catch(() => "")) || `EmailJS error ${response.status}`)
}
