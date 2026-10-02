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

// Same getApps() guard as lib/intakeSubmission.js and lib/patientAuth.js: any
// of these can be live on the same page, and Firebase throws if the default
// app is initialized twice.
const app = isConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null
const db = app ? getFirestore(app) : null

// Matches MESSAGES_COLLECTION in admin/lib/firebase.js, which is what reads these
// back. Written straight from the browser with no sign-in — same reasoning as
// the intake form: a visitor sends this before any account exists, so
// firestore.rules (isWellFormedContactMessage) is the only gate on the way in.
const MESSAGES_COLLECTION = "contactMessages"

export async function sendContactMessage(record) {
  if (!db) throw new Error("Firebase is not configured.")
  const reference = await addDoc(collection(db, MESSAGES_COLLECTION), record)
  return { id: reference.id }
}
