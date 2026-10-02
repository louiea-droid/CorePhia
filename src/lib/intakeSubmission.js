import { getApp, getApps, initializeApp } from "firebase/app"
import { addDoc, collection, getFirestore } from "firebase/firestore"

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isConfigured = Boolean(config.apiKey && config.projectId)

// Same getApps() guard as lib/patientAuth.js: this module and that one can both
// be live on the same page (the header's login panel and the intake form), and
// Firebase throws if the default app is initialized twice.
const app = isConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null
const db = app ? getFirestore(app) : null

// Matches INTAKE_COLLECTION in admin/lib/firebase.js, which is what reads these back.
const INTAKE_COLLECTION = "intakeRecords"

// Written straight from the browser with no sign-in, because a patient completes
// this before they have an account. firestore.rules is therefore the only
// gatekeeper on the way in — it accepts a create only if the document has this
// form's exact shape and carries its consents, and it still refuses every read,
// update and delete from the client.
export async function sendIntakeRecord(record) {
  if (!db) throw new Error("Firebase is not configured.")
  const reference = await addDoc(collection(db, INTAKE_COLLECTION), record)
  return { id: reference.id }
}
