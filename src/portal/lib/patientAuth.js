import { getApp, getApps, initializeApp } from "firebase/app"
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
} from "firebase/auth"
import { collection, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, setDoc, where } from "firebase/firestore"
import { isInviteUsable } from "../../lib/inviteMath"
import { setPatientSessionHint } from "../../lib/patientSessionHint"

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
// Written by /portal/setup against a sent invite, or by hand in the console
// (see firestore.rules). null = not linked yet, which includes old self
// sign-up docs with no intakeId.
export async function getMyPortalLink(uid) {
  if (!db) return null
  const snap = await getDoc(doc(db, "patientAccounts", uid))
  const data = snap.data()
  if (!data?.intakeId) return null
  return { intakeId: data.intakeId, firstName: String(data.firstName ?? "").trim() }
}

// The patient's portal updates, newest first. The rules only let a patient
// read updates not removed, so the query must say removed == false. Sorted
// here rather than by Firestore so no composite index is needed; a patient
// has tens of updates at most.
export async function getMyUpdates(intakeId) {
  if (!db) return []
  const snap = await getDocs(query(collection(db, "patients", intakeId, "updates"), where("removed", "==", false)))
  const millis = (value) => value?.toMillis?.() ?? 0
  return snap.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
}

// --- Portal setup (the invite link) ------------------------------------------
// ref = { chartId, inviteId, invite } from the link and getInvite().

// The invite behind a setup link, or null when it's missing, not sent or past
// its 7 days (the rules refuse those reads, which also lands here).
export async function getInvite(chartId, inviteId) {
  if (!db || !chartId || !inviteId) return null
  try {
    const snap = await getDoc(doc(db, "patients", chartId, "invites", inviteId))
    const invite = snap.data()
    return isInviteUsable(invite) ? invite : null
  } catch (cause) {
    if (cause.code === "permission-denied") return null
    throw cause
  }
}

async function linkInvite(user, { chartId, inviteId, invite }) {
  if (await getMyPortalLink(user.uid)) return user
  await setDoc(doc(db, "patientAccounts", user.uid), {
    email: invite.to,
    intakeId: chartId,
    firstName: invite.firstName,
    inviteId,
    linkedAt: serverTimestamp(),
  })
  return user
}

export async function createPortalLogin(ref, password) {
  if (!auth) throw new Error("Firebase is not configured.")
  const { user } = await createUserWithEmailAndPassword(auth, ref.invite.to, password)
  setPatientSessionHint(true)
  return linkInvite(user, ref)
}

export async function connectExistingLogin(ref, password) {
  return linkInvite(await signInPatient(ref.invite.to, password), ref)
}

// Already signed in with the invite's email: just link.
export async function linkCurrentLogin(ref) {
  if (!auth?.currentUser) throw new Error("Not signed in.")
  return linkInvite(auth.currentUser, ref)
}

// --- Forgot password -----------------------------------------------------------

// Firebase's own reset email (only it can make the reset code). The continue
// URL brings them back here after /portal/reset; if the domain isn't on
// Firebase's authorised list, send without it rather than not at all. An
// unknown email is reported as sent, so the form can't be used to probe who
// has a login.
export async function resetPatientPassword(email) {
  if (!auth) throw new Error("Firebase is not configured.")
  try {
    await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/account` })
  } catch (cause) {
    if (cause.code === "auth/user-not-found") return
    if (cause.code !== "auth/unauthorized-continue-uri") throw cause
    await sendPasswordResetEmail(auth, email)
  }
}

// The email a reset code belongs to; throws when it's expired or used.
export async function checkResetCode(code) {
  if (!auth) throw new Error("Firebase is not configured.")
  return verifyPasswordResetCode(auth, code)
}

export async function saveNewPassword(code, password) {
  if (!auth) throw new Error("Firebase is not configured.")
  await confirmPasswordReset(auth, code, password)
}

export async function signOutPatient() {
  if (auth) await signOut(auth)
  setPatientSessionHint(false)
}
