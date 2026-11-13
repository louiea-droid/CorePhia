// Staff records (user/{uid}): every read and write for the Staff page goes
// through here (moved from the retired patients/chartStore.js, 2026-11-13).
// firestore.rules (the user block) is the real boundary. In demo mode
// (usingSeedData) the same functions run against an in-memory list.
import { deleteApp, initializeApp } from "firebase/app"
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth"
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore"
import { config, db, sendStaffResetEmail, USERS_COLLECTION, usingSeedData } from "../lib/firebase"

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

const DAY = 86400000
let demoStaff = null
function getDemoStore() {
  const now = Date.now()
  demoStaff ??= {
    staff: [
      { uid: "demo-super", name: "Hyacinth team", email: "team@hyacinth.example", role: "superAdmin", addedAt: null },
      { uid: "demo-admin", name: "Dr. Antonious", email: "provider@corephia.example", role: "admin", addedAt: null, lastSignInAt: new Date(now - 2 * 3600000) },
      { uid: "demo-provider", name: "Jordan Lee, NP", email: "jordan@corephia.example", role: "provider", addedAt: new Date(now - 12 * DAY), lastSignInAt: new Date(now - DAY) },
      { uid: "demo-dietitian", name: "Sam Rivera, RD", email: "sam@corephia.example", role: "dietitian", addedAt: new Date(now - 5 * DAY) },
    ],
  }
  return demoStaff
}
const demoId = () => `demo-${Math.random().toString(36).slice(2, 10)}`

// --- Staff -------------------------------------------------------------------

// Super admins are hidden from admins. The rules refuse an admin any read of
// a super admin's doc, so an admin's query has to rule them out itself.
// Must match the role list in the user read rule (firestore.rules), so the
// rules can prove this query.
const VISIBLE_TO_ADMIN = ["", "provider", "dietitian", "coAdmin", "admin"]

export async function loadStaff(viewerRole) {
  if (usingSeedData) {
    return (await getDemoStore()).staff
      .filter((member) => viewerRole === "superAdmin" || VISIBLE_TO_ADMIN.includes(member.role))
      .map((member) => ({ ...member }))
  }
  const users = collection(requireDb(), USERS_COLLECTION)
  const snapshot = await getDocs(viewerRole === "superAdmin" ? users : query(users, where("role", "in", VISIBLE_TO_ADMIN)))
  return snapshot.docs.map((entry) => ({ uid: entry.id, ...entry.data() }))
}

// Removes the staff record, so the person is off the Staff list and has no
// access. Their Firebase Auth login can only be deleted from the Console
// (that needs a server), and anything they signed keeps their name.
export async function deleteStaff(uid) {
  if (usingSeedData) {
    const store = await getDemoStore()
    store.staff = store.staff.filter((member) => member.uid !== uid)
    return
  }
  await deleteDoc(doc(requireDb(), USERS_COLLECTION, uid))
}

const randomPassword = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/[^A-Za-z0-9]/g, "") + "aA1!"

// Creates the person's account without signing the admin out: a second,
// throwaway Firebase app instance does the createUser (which would otherwise
// switch the session to the new account). The new person never sees the
// random password; the reset email is their "set your password" invite.
// `name` is left off when empty (a co-admin adding someone, see
// roles.canNameStaff): they then sign with their email until the admin names them.
export async function addStaff({ name, email, role }, actor) {
  const record = { ...(name ? { name } : {}), email, role, addedBy: { uid: actor.uid, name: actor.name } }
  if (usingSeedData) {
    const member = { uid: demoId(), ...record, addedAt: new Date() }
    ;(await getDemoStore()).staff.push(member)
    return member
  }
  const database = requireDb()
  const invite = initializeApp(config, `staff-invite-${Date.now()}`)
  try {
    const inviteAuth = getAuth(invite)
    const { user } = await createUserWithEmailAndPassword(inviteAuth, email, randomPassword())
    try {
      await setDoc(doc(database, USERS_COLLECTION, user.uid), { ...record, addedAt: serverTimestamp() })
    } catch (cause) {
      // Still signed in as the new login on the throwaway app, so it can
      // delete itself: no sign-in left behind without a staff record.
      await user.delete().catch((removeCause) => console.error("Couldn't remove the half-added login:", removeCause.code ?? removeCause.message))
      throw cause
    } finally {
      await signOut(inviteAuth)
    }
    // From here they are added, so a failed email mustn't read as "nothing
    // changed": it's reported back and they can use "Forgot password?".
    const inviteEmailFailed = await sendStaffResetEmail(email).then(
      () => false,
      (cause) => {
        console.error("Staff set-up email failed:", cause.code ?? cause.message)
        return true
      },
    )
    return { uid: user.uid, ...record, addedAt: new Date(), inviteEmailFailed }
  } finally {
    await deleteApp(invite)
  }
}

// Changes the name on the staff record.
export async function setStaffName(uid, name) {
  if (usingSeedData) {
    const member = (await getDemoStore()).staff.find((entry) => entry.uid === uid)
    if (member) member.name = name
    return
  }
  await updateDoc(doc(requireDb(), USERS_COLLECTION, uid), { name })
}

// role "" removes access. The account stays.
export async function setStaffRole(uid, role) {
  if (usingSeedData) {
    const member = (await getDemoStore()).staff.find((entry) => entry.uid === uid)
    if (member) member.role = role
    return
  }
  await updateDoc(doc(requireDb(), USERS_COLLECTION, uid), { role })
}
