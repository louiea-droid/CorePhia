import { initializeApp } from "firebase/app"
import {
  EmailAuthProvider,
  getAuth,
  getMultiFactorResolver,
  multiFactor,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  updatePassword,
  updateProfile,
} from "firebase/auth"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore"
import { isClinicalRole } from "../staff/roles"

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const INTAKE_COLLECTION = "intakeRecords"
export const MESSAGES_COLLECTION = "contactMessages"
export const AUDIT_COLLECTION = "auditLog"
export const USERS_COLLECTION = "user"
export const SITE_EVENTS_COLLECTION = "siteEvents"

export const AUDIT_ACTIONS = {
  viewIntake: "view_intake_record",
  deleteIntake: "delete_intake_record",
  updateIntakeStatus: "update_intake_status",
  viewMessage: "view_contact_message",
  deleteMessage: "delete_contact_message",
  viewChart: "view_patient_chart",
  signNote: "sign_note",
  addAmendment: "add_note_amendment",
  addStaff: "add_staff",
  changeStaffRole: "change_staff_role",
  deleteStaff: "delete_staff_account",
  bookAppointment: "book_appointment",
  moveAppointment: "move_appointment",
  cancelAppointment: "cancel_appointment",
  updateAppointmentStatus: "update_appointment_status",
  sendPortalInvite: "send_portal_invite",
}

// A record with no status field yet (every one submitted before this feature
// existed) reads as pending rather than needing a backfill migration.
export const INTAKE_STATUSES = ["pending", "admitted", "declined"]

export const isConfigured = Boolean(config.apiKey && config.projectId)

// Demo mode exists so the dashboard can be reviewed before a BAA is signed and
// real records exist. import.meta.env.DEV is replaced with `false` at build
// time, so a production bundle cannot reach the seeded branch — the dashboard
// there is unreachable without a real signed-in Firebase user. In dev, ?demo=1
// on an /admin URL also switches it on with the Firebase keys set (kept for
// the tab in sessionStorage; ?demo=0 switches back to live data).
function demoRequested() {
  try {
    const asked = new URLSearchParams(window.location.search).get("demo")
    if (asked === "1") sessionStorage.setItem("corephia-demo-data", "1")
    if (asked === "0") sessionStorage.removeItem("corephia-demo-data")
    return sessionStorage.getItem("corephia-demo-data") === "1"
  } catch {
    return false
  }
}
export const usingSeedData = import.meta.env.DEV && (!isConfigured || demoRequested())

const app = isConfigured ? initializeApp(config) : null
const auth = app ? getAuth(app) : null
const db = app ? getFirestore(app) : null

// For chartStore.js, which keeps the chart/note/staff data functions out of
// this file. config is needed there for the Staff page's second app instance.
export { auth, config, db }

export function watchAdminUser(onChange) {
  if (!auth) {
    onChange(null)
    return () => {}
  }
  return onAuthStateChanged(auth, onChange)
}

export async function signInAdmin(email, password) {
  if (!auth) throw new Error("Firebase is not configured.")
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signOutAdmin() {
  if (auth) await signOut(auth)
}

// Firebase's reset email, coming back to the admin after the CorePhia
// /portal/reset page. If the domain isn't on Firebase's authorised list,
// send without the continue URL rather than not at all.
export async function sendStaffResetEmail(email) {
  try {
    await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/admin` })
  } catch (cause) {
    if (cause.code !== "auth/unauthorized-continue-uri") throw cause
    await sendPasswordResetEmail(auth, email)
  }
}

export async function resetAdminPassword(email) {
  if (!auth) throw new Error("Firebase is not configured.")
  await sendStaffResetEmail(email)
}

// Changing a password needs a fresh sign-in, so the current password is
// checked first. An account with two-step sign-in gets the same
// multi-factor-auth-required error as at sign-in: this returns its resolver
// (finish with completeTotpSignIn, then call updateAdminPassword) or null when
// the password alone was enough.
export async function reauthenticateAdmin(currentPassword) {
  if (!auth?.currentUser) throw new Error("Firebase is not configured.")
  try {
    await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, currentPassword))
    return null
  } catch (error) {
    const resolver = getTotpResolver(error)
    if (resolver) return resolver
    throw error
  }
}

export async function updateAdminPassword(newPassword) {
  if (!auth?.currentUser) throw new Error("Firebase is not configured.")
  await updatePassword(auth.currentUser, newPassword)
}

// The audit trail and "signed in as" always key off the account's email —
// that's the credential Firestore rules check, and it can't be self-edited.
// displayName is purely a friendlier label for the sidebar/account chrome.
export async function updateAdminDisplayName(name) {
  if (!auth?.currentUser) throw new Error("Firebase is not configured.")
  const trimmed = name.trim()
  await updateProfile(auth.currentUser, { displayName: trimmed || null })
  return trimmed || null
}

// --- Second factor ---------------------------------------------------------
// These accounts can open any patient chart, so a leaked or reused password
// should not be enough on its own. TOTP (an authenticator app) rather than SMS:
// nothing to collect but a code, no carrier in the path, and no phone number
// stored against a staff account.
//
// This needs Firebase Authentication with Identity Platform on the project,
// with TOTP switched on. Until that is enabled in the console, enrolment fails
// with auth/operation-not-allowed. Accounts with no second factor sign in
// exactly as before either way — signInAdmin above is deliberately unchanged.

// enrolledFactors on a cached user object doesn't change just because we
// enrolled or removed one — the token has to be refreshed for the new list to
// show up, so callers re-read through this after either operation.
export async function reloadAdminUser() {
  if (!auth?.currentUser) return null
  await auth.currentUser.reload()
  return auth.currentUser
}

export function listEnrolledFactors(user) {
  if (!user) return []
  return multiFactor(user).enrolledFactors
}

export async function startTotpEnrollment() {
  if (!auth?.currentUser) throw new Error("Not signed in.")
  const session = await multiFactor(auth.currentUser).getSession()
  return TotpMultiFactorGenerator.generateSecret(session)
}

export async function finishTotpEnrollment(secret, code, displayName = "Authenticator app") {
  if (!auth?.currentUser) throw new Error("Not signed in.")
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code)
  await multiFactor(auth.currentUser).enroll(assertion, displayName)
}

export async function removeEnrolledFactor(factorUid) {
  if (!auth?.currentUser) throw new Error("Not signed in.")
  await multiFactor(auth.currentUser).unenroll(factorUid)
}

// Firebase reports "this account needs its second factor" by throwing out of
// signInWithEmailAndPassword. That isn't a failed sign-in, it's an unfinished
// one, so this turns that specific error into the resolver the caller needs to
// finish it — and returns null for every other error, which stays a failure.
export function getTotpResolver(error) {
  if (!auth || error?.code !== "auth/multi-factor-auth-required") return null
  return getMultiFactorResolver(auth, error)
}

export async function completeTotpSignIn(resolver, code) {
  const hint = resolver.hints.find((factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID)
  if (!hint) throw new Error("This account's second factor isn't an authenticator app.")
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code)
  await resolver.resolveSignIn(assertion)
}

// The tier comes from a role document at user/{uid}, assigned by hand in
// the Firestore Console — never from anything the browser can choose. This
// decides what the sidebar shows; firestore.rules enforces the same lookup
// independently (and only lets a person read their own document), so a
// tampered client gains nothing. A missing document, a missing db, or a
// denied read (no document = no role assigned) all resolve the same way:
// no access, not a thrown error.
//
// Also returns the name to sign with: the `name` on that same document (set
// on the Staff page), else the account email. Never the editable display
// name, so nobody can sign a note as someone else. firestore.rules checks
// the same value (myName()).
// Stamps the signed-in person's staff record (Staff page "Last sign in").
// Fire and forget: a failed stamp is logged and never blocks signing in.
export function recordSignIn(uid) {
  if (!db || usingSeedData) return
  updateDoc(doc(db, USERS_COLLECTION, uid), { lastSignInAt: serverTimestamp() }).catch((cause) =>
    console.warn("Couldn't record the sign-in time:", cause.code ?? cause.message),
  )
}

export async function getAdminAccess(user) {
  const none = { role: null, name: null }
  if (!user || !db) return none
  try {
    const snapshot = await getDoc(doc(db, USERS_COLLECTION, user.uid))
    if (!snapshot.exists()) {
      console.warn(`No ${USERS_COLLECTION}/${user.uid} document — this account has no role assigned yet.`)
      return none
    }
    const { role, name } = snapshot.data() ?? {}
    if (!isClinicalRole(role)) {
      console.warn(`${USERS_COLLECTION}/${user.uid} exists but its role field is`, JSON.stringify(role))
      return none
    }
    return { role, name: name || user.email }
  } catch (cause) {
    // Most often permission-denied — the doc ID doesn't match this user's
    // uid (rules only allow reading your own), or the rules deploy hasn't
    // taken effect yet.
    console.error(`Role lookup for ${USERS_COLLECTION}/${user.uid} failed:`, cause.code ?? cause.message)
    return none
  }
}

// firestore.rules restricts this to superAdmin — a signed-in admin without
// that role gets permission-denied from Firestore itself even if this were
// somehow called, so the UI-side role check is a courtesy, not the boundary.
export async function deleteIntakeRecord(id) {
  if (usingSeedData) return
  if (!db) throw new Error("Firebase is not configured.")
  await deleteDoc(doc(db, INTAKE_COLLECTION, id))
}

// Status and the admin note are saved separately (buttons vs. a free-text
// field with its own Save action), so this only ever writes the fields it's
// given rather than clobbering one with a stale copy of the other.
export async function updateIntakeRecord(id, patch) {
  if (usingSeedData) return
  if (!db) throw new Error("Firebase is not configured.")
  await updateDoc(doc(db, INTAKE_COLLECTION, id), patch)
}

export async function loadIntakeRecords() {
  // Imported dynamically so the sample records are not bundled into a
  // production build, where this branch is unreachable anyway.
  if (usingSeedData) {
    const { seedRecords } = await import("./seedRecords")
    return seedRecords
  }
  if (!db) throw new Error("Firebase is not configured.")
  const snapshot = await getDocs(query(collection(db, INTAKE_COLLECTION), orderBy("submittedAt", "desc")))
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

// Every time a staff member opens or deletes a patient record, this writes who
// did it, to what, and when. firestore.rules makes the collection append-only
// at every tier, so nothing here (or anywhere else in the client) can go back
// and tidy the trail afterwards.
//
// Deliberately never throws: a failed audit write must not stop care staff
// opening a chart mid-appointment. It is logged loudly instead, because a
// silent gap in an audit trail is exactly what an investigation would ask
// about — this is the trade-off to revisit if a formal risk assessment calls
// for hard-blocking access when auditing is unavailable.
export async function recordAuditEvent({ action, targetCollection, targetId, targetLabel = "" }) {
  if (usingSeedData) return
  if (!db || !auth?.currentUser) return
  try {
    await addDoc(collection(db, AUDIT_COLLECTION), {
      actorUid: auth.currentUser.uid,
      actorEmail: auth.currentUser.email ?? "",
      action,
      targetCollection,
      targetId,
      targetLabel,
      at: new Date().toISOString(),
    })
  } catch (cause) {
    console.error("Audit log write failed:", cause.code ?? cause.message)
  }
}

// superAdmin-only per the rules. Capped rather than unbounded: this collection
// grows with every record opened, so the page reads a recent window instead of
// the whole history.
export async function loadAuditLog(entryLimit = 250) {
  if (usingSeedData) return []
  if (!db) throw new Error("Firebase is not configured.")
  const snapshot = await getDocs(query(collection(db, AUDIT_COLLECTION), orderBy("at", "desc"), limit(entryLimit)))
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

// Anonymous page-view and click counts from the public site (lib/siteEvents.js),
// read for the Analytics page. `day` is the visitor's local YYYY-MM-DD, so a
// string comparison selects the window; single-field, so no composite index.
export async function loadSiteEvents(days = 30) {
  const since = new Date(Date.now() - (days - 1) * 86400000).toLocaleDateString("en-CA")
  if (usingSeedData) {
    const { sampleSiteEvents } = await import("../analytics/sampleSiteEvents")
    return sampleSiteEvents(days)
  }
  if (!db) throw new Error("Firebase is not configured.")
  const snapshot = await getDocs(query(collection(db, SITE_EVENTS_COLLECTION), where("day", ">=", since)))
  return snapshot.docs.map((entry) => entry.data())
}

// Same rules restriction as deleteIntakeRecord: superAdmin only, enforced by
// Firestore itself.
export async function deleteContactMessage(id) {
  if (usingSeedData) return
  if (!db) throw new Error("Firebase is not configured.")
  await deleteDoc(doc(db, MESSAGES_COLLECTION, id))
}

// Live, unlike every other list in this admin (loadIntakeRecords,
// loadAuditLog): both the sidebar badge and the Messages page mount this
// independently, so a message submitted while an admin is already signed in
// shows up without a reload. No demo/seed fallback (unlike loadIntakeRecords)
// — this is a smaller, secondary surface, so the empty state in
// dev-without-Firebase just reads "No messages yet" rather than needing its
// own fake dataset to review.
export function watchContactMessages(onChange, onError) {
  if (usingSeedData) {
    onChange([])
    return () => {}
  }
  if (!db) {
    onError?.(new Error("Firebase is not configured."))
    return () => {}
  }
  return onSnapshot(
    query(collection(db, MESSAGES_COLLECTION), orderBy("submittedAt", "desc")),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    (cause) => onError?.(cause),
  )
}
