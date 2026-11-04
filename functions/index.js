// Email, sent through the info@corephia.com Google Workspace mailbox. The
// words and links live in emails.js. The app password is the SMTP_PASSWORD
// secret in Google Secret Manager.
import { onDocumentCreated } from "firebase-functions/v2/firestore"
import { defineSecret } from "firebase-functions/params"
import { initializeApp } from "firebase-admin/app"
import { FieldValue } from "firebase-admin/firestore"
import nodemailer from "nodemailer"
import { buildEmail } from "./emails.js"

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
