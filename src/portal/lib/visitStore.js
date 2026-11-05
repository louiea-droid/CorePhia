// The patient's visits: the patient-safe copies Cloud Functions keep in
// patients/{intakeId}/visits (see functions/visits.js), never the staff-side
// appointments. Fails silently to an empty list (spec 2026-11-05-patient-portal-redesign).
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "./patientAuth"
import { portalDemo } from "./portalDemo"

export function listenMyVisits(intakeId, onChange) {
  if (portalDemo || !db || !intakeId) {
    onChange([])
    return () => {}
  }
  return onSnapshot(
    collection(db, "patients", intakeId, "visits"),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => {
          const { start, minutes, discipline, staffRole, status } = entry.data()
          return { id: entry.id, start: start?.toDate ? start.toDate() : new Date(start), minutes, discipline, staffRole, status }
        }),
      ),
    () => onChange([]),
  )
}
