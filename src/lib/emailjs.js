// Sends one email through EmailJS's REST endpoint (no SDK, so no new
// dependency). The public key ships in the admin bundle and, for the staff
// notice, the patient portal by design; limit it in the EmailJS dashboard
// (allowed origins, rate limit).
// See docs/client-portal.md for the templates it expects.
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
// Notice templates: every word and link is typed into the template in
// EmailJS, and the site sends only the recipient's address (nothing at all for
// the staff notice, whose recipient is fixed there too). The public key ships
// to browsers, so a template that took text or a link as a parameter would let
// anyone send CorePhia-branded email saying anything.
export const UPDATE_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_UPDATE_TEMPLATE_ID
export const MESSAGE_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_MESSAGE_TEMPLATE_ID
export const STAFF_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_STAFF_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export const emailjsConfigured = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)
export const updateEmailConfigured = Boolean(SERVICE_ID && UPDATE_TEMPLATE_ID && PUBLIC_KEY)
export const messageEmailConfigured = Boolean(SERVICE_ID && MESSAGE_TEMPLATE_ID && PUBLIC_KEY)
export const staffEmailConfigured = Boolean(SERVICE_ID && STAFF_TEMPLATE_ID && PUBLIC_KEY)

// Throws with EmailJS's own error text (or "Network error") so the dialog can
// show why it didn't send. templateId defaults to the invite template.
export async function sendEmail(templateParams, templateId = TEMPLATE_ID) {
  if (!SERVICE_ID || !PUBLIC_KEY || !templateId) throw new Error("Email sending isn't set up yet.")
  let response
  try {
    response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: SERVICE_ID, template_id: templateId, user_id: PUBLIC_KEY, template_params: templateParams }),
    })
  } catch {
    throw new Error("Network error")
  }
  if (!response.ok) throw new Error((await response.text().catch(() => "")) || `EmailJS error ${response.status}`)
}
