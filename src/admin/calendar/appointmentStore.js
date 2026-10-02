// Appointments: every read and write goes through here. firestore.rules is
// the real boundary (the appointments block): who added it is fixed at
// creation, every later change is written in the same batch as a history
// entry, and nothing is ever deleted (cancel instead). Appointments hold
// patient names and visit times, so they carry the same BAA requirement as
// intake records. Demo mode runs against chartStore's in-memory store.
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore"
import { asDate } from "../patients/chartMath"
import { demoId, getDemoStore } from "../patients/chartStore"
import { db, usingSeedData } from "../lib/firebase"

export const APPOINTMENTS_COLLECTION = "appointments"
const CHANGES = "changes"

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

const byStart = (a, b) => (asDate(a.start)?.getTime() ?? 0) - (asDate(b.start)?.getTime() ?? 0)
const fromSnapshot = (snapshot) => snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort(byStart)
const copy = (appointment) => ({ ...appointment, addedBy: { ...appointment.addedBy } })

// Firestore stores a JS Date as a timestamp, so `start` goes in as a Date.
export async function loadAppointments(from, to) {
  if (usingSeedData) {
    return (await getDemoStore()).appointments
      .filter((appointment) => appointment.start >= from && appointment.start < to)
      .map(copy)
      .sort(byStart)
  }
  return fromSnapshot(
    await getDocs(
      query(
        collection(requireDb(), APPOINTMENTS_COLLECTION),
        where("start", ">=", from),
        where("start", "<", to),
        orderBy("start"),
      ),
    ),
  )
}

export async function loadAppointmentsFor(intakeId) {
  if (usingSeedData) {
    return (await getDemoStore()).appointments.filter((appointment) => appointment.intakeId === intakeId).map(copy).sort(byStart)
  }
  return fromSnapshot(await getDocs(query(collection(requireDb(), APPOINTMENTS_COLLECTION), where("intakeId", "==", intakeId))))
}

export async function bookAppointment({ intakeId, patientName, staffUid, staffName, discipline, start, minutes, note }, actor) {
  const base = {
    intakeId,
    patientName,
    staffUid,
    staffName,
    discipline,
    start,
    minutes,
    note,
    status: "scheduled",
    addedBy: { uid: actor.uid, name: actor.name, role: actor.role },
  }
  if (usingSeedData) {
    const appointment = { id: demoId(), ...base, addedAt: new Date(), updatedAt: new Date() }
    ;(await getDemoStore()).appointments.push(appointment)
    return copy(appointment)
  }
  const ref = await addDoc(collection(requireDb(), APPOINTMENTS_COLLECTION), {
    ...base,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { id: ref.id, ...base, addedAt: new Date(), updatedAt: new Date() }
}

// One batch: the appointment's new values plus the history entry that
// explains them. The rules refuse an update without its entry.
export async function changeAppointment(appointment, patch, change, actor) {
  const by = { uid: actor.uid, name: actor.name, role: actor.role }
  if (usingSeedData) {
    const store = await getDemoStore()
    const stored = store.appointments.find((entry) => entry.id === appointment.id)
    if (stored.status !== "scheduled") throw Object.assign(new Error("Not scheduled"), { code: "permission-denied" })
    const entry = { id: demoId(), ...change, by, at: new Date() }
    Object.assign(stored, patch, { updatedAt: new Date(), lastChangeId: entry.id })
    store.appointmentChanges.set(appointment.id, [...(store.appointmentChanges.get(appointment.id) ?? []), entry])
    return copy(stored)
  }
  const database = requireDb()
  const appointmentRef = doc(database, APPOINTMENTS_COLLECTION, appointment.id)
  const changeRef = doc(collection(appointmentRef, CHANGES))
  const batch = writeBatch(database)
  batch.update(appointmentRef, { ...patch, updatedAt: serverTimestamp(), lastChangeId: changeRef.id })
  batch.set(changeRef, { kind: change.kind, from: change.from, to: change.to, reason: change.reason ?? "", by, at: serverTimestamp() })
  await batch.commit()
  return { ...appointment, ...patch, updatedAt: new Date(), lastChangeId: changeRef.id }
}

export async function loadChanges(appointmentId) {
  if (usingSeedData) return [...((await getDemoStore()).appointmentChanges.get(appointmentId) ?? [])]
  return (
    await getDocs(query(collection(requireDb(), APPOINTMENTS_COLLECTION, appointmentId, CHANGES), orderBy("at", "asc")))
  ).docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}
