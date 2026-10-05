import { getApp, getApps, initializeApp } from "firebase/app"
import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth"
import { doc, getDoc, getFirestore } from "firebase/firestore"
import { setPatientSessionHint } from "./patientSessionHint"

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isConfigured = Boolean(config.apiKey && config.projectId)

// Separate module from admin/lib/firebase.js (rather than sharing it) so the public
// site's login panel never pulls in the admin bundle, and vice versa. Both call
// getApps() first because Firebase throws if initializeApp() runs twice against
// the same config — harmless here since neither bundle loads unless its own
// entry point (this file, or admin) is actually reached.
const app = isConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null
const auth = app ? getAuth(app) : null
const db = app ? getFirestore(app) : null

export function watchPatientUser(onChange) {
  if (!auth) {
    onChange(null)
    return () => {}
  }
  return onAuthStateChanged(auth, (user) => {
    setPatientSessionHint(Boolean(user))
    onChange(user)
  })
}

// Set the hint the instant each action succeeds, rather than relying solely
// on watchPatientUser's listener — that only updates once something is
// actively calling it (currently only Account.jsx, on mount), so a person
// who signs in and navigates away before Account finishes mounting would
// otherwise keep getting the sign-in panel despite genuinely having a session.

export async function signInPatient(email, password) {
  if (!auth) throw new Error("Firebase is not configured.")
  const credential = await signInWithEmailAndPassword(auth, email, password)
  setPatientSessionHint(true)
  return credential.user
}

// The patientAccounts/{uid} doc that links this login to an intake record.
// Written only by the server or the console (see firestore.rules). null =
// not linked yet, which includes old self sign-up docs with no intakeId.
export async function getMyPortalLink(uid) {
  if (!db) return null
  const snap = await getDoc(doc(db, "patientAccounts", uid))
  const data = snap.data()
  if (!data?.intakeId) return null
  return { intakeId: data.intakeId, firstName: (data.firstName ?? "").trim() }
}

export async function resetPatientPassword(email) {
  if (!auth) throw new Error("Firebase is not configured.")
  await sendPasswordResetEmail(auth, email)
}

export async function signOutPatient() {
  if (auth) await signOut(auth)
  setPatientSessionHint(false)
}
