// Patient charts, clinical notes and staff roles: every read and write for
// them goes through here. firestore.rules is the real boundary (see the
// patients, notes, amendments and user blocks); these functions just shape
// the documents the rules expect. In demo mode (usingSeedData) the same
// functions run against an in-memory store seeded by seedCharts.js, so the
// whole flow can be tried before a BAA and real records exist.
import { deleteApp, initializeApp } from "firebase/app"
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { config, db, INTAKE_COLLECTION, sendStaffResetEmail, USERS_COLLECTION, usingSeedData } from "../lib/firebase"
import { visitEntryFor } from "../../lib/progressMath"

export const PATIENTS_COLLECTION = "patients"
const NOTES = "notes"
const AMENDMENTS = "amendments"

export const EMPTY_SECTIONS = {
  chiefConcern: "",
  hpi: "",
  intervalHistory: "",
  pertinentHistory: "",
  assessment: "",
  plan: "",
  dietHistory: "",
  goals: "",
  mealPlan: "",
  activityLevel: "",
  limitations: "",
}

const EMPTY_VITALS = { weightLb: null, systolic: null, diastolic: null, heartRate: null }

// Exercise notes only. Whole numbers or null; the rules check the ranges.
export const EMPTY_EXERCISE_PLAN = { daysPerWeek: null, intensity: "", minutesPerSession: null, kind: "", notes: "" }

// The fields an author edits; everything else on a note is set by these
// functions (and checked by the rules), never by the editor. exercisePlan
// exists on exercise notes only, so it's passed through only when present.
const pickNoteFields = ({ visitDate, sections, vitals, prescriptions, nextFollowUp, exercisePlan }) => ({
  visitDate,
  sections,
  vitals,
  prescriptions,
  nextFollowUp,
  ...(exercisePlan !== undefined && { exercisePlan }),
})

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

// --- Demo store --------------------------------------------------------------

let demoStore = null
export async function getDemoStore() {
  if (!demoStore) {
    const [{ buildDemoStore }, { seedRecords }] = await Promise.all([import("./seedCharts"), import("../lib/seedRecords")])
    demoStore = buildDemoStore(seedRecords)
  }
  return demoStore
}
export const demoId = () => `demo-${Math.random().toString(36).slice(2, 10)}`

// --- Admission ---------------------------------------------------------------

const chartFromRecord = (record, actor, timestamp) => ({
  intakeRecordId: record.id,
  firstName: record.demographics?.firstName ?? "",
  lastName: record.demographics?.lastName ?? "",
  dateOfBirth: record.demographics?.dateOfBirth ?? "",
  sexAssignedAtBirth: record.demographics?.sexAssignedAtBirth ?? "",
  status: "active",
  admittedAt: timestamp,
  admittedBy: { uid: actor.uid, name: actor.name, role: actor.role },
  updatedAt: timestamp,
  lastNote: null,
})

// Setting an applicant's status also keeps their chart in step, in one batch:
// admitting creates the chart (or reactivates it); moving away from admitted
// marks it inactive. A chart is never deleted, because it's a medical record.
// The chart id is the intake record's id, so one intake can't get two charts.
export async function setApplicantStatus(record, status, actor) {
  if (usingSeedData) {
    const store = await getDemoStore()
    const chart = store.charts.get(record.id)
    if (status === "admitted") {
      if (!chart) {
        store.charts.set(record.id, { id: record.id, ...chartFromRecord(record, actor, new Date()) })
        store.notes.set(record.id, [])
      } else {
        chart.status = "active"
      }
    } else if (chart) {
      chart.status = "inactive"
    }
    return
  }
  const database = requireDb()
  const chartRef = doc(database, PATIENTS_COLLECTION, record.id)
  const existing = await getDoc(chartRef)
  const batch = writeBatch(database)
  batch.update(doc(database, INTAKE_COLLECTION, record.id), { status })
  if (status === "admitted") {
    if (!existing.exists()) batch.set(chartRef, chartFromRecord(record, actor, serverTimestamp()))
    else if (existing.data().status !== "active") batch.update(chartRef, { status: "active", updatedAt: serverTimestamp() })
  } else if (existing.exists() && existing.data().status === "active") {
    batch.update(chartRef, { status: "inactive", updatedAt: serverTimestamp() })
  }
  await batch.commit()
}

// --- Charts ------------------------------------------------------------------

export async function loadCharts() {
  if (usingSeedData) return [...(await getDemoStore()).charts.values()].map((chart) => ({ ...chart }))
  // Only real charts: old patient-login docs left in this collection (before
  // they moved to patientAccounts) have no status and must not show up as
  // patients.
  const snapshot = await getDocs(
    query(collection(requireDb(), PATIENTS_COLLECTION), where("status", "in", ["active", "inactive"])),
  )
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

export async function loadChart(chartId) {
  if (usingSeedData) {
    const chart = (await getDemoStore()).charts.get(chartId)
    return chart ? { ...chart } : null
  }
  const snapshot = await getDoc(doc(requireDb(), PATIENTS_COLLECTION, chartId))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

// Every active chart with its notes, for the pages that look across all
// patients (To-do, Calendar).
// ponytail: one notes read per chart, fine for a few hundred patients; past
// that, store the next due dates on the chart when a note is signed.
export async function loadActiveChartNotes(uid) {
  const charts = (await loadCharts()).filter((chart) => chart.status === "active")
  return Promise.all(charts.map(async (chart) => ({ chart, notes: await loadNotes(chart.id, uid) })))
}

export async function loadIntakeRecord(id) {
  if (usingSeedData) {
    const { seedRecords } = await import("../lib/seedRecords")
    return seedRecords.find((record) => record.id === id) ?? null
  }
  const snapshot = await getDoc(doc(requireDb(), INTAKE_COLLECTION, id))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

// --- Notes -------------------------------------------------------------------

// Newest visit first. Two queries because the rules only let a person read
// signed notes plus their own drafts, and a query has to stay inside that.
export async function loadNotes(chartId, uid) {
  let notes
  if (usingSeedData) {
    notes = ((await getDemoStore()).notes.get(chartId) ?? [])
      .filter((note) => note.status === "signed" || note.authorUid === uid)
      .map((note) => ({ ...note }))
  } else {
    const notesRef = collection(requireDb(), PATIENTS_COLLECTION, chartId, NOTES)
    const [signed, drafts] = await Promise.all([
      getDocs(query(notesRef, where("status", "==", "signed"))),
      getDocs(query(notesRef, where("status", "==", "draft"), where("authorUid", "==", uid))),
    ])
    notes = [...signed.docs, ...drafts.docs].map((entry) => ({ id: entry.id, ...entry.data() }))
  }
  return notes.sort((a, b) => (b.visitDate ?? "").localeCompare(a.visitDate ?? ""))
}

export async function createDraftNote(chartId, type, actor, prefill = {}) {
  const today = new Date().toLocaleDateString("en-CA")
  const base = {
    type,
    status: "draft",
    authorUid: actor.uid,
    authorName: actor.name,
    authorRole: actor.role,
    visitDate: today,
    sections: { ...EMPTY_SECTIONS, ...prefill.sections },
    vitals: { ...EMPTY_VITALS },
    prescriptions: [],
    nextFollowUp: "",
    ...(type === "exercise" && { exercisePlan: { ...EMPTY_EXERCISE_PLAN } }),
    signedAt: null,
    signedBy: null,
  }
  if (usingSeedData) {
    const note = { id: demoId(), ...base, createdAt: new Date(), updatedAt: new Date() }
    ;(await getDemoStore()).notes.get(chartId)?.push(note)
    return { ...note }
  }
  const ref = await addDoc(collection(requireDb(), PATIENTS_COLLECTION, chartId, NOTES), {
    ...base,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { id: ref.id, ...base, createdAt: new Date(), updatedAt: new Date() }
}

const findDemoNote = async (chartId, noteId) => (await getDemoStore()).notes.get(chartId)?.find((note) => note.id === noteId)

export async function saveDraftNote(chartId, noteId, fields) {
  if (usingSeedData) {
    Object.assign(await findDemoNote(chartId, noteId), pickNoteFields(fields), { updatedAt: new Date() })
    return
  }
  await updateDoc(doc(requireDb(), PATIENTS_COLLECTION, chartId, NOTES, noteId), {
    ...pickNoteFields(fields),
    updatedAt: serverTimestamp(),
  })
}

export async function discardDraftNote(chartId, noteId) {
  if (usingSeedData) {
    const list = (await getDemoStore()).notes.get(chartId) ?? []
    const index = list.findIndex((note) => note.id === noteId)
    if (index >= 0) list.splice(index, 1)
    return
  }
  await deleteDoc(doc(requireDb(), PATIENTS_COLLECTION, chartId, NOTES, noteId))
}

// Signing writes the editor's current fields in the same update, so a sign
// can never lock in an older autosave. The note locks for good: the rules
// refuse every later update or delete. The chart's lastNote moves in the
// same batch.
export async function signNote(chartId, noteId, type, fields, actor) {
  const signedBy = { uid: actor.uid, name: actor.name, role: actor.role }
  if (usingSeedData) {
    const store = await getDemoStore()
    const signedAt = new Date()
    Object.assign(await findDemoNote(chartId, noteId), pickNoteFields(fields), {
      status: "signed",
      signedAt,
      signedBy,
      updatedAt: signedAt,
    })
    Object.assign(store.charts.get(chartId), { lastNote: { type, signedAt }, updatedAt: signedAt })
    const entry = visitEntryFor({ ...fields, id: noteId })
    if (entry) {
      const { demoProgress } = await import("./progressStore")
      const list = await demoProgress(chartId)
      // A first read just now already built it from the signed notes.
      if (!list.some((existing) => existing.id === `visit-${noteId}`)) list.push({ id: `visit-${noteId}`, ...entry, createdAt: signedAt })
    }
    return
  }
  const database = requireDb()
  const batch = writeBatch(database)
  batch.update(doc(database, PATIENTS_COLLECTION, chartId, NOTES, noteId), {
    ...pickNoteFields(fields),
    status: "signed",
    signedAt: serverTimestamp(),
    signedBy,
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(database, PATIENTS_COLLECTION, chartId), {
    lastNote: { type, signedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  })
  // The patient's progress gets this visit's numbers in the same commit, so a
  // signed note and its entry can't disagree (firestore.rules checks they match).
  const entry = visitEntryFor({ ...fields, id: noteId })
  if (entry) batch.set(doc(database, PATIENTS_COLLECTION, chartId, "progress", `visit-${noteId}`), { ...entry, createdAt: serverTimestamp() })
  await batch.commit()
}

export async function loadAmendments(chartId, noteId) {
  if (usingSeedData) return [...((await getDemoStore()).amendments.get(noteId) ?? [])]
  const snapshot = await getDocs(
    query(collection(requireDb(), PATIENTS_COLLECTION, chartId, NOTES, noteId, AMENDMENTS), orderBy("at", "asc")),
  )
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

// How many addenda each signed note has, for the chart timeline: a count
// query per note, so the addenda themselves aren't downloaded. { noteId: n }
export async function countAmendments(chartId, noteIds) {
  if (usingSeedData) {
    const store = await getDemoStore()
    return Object.fromEntries(noteIds.map((id) => [id, store.amendments.get(id)?.length ?? 0]))
  }
  const database = requireDb()
  const counts = await Promise.all(
    noteIds.map((id) =>
      getCountFromServer(collection(database, PATIENTS_COLLECTION, chartId, NOTES, id, AMENDMENTS)).then(
        (snapshot) => [id, snapshot.data().count],
      ),
    ),
  )
  return Object.fromEntries(counts)
}

export async function addAmendment(chartId, noteId, text, actor) {
  const base = { text, authorUid: actor.uid, authorName: actor.name, authorRole: actor.role }
  if (usingSeedData) {
    const store = await getDemoStore()
    const amendment = { id: demoId(), ...base, at: new Date() }
    store.amendments.set(noteId, [...(store.amendments.get(noteId) ?? []), amendment])
    return amendment
  }
  const ref = await addDoc(collection(requireDb(), PATIENTS_COLLECTION, chartId, NOTES, noteId, AMENDMENTS), {
    ...base,
    at: serverTimestamp(),
  })
  return { id: ref.id, ...base, at: new Date() }
}

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
export async function addStaff({ name, email, role }, actor) {
  const record = { name, email, role, addedBy: { uid: actor.uid, name: actor.name } }
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
    await signOut(inviteAuth)
    await setDoc(doc(database, USERS_COLLECTION, user.uid), { ...record, addedAt: serverTimestamp() })
    await sendStaffResetEmail(email)
    return { uid: user.uid, ...record, addedAt: new Date() }
  } finally {
    await deleteApp(invite)
  }
}

// Changes the name on the staff record. Notes already signed keep the name they were signed with.
export async function setStaffName(uid, name) {
  if (usingSeedData) {
    const member = (await getDemoStore()).staff.find((entry) => entry.uid === uid)
    if (member) member.name = name
    return
  }
  await updateDoc(doc(requireDb(), USERS_COLLECTION, uid), { name })
}

// role "" removes access. The account stays, so signed notes keep their name.
export async function setStaffRole(uid, role) {
  if (usingSeedData) {
    const member = (await getDemoStore()).staff.find((entry) => entry.uid === uid)
    if (member) member.role = role
    return
  }
  await updateDoc(doc(requireDb(), USERS_COLLECTION, uid), { role })
}
