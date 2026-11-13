// The words of every email the site sends: the new-form alert and the
// receipt. Edit here, then redeploy the function. Health details never go in
// an email. Patient emails after admission come from Elation (2026-11-13).
const SITE = "https://corephia.com"
// No sign-off line of our own: Google Workspace appends the CorePhia footer
// (logo, phone, site) to everything info@ sends (Gmail admin, Compliance,
// Append footer). Keep PHONE in the text anyway, in case that footer changes.
// Same number as SUPPORT_PHONE in src/lib/siteContact.js; change both together.
const PHONE = "+1 (866) 849-2673"
// Who hears about each new intake (Louie, 2026-11-04). Add dr.dan@corephia.com
// once that mailbox exists.
export const INTAKE_ALERT_TO = ["providermd@corephia.com"]

// A headline, paragraphs, the button, then any paragraphs after it.
function layout({ title, paragraphs, button, after = [] }) {
  const text = [title, ...paragraphs, ...(button ? [`${button.label}: ${button.url}`] : []), ...after].join("\n\n")
  // A white card on the site's paper-50 background, with a brand-blue band on
  // top and a serif headline (Georgia: the site's Fraunces doesn't load in
  // Gmail). Tables, not divs, so Outlook lays it out too (it drops the
  // rounded corners).
  const p = (body) => `<p style="margin:0 0 16px">${body}</p>`
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7fb">
<tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #dde3ee;border-radius:16px;border-collapse:separate;overflow:hidden">
<tr><td height="5" style="height:5px;line-height:5px;font-size:0;background:#3b5bdb">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0d1a3d">
<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;font-weight:normal;color:#0d1a3d">${title}</h1>
${paragraphs.map(p).join("\n")}
${button ? `<p style="margin:24px 0 16px"><a href="${button.url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">${button.label}</a></p>` : ""}
${after.map(p).join("\n")}
</td></tr>
</table>
</td></tr>
</table>`
  return { text, html }
}

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
        subject: "Welcome to CorePhia, we received your form",
        ...layout({
          title: "Welcome to CorePhia!",
          paragraphs: [
            "We're glad you're here! We've received your form, and taking that first step matters.",
            "Our care team is reviewing your answers. If the program looks like a good fit, we'll reach out to set up your first visit and send you an invite to your patient portal.",
            "For your privacy, this email doesn't include any of your answers.",
            `Questions? Call us at ${PHONE} or email info@corephia.com.`,
          ],
        }),
      }
    default:
      throw new Error(`Unknown email kind: ${mail.kind}`)
  }
}
