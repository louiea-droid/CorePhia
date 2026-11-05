// Self-check for visits.js (run by npm run check): the patient's copy of an
// appointment carries only what the portal shows, never the staff note or names.
import assert from "node:assert/strict"
import { visitFromAppointment } from "./visits.js"

const start = new Date("2026-11-10T15:00:00Z")
const appointment = {
  intakeId: "chart1", patientName: "Pat Doe", staffUid: "u1", staffName: "Dr. X", discipline: "medical",
  start, minutes: 30, status: "scheduled", note: "staff only", addedBy: { uid: "u2", name: "Y" },
  addedAt: start, updatedAt: start, lastChangeId: "c1",
}
const copy = visitFromAppointment(appointment, "provider")
assert.deepEqual(copy, { start, minutes: 30, discipline: "medical", staffRole: "provider", status: "scheduled" })
assert.deepEqual(Object.keys(copy).sort(), ["discipline", "minutes", "staffRole", "start", "status"])
for (const key of ["note", "patientName", "staffName", "addedBy"]) assert.ok(!(key in copy), key)
assert.equal(visitFromAppointment(undefined, "provider"), null)
assert.equal(visitFromAppointment(null, "provider"), null)
// A missing role is stored as null, not undefined (Firestore refuses undefined).
assert.equal(visitFromAppointment(appointment, undefined).staffRole, null)
console.log("visits.check: ok")
