import { getApp, getApps, initializeApp } from "firebase/app"
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth"
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore"
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

// Separate module from admin/firebase.js (rather than sharing it) so the public
// site's login panel never pulls in the admin bundle, and vice versa. Both call
// getApps() first because Firebase throws if initializeApp() runs twice against
// the same config — harmless here since neither bundle loads unless its own
// entry point (this file, or admin) is actually reached.
const app = isConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null
const auth = app ? getAuth(app) : null
const db = app ? getFirestore(app) : null

// Writes the one-time patientAccounts/{uid} doc (see firestore.rules) recording the
// account's email. Only ever called right after account creation — the rules
// reject a second write to the same doc, and re-calling this on every sign-in
// would just fail silently for returning users, so callers only invoke it
// where a brand-new uid is known to exist.
async function recordNewPatient(user) {
  if (!db || !user) return
  try {
    // patientAccounts, not patients: `patients` holds the admin's clinical charts.
    await setDoc(doc(db, "patientAccounts", user.uid), { email: user.email, createdAt: serverTimestamp() })
  } catch (cause) {
    // Non-fatal: the Auth account already exists and is fully usable even if
    // this mirror write fails (e.g. rules mismatch, offline).
    console.error("Could not record patient doc:", cause.code ?? cause.message)
  }
}

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
// who signs up and navigates away before Account finishes mounting would
// otherwise keep seeing "Log in" despite genuinely having a session.

export async function signInPatient(email, password) {
  if (!auth) throw new Error("Firebase is not configured.")
  const credential = await signInWithEmailAndPassword(auth, email, password)
  setPatientSessionHint(true)
  return credential.user
}

export async function signUpPatient(email, password) {
  if (!auth) throw new Error("Firebase is not configured.")
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  setPatientSessionHint(true)
  // Not awaited: this is a best-effort mirror write (see recordNewPatient),
  // and the account is already fully usable — no reason to make sign-up feel
  // slower waiting on it, or to block navigation if it's slow to fail.
  recordNewPatient(credential.user)
  return credential.user
}

export async function signInPatientWithGoogle() {
  if (!auth) throw new Error("Firebase is not configured.")
  const credential = await signInWithPopup(auth, new GoogleAuthProvider())
  setPatientSessionHint(true)
  const { user } = credential
  // Google sign-in creates the Auth account on first use rather than going
  // through signUpPatient, so this is the only place that first sign-in is
  // ever observed — creationTime === lastSignInTime marks it.
  if (user.metadata.creationTime === user.metadata.lastSignInTime) {
    recordNewPatient(user)
  }
  return user
}

export async function resetPatientPassword(email) {
  if (!auth) throw new Error("Firebase is not configured.")
  await sendPasswordResetEmail(auth, email)
}

export async function signOutPatient() {
  if (auth) await signOut(auth)
  setPatientSessionHint(false)
}
