// Sends every email in emails.js to ONE test address, through the same Gmail
// account the Cloud Function uses. Not deployed (firebase.json ignores it).
//
//   cd functions
//   $env:SMTP_PASSWORD="the app password"; node send-test.js you@corephia.com
//
// The password stays in that terminal window only. Close it afterwards.
import nodemailer from "nodemailer"
import { buildEmail } from "./emails.js"

const to = process.argv[2]
const pass = process.env.SMTP_PASSWORD
if (!to || !to.includes("@")) throw new Error("Give the test address: node send-test.js you@corephia.com")
if (!pass) throw new Error('Set the app password first: $env:SMTP_PASSWORD="..."')

// Same sender as index.js.
const LOGIN = "info@corephia.com"
const FROM = "CorePhia <info@corephia.com>"
const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: LOGIN, pass } })
await transport.verify()
console.log("Signed in to Gmail as", LOGIN)

const samples = [
  { kind: "invite", chartId: "test-chart", inviteId: "test-invite" },
  { kind: "update" },
  { kind: "message" },
  { kind: "staff" },
  { kind: "newIntake", receivedAt: new Date().toISOString() },
  { kind: "intakeReceipt" },
]
for (const sample of samples) {
  // Every email goes to the test address, whoever it would really go to.
  const email = { ...buildEmail({ ...sample, to }), to }
  await transport.sendMail({ from: FROM, replyTo: LOGIN, ...email, subject: `[TEST] ${email.subject}` })
  console.log("Sent:", sample.kind, "-", email.subject)
}
