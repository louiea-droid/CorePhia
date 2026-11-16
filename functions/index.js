// Email, sent through the info@corephia.com Google Workspace mailbox. The
// words live in emails.js. The app password is the SMTP_PASSWORD secret in
// Google Secret Manager. Stripe billing, visit copies and portal emails were
// retired when the practice moved to Elation (2026-11-13).
import { onDocumentCreated } from "firebase-functions/v2/firestore"
import { onCall, HttpsError } from "firebase-functions/v2/https"
import { defineSecret } from "firebase-functions/params"
import { initializeApp } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"
import nodemailer from "nodemailer"
import { buildEmail } from "./emails.js"
import { renderTemplate, PURPOSE_LABELS } from "./emailRender.js"
import { DEFAULT_TEMPLATES } from "./emailDefaults.js"
import { planSend } from "./patientEmail.js"

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
  return transport.sendMail({ from: FROM, replyTo: LOGIN, ...(mail.kind ? buildEmail(mail) : mail) })
}

// Each submitted intake alerts the doctors (INTAKE_ALERT_TO in emails.js) and
// sends the patient a receipt. Neither email carries anything from the intake
// beyond the patient's own address. One failing doesn't stop the other.
// The published default Welcome template, or the built-in one if the read
// fails or none is stored.
async function welcomeTemplate() {
  try {
    const snap = await getFirestore().collection("emailTemplates").where("purpose", "==", "welcome").where("isDefault", "==", true).where("status", "==", "published").get()
    const docs = snap.docs.map((d) => d.data()).sort((x, y) => (y.updatedAt?.toMillis?.() ?? 0) - (x.updatedAt?.toMillis?.() ?? 0))
    if (docs[0]) return docs[0]
  } catch (error) {
    console.error("Welcome template read failed, using the built-in one:", error)
  }
  return DEFAULT_TEMPLATES.find((d) => d.purpose === "welcome")
}

export const notifyNewIntake = onDocumentCreated({ ...OPTIONS, document: "intakeRecords/{recordId}" }, async (event) => {
  await send({ kind: "newIntake", receivedAt: event.time }).catch((error) => console.error("New intake alert failed:", error))
  const demographics = event.data.data().demographics ?? {}
  const to = String(demographics.email ?? "").trim().toLowerCase()
  if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(to)) return console.error("Intake receipt skipped: no valid email on", event.params.recordId)
  await send({ to, ...renderTemplate(await welcomeTemplate(), { firstName: demographics.firstName }) }).catch((error) => console.error("Intake receipt failed:", error))
})

const fail = (plan) => { throw new HttpsError(plan.code, plan.message) }

// Staff send a patient email from a stored template: a decision (accepted or
// declined, once per intake, which also changes the status), a manual email,
// or a test to the caller. Request { mode, templateId, intakeId? }.
export const sendPatientEmail = onCall({ ...OPTIONS }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.")
  const { mode, templateId, intakeId } = request.data ?? {}
  if (typeof templateId !== "string" || !templateId || (mode !== "test" && (typeof intakeId !== "string" || !intakeId))) {
    throw new HttpsError("invalid-argument", "Missing template or applicant.")
  }
  const db = getFirestore()
  const uid = request.auth.uid
  const callerEmail = request.auth.token.email ?? ""
  const [userSnap, tplSnap] = await Promise.all([db.doc(`user/${uid}`).get(), db.doc(`emailTemplates/${templateId}`).get()])
  const role = userSnap.data()?.role
  const sentBy = userSnap.data()?.name || callerEmail
  const template = tplSnap.exists ? tplSnap.data() : null
  const intakeRef = mode === "test" ? null : db.doc(`intakeRecords/${intakeId}`)
  const intakeSnap = intakeRef ? await intakeRef.get() : null
  const intake = intakeSnap?.exists ? intakeSnap.data() : null
  const input = { mode, role, template, callerEmail }
  let plan = planSend({ ...input, intake })
  if (!plan.ok) fail(plan)

  // Decisions claim the intake first, so a double click or a second person
  // gets already-exists instead of a second email.
  if (mode === "decision") {
    await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(intakeRef)).data()
      const again = planSend({ ...input, intake: fresh })
      if (!again.ok) fail(again)
      plan = again
      tx.update(intakeRef, { [`patientEmails.${plan.kind}`]: { state: "sending", templateId, by: uid } })
    })
  }

  try {
    await send({ to: plan.to, ...renderTemplate(template, { firstName: intake?.demographics?.firstName }) })
  } catch (error) {
    console.error("Patient email failed:", error)
    if (mode === "decision") await intakeRef.update({ [`patientEmails.${plan.kind}`]: FieldValue.delete() })
    throw new HttpsError("unavailable", "The email couldn't be sent. Nothing was changed. Try again.")
  }

  const sentAt = new Date()
  if (mode === "decision") {
    await intakeRef.update({
      [`patientEmails.${plan.kind}`]: { state: "sent", templateId, sentAt: FieldValue.serverTimestamp(), sentBy },
      status: plan.nextStatus,
    })
  } else if (mode === "manual") {
    await db.runTransaction(async (tx) => {
      const list = (await tx.get(intakeRef)).data()?.patientEmails?.manual ?? []
      tx.update(intakeRef, { "patientEmails.manual": [...list, { templateId, sentAt: sentAt.toISOString(), sentBy }].slice(-20) })
    })
  }
  await db.collection("auditLog").add({
    actorUid: uid,
    actorEmail: callerEmail,
    action: "send_patient_email",
    targetCollection: mode === "test" ? "emailTemplates" : "intakeRecords",
    targetId: mode === "test" ? templateId : intakeId,
    targetLabel: `${PURPOSE_LABELS[template.purpose]} email`,
    at: FieldValue.serverTimestamp(),
  })
  return { sentAt: sentAt.toISOString(), to: plan.to }
})
