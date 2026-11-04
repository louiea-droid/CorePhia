// Queues an email: the sendMail Cloud Function (functions/index.js) sends it
// within seconds through the info@corephia.com mailbox. firestore.rules (mail)
// decides who may queue which kind, and to whom; the words live in
// functions/emails.js. Resolves once queued, not once delivered.
import { addDoc, collection, serverTimestamp } from "firebase/firestore"

// Always true now; the dialogs still ask. Remove with the last of EmailJS.
export const emailjsConfigured = true
export const updateEmailConfigured = true
export const messageEmailConfigured = true
export const staffEmailConfigured = true

export const queueMail = (db, mail) => addDoc(collection(db, "mail"), { ...mail, createdAt: serverTimestamp() })
