// The words of every email the site sends: the new-form alert and the
// receipt. Edit here, then redeploy the function. Health details never go in
// an email. Patient emails after admission come from Elation (2026-11-13).
import { layout, renderTemplate } from "./emailRender.js"
import { DEFAULT_TEMPLATES } from "./emailDefaults.js"

const SITE = "https://corephia.com"
// No sign-off line of our own: Google Workspace appends the CorePhia footer
// (logo, phone, site) to everything info@ sends (Gmail admin, Compliance,
// Append footer). The card shell and PHONE live in emailRender.js.
// Who hears about each new intake (Louie, 2026-11-04). Add dr.dan@corephia.com
// once that mailbox exists.
export const INTAKE_ALERT_TO = ["providermd@corephia.com"]

export function buildEmail(mail) {
  switch (mail.kind) {
    case "newIntake":
      return {
        to: INTAKE_ALERT_TO,
        subject: "New patient form received",
        ...layout({
          title: "New patient form",
          paragraphs: [
            "A new patient form was submitted on the CorePhia website.",
            `Received: ${new Date(mail.receivedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" })} (Tampa time)`,
            "Sign in to the CorePhia admin to review it. For patient privacy, this email does not include any patient details.",
          ],
          button: { label: "Open Applicants", url: `${SITE}/admin/applicants` },
        }),
      }
    // The patient's receipt for their intake. Nothing from their answers.
    case "intakeReceipt":
      return {
        to: mail.to,
        ...renderTemplate(DEFAULT_TEMPLATES.find((d) => d.purpose === "welcome"), { firstName: mail.firstName }),
      }
    default:
      throw new Error(`Unknown email kind: ${mail.kind}`)
  }
}
