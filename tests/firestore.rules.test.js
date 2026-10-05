// firestore.rules tests for charts, notes (all four types), amendments, staff
// roles, appointments, patient portal links and portal invites.
//
// Run: npm run test:rules
// Needs Java 21+ for the Firestore emulator (firebase-tools starts it). All 92
// passed on 2026-10-05. Run them before every rules deploy.
import { readFileSync } from "node:fs"
import { after, before, beforeEach, describe, test } from "node:test"
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"

let env

const ROLES = { super: "superAdmin", admin: "admin", coadmin: "coAdmin", coadmin2: "coAdmin", provider: "provider", provider2: "provider", dietitian: "dietitian" }
const as = (uid) => env.authenticatedContext(uid).firestore()

const draft = (uid, role, overrides = {}) => ({
  type: "progress",
  status: "draft",
  authorUid: uid,
  authorName: uid,
  authorRole: role,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  visitDate: "2026-10-01",
  sections: { plan: "" },
  vitals: { weightLb: null },
  prescriptions: [],
  nextFollowUp: "",
  signedAt: null,
  signedBy: null,
  ...overrides,
})

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "corephia-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  })
})

after(async () => env?.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    for (const [uid, role] of Object.entries(ROLES)) await setDoc(doc(db, "user", uid), { role, name: uid })
    await setDoc(doc(db, "intakeRecords", "pending1"), { status: "pending" })
    await setDoc(doc(db, "intakeRecords", "chart1"), { status: "admitted", demographics: { email: "Pat@X.co " } })
    await setDoc(doc(db, "patients", "chart1"), { intakeRecordId: "chart1", status: "active" })
    await setDoc(doc(db, "patients/chart1/notes/signed1"), { ...draft("provider", "provider"), status: "signed" })
    await setDoc(doc(db, "patients/chart1/notes/draft1"), draft("provider", "provider"))
    await setDoc(doc(db, "patients/chart1/notes/diet1"), { ...draft("admin", "admin", { type: "dietitian" }), status: "signed" })
    await setDoc(doc(db, "contactMessages", "m1"), { name: "x" })
    const invite = { to: "pat@x.co", firstName: "Pat", subject: "s", message: "m", createdBy: { uid: "provider", name: "provider" }, createdAt: new Date() }
    await setDoc(doc(db, "patients/chart1/invites/sent1"), { ...invite, status: "sent", sentAt: new Date() })
    await setDoc(doc(db, "patients/chart1/invites/ready1"), { ...invite, status: "ready" })
    await setDoc(doc(db, "patients", "inactive1"), { intakeRecordId: "inactive1", status: "inactive" })
    await setDoc(doc(db, "intakeRecords", "inactive1"), { status: "declined", demographics: { email: "pat@x.co" } })
    await setDoc(doc(db, "patientAccounts", "patient1"), { email: "p1@x.co", intakeId: "chart1", firstName: "Pat", linkedAt: new Date() })
    await setDoc(doc(db, "patientAccounts", "patient2"), { email: "p2@x.co", intakeId: "pending1", firstName: "Sam", linkedAt: new Date() })
  })
})

describe("roles", () => {
  test("a provider can't read contact messages", async () => {
    await assertFails(getDoc(doc(as("provider"), "contactMessages", "m1")))
  })
  test("an admin can grant provider", async () => {
    await assertSucceeds(setDoc(doc(as("admin"), "user", "newbie"), { role: "provider", name: "N", email: "n@x.co" }))
  })
  test("'added by' must be the person adding, at server time", async () => {
    const db = as("admin")
    await assertFails(setDoc(doc(db, "user", "newbie"), { role: "provider", name: "N", addedBy: { uid: "super", name: "S" } }))
    await assertFails(
      setDoc(doc(db, "user", "newbie"), { role: "provider", name: "N", addedBy: { uid: "admin", name: "admin" }, addedAt: new Date("2020-01-01") }),
    )
    await assertSucceeds(
      setDoc(doc(db, "user", "newbie"), { role: "provider", name: "N", addedBy: { uid: "admin", name: "admin" }, addedAt: serverTimestamp() }),
    )
  })
  test("changing someone's role later keeps their original 'added by'", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "user", "added"), { role: "provider", name: "A", addedBy: { uid: "super", name: "S" } }),
    )
    await assertSucceeds(updateDoc(doc(as("admin"), "user", "added"), { role: "coAdmin" }))
  })
  test("an admin can add a co-admin", async () => {
    await assertSucceeds(setDoc(doc(as("admin"), "user", "newbie"), { role: "coAdmin", name: "N", email: "n@x.co" }))
  })
  test("an admin can promote a provider to co-admin", async () => {
    await assertSucceeds(updateDoc(doc(as("admin"), "user", "provider"), { role: "coAdmin" }))
  })
  test("only a super admin grants admin or super admin", async () => {
    await assertFails(setDoc(doc(as("admin"), "user", "newbie"), { role: "admin" }))
    await assertFails(setDoc(doc(as("admin"), "user", "newbie"), { role: "superAdmin" }))
    await assertFails(setDoc(doc(as("coadmin"), "user", "newbie"), { role: "admin" }))
    await assertSucceeds(setDoc(doc(as("super"), "user", "newbie"), { role: "admin", name: "N" }))
  })
  test("the admin can remove a co-admin", async () => {
    await assertSucceeds(updateDoc(doc(as("admin"), "user", "coadmin"), { role: "" }))
  })
  test("a co-admin can add providers and co-admins", async () => {
    await assertSucceeds(setDoc(doc(as("coadmin"), "user", "newbie"), { role: "coAdmin", name: "N" }))
  })
  test("a co-admin can't touch the admin or another co-admin", async () => {
    await assertFails(updateDoc(doc(as("coadmin"), "user", "admin"), { role: "" }))
    await assertFails(updateDoc(doc(as("coadmin"), "user", "coadmin2"), { role: "provider" }))
    await assertFails(deleteDoc(doc(as("coadmin"), "user", "admin")))
    await assertFails(deleteDoc(doc(as("coadmin"), "user", "coadmin2")))
  })
  test("a co-admin can't see a super admin either", async () => {
    await assertFails(getDoc(doc(as("coadmin"), "user", "super")))
  })
  test("an admin can't demote or remove another admin", async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "user", "admin2"), { role: "admin", name: "admin2" }))
    await assertFails(updateDoc(doc(as("admin"), "user", "admin2"), { role: "provider" }))
    await assertFails(updateDoc(doc(as("admin"), "user", "admin2"), { role: "" }))
  })
  test("an admin can't demote a super admin", async () => {
    await assertFails(updateDoc(doc(as("admin"), "user", "super"), { role: "" }))
  })
  test("an admin can't see a super admin's account", async () => {
    await assertFails(getDoc(doc(as("admin"), "user", "super")))
  })
  test("an admin's staff list query excludes super admins", async () => {
    const db = as("admin")
    await assertSucceeds(getDocs(query(collection(db, "user"), where("role", "in", ["", "provider", "coAdmin", "admin"]))))
    await assertFails(getDocs(collection(db, "user")))
  })
  test("an admin can delete a provider or a no-access account", async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "user", "gone"), { role: "", name: "gone" }))
    await assertSucceeds(deleteDoc(doc(as("admin"), "user", "provider")))
    await assertSucceeds(deleteDoc(doc(as("admin"), "user", "gone")))
  })
  test("an admin can't delete another admin or a super admin", async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "user", "admin2"), { role: "admin", name: "admin2" }))
    await assertFails(deleteDoc(doc(as("admin"), "user", "admin2")))
    await assertFails(deleteDoc(doc(as("admin"), "user", "super")))
  })
  test("a super admin can delete anyone but themselves", async () => {
    await assertSucceeds(deleteDoc(doc(as("super"), "user", "admin")))
    await assertFails(deleteDoc(doc(as("super"), "user", "super")))
  })
  test("a provider can't delete accounts", async () => {
    await assertFails(deleteDoc(doc(as("provider"), "user", "provider2")))
  })
  test("nobody edits their own role", async () => {
    await assertFails(updateDoc(doc(as("super"), "user", "super"), { role: "admin" }))
  })
  test("a provider can't write any role", async () => {
    await assertFails(setDoc(doc(as("provider"), "user", "newbie"), { role: "provider" }))
  })
})

describe("charts", () => {
  test("a chart needs an admitted intake in the same batch", async () => {
    const db = as("admin")
    await assertFails(
      setDoc(doc(db, "patients", "pending1"), {
        intakeRecordId: "pending1",
        status: "active",
        admittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        admittedBy: { uid: "admin", name: "admin", role: "admin" },
        lastNote: null,
      }),
    )
    const batch = writeBatch(db)
    batch.update(doc(db, "intakeRecords", "pending1"), { status: "admitted" })
    batch.set(doc(db, "patients", "pending1"), {
      intakeRecordId: "pending1",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      sexAssignedAtBirth: "",
      status: "active",
      admittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      admittedBy: { uid: "admin", name: "admin", role: "admin" },
      lastNote: null,
    })
    await assertSucceeds(batch.commit())
  })
  test("a chart's last-note summary can't be forged or backdated", async () => {
    const chart = doc(as("provider"), "patients", "chart1")
    await assertFails(updateDoc(chart, { lastNote: { type: "progress", signedAt: new Date("2020-01-01") }, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(chart, { lastNote: { type: "anything", signedAt: serverTimestamp() }, updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(chart, { lastNote: { type: "progress", signedAt: serverTimestamp() }, updatedAt: serverTimestamp() }))
  })
  test("charts are never deleted", async () => {
    await assertFails(deleteDoc(doc(as("super"), "patients", "chart1")))
  })
})

describe("notes", () => {
  test("a provider can start a draft", async () => {
    await assertSucceeds(setDoc(doc(as("provider"), "patients/chart1/notes/new1"), draft("provider", "provider")))
  })
  test("a draft can't claim someone else as author", async () => {
    await assertFails(setDoc(doc(as("provider"), "patients/chart1/notes/new1"), draft("admin", "admin")))
  })
  test("another clinician can't read someone's draft", async () => {
    await assertFails(getDoc(doc(as("provider2"), "patients/chart1/notes/draft1")))
  })
  test("the author signs with server time and their own name", async () => {
    await assertSucceeds(
      updateDoc(doc(as("provider"), "patients/chart1/notes/draft1"), {
        status: "signed",
        signedAt: serverTimestamp(),
        signedBy: { uid: "provider", name: "provider", role: "provider" },
        updatedAt: serverTimestamp(),
      }),
    )
  })
  test("signing in someone else's name fails", async () => {
    await assertFails(
      updateDoc(doc(as("provider"), "patients/chart1/notes/draft1"), {
        status: "signed",
        signedAt: serverTimestamp(),
        signedBy: { uid: "admin", name: "A", role: "admin" },
        updatedAt: serverTimestamp(),
      }),
    )
  })
  test("signing under a forged name fails, even with your own uid", async () => {
    await assertFails(
      updateDoc(doc(as("provider"), "patients/chart1/notes/draft1"), {
        status: "signed",
        signedAt: serverTimestamp(),
        signedBy: { uid: "provider", name: "Dr. Antonious", role: "provider" },
        updatedAt: serverTimestamp(),
      }),
    )
  })
  test("a backdated signature fails", async () => {
    await assertFails(
      updateDoc(doc(as("provider"), "patients/chart1/notes/draft1"), {
        status: "signed",
        signedAt: new Date("2020-01-01"),
        signedBy: { uid: "provider", name: "provider", role: "provider" },
        updatedAt: serverTimestamp(),
      }),
    )
  })
  test("a signed note can't be edited, even by its author or a super admin", async () => {
    await assertFails(updateDoc(doc(as("provider"), "patients/chart1/notes/signed1"), { sections: { plan: "changed" } }))
    await assertFails(updateDoc(doc(as("super"), "patients/chart1/notes/signed1"), { sections: { plan: "changed" } }))
  })
  test("a signed note can't be deleted", async () => {
    await assertFails(deleteDoc(doc(as("provider"), "patients/chart1/notes/signed1")))
    await assertFails(deleteDoc(doc(as("super"), "patients/chart1/notes/signed1")))
  })
  test("the author can discard their draft", async () => {
    await assertSucceeds(deleteDoc(doc(as("provider"), "patients/chart1/notes/draft1")))
  })
})

describe("amendments", () => {
  const amendment = (uid, role, at = serverTimestamp()) => ({ text: "Correction.", authorUid: uid, authorName: uid, authorRole: role, at })
  test("anyone clinical can add an addendum to a signed note", async () => {
    await assertSucceeds(setDoc(doc(as("admin"), "patients/chart1/notes/signed1/amendments/a1"), amendment("admin", "admin")))
  })
  test("an addendum with a client-chosen time fails", async () => {
    await assertFails(
      setDoc(doc(as("admin"), "patients/chart1/notes/signed1/amendments/a1"), amendment("admin", "admin", new Date("2020-01-01"))),
    )
  })
  test("addenda can't be added to drafts", async () => {
    await assertFails(setDoc(doc(as("provider"), "patients/chart1/notes/draft1/amendments/a1"), amendment("provider", "provider")))
  })
  test("addenda can't be edited", async () => {
    const db = as("admin")
    await assertSucceeds(setDoc(doc(db, "patients/chart1/notes/signed1/amendments/a1"), amendment("admin", "admin")))
    await assertFails(updateDoc(doc(db, "patients/chart1/notes/signed1/amendments/a1"), { text: "rewritten" }))
  })
})

describe("dietitian and exercise notes", () => {
  const sign = (uid, role) => ({
    status: "signed",
    signedAt: serverTimestamp(),
    signedBy: { uid, name: uid, role },
    updatedAt: serverTimestamp(),
  })
  const plan = (overrides = {}) => ({ daysPerWeek: 3, intensity: "moderate", minutesPerSession: 30, kind: "Walking", notes: "", ...overrides })
  const exerciseDraft = (overrides) => draft("provider", "provider", { type: "exercise", exercisePlan: plan(overrides) })

  test("a dietitian can't admit or decline an applicant", async () => {
    await assertFails(updateDoc(doc(as("dietitian"), "intakeRecords", "pending1"), { status: "admitted" }))
  })
  test("a dietitian reads charts and signed notes", async () => {
    await assertSucceeds(getDoc(doc(as("dietitian"), "patients", "chart1")))
    await assertSucceeds(getDoc(doc(as("dietitian"), "patients/chart1/notes/signed1")))
  })
  test("a dietitian starts dietitian notes only", async () => {
    const db = as("dietitian")
    await assertSucceeds(setDoc(doc(db, "patients/chart1/notes/d1"), draft("dietitian", "dietitian", { type: "dietitian" })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/d2"), draft("dietitian", "dietitian", { type: "progress" })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/d3"), draft("dietitian", "dietitian", { type: "exercise", exercisePlan: plan() })))
  })
  test("the admin writes dietitian notes; a provider can't", async () => {
    await assertSucceeds(setDoc(doc(as("admin"), "patients/chart1/notes/a1"), draft("admin", "admin", { type: "dietitian" })))
    await assertFails(setDoc(doc(as("provider"), "patients/chart1/notes/p1"), draft("provider", "provider", { type: "dietitian" })))
  })
  test("a provider can't sign a dietitian draft, even their own after a role change", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "patients/chart1/notes/old"), draft("provider", "provider", { type: "dietitian" })),
    )
    await assertFails(updateDoc(doc(as("provider"), "patients/chart1/notes/old"), sign("provider", "provider")))
  })
  test("a draft whose author's role changed can still be discarded", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "patients/chart1/notes/stuck"), draft("provider", "provider", { type: "dietitian" })),
    )
    await assertSucceeds(deleteDoc(doc(as("provider"), "patients/chart1/notes/stuck")))
  })
  test("a dietitian signs their own dietitian note", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "patients/chart1/notes/mine"), draft("dietitian", "dietitian", { type: "dietitian" })),
    )
    await assertSucceeds(updateDoc(doc(as("dietitian"), "patients/chart1/notes/mine"), sign("dietitian", "dietitian")))
  })
  test("a dietitian's signing updates the chart's last note", async () => {
    await assertSucceeds(
      updateDoc(doc(as("dietitian"), "patients", "chart1"), {
        lastNote: { type: "dietitian", signedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
      }),
    )
  })
  test("a dietitian can't make a chart inactive", async () => {
    await assertFails(updateDoc(doc(as("dietitian"), "patients", "chart1"), { status: "inactive", updatedAt: serverTimestamp() }))
  })
  test("dietitian and exercise notes can't carry a prescription", async () => {
    const rx = [{ id: "r", action: "start", medication: "M", instructions: "", startDate: "", renewalDue: "", stopReason: "", renewsId: "" }]
    await assertFails(
      setDoc(doc(as("dietitian"), "patients/chart1/notes/r1"), draft("dietitian", "dietitian", { type: "dietitian", prescriptions: rx })),
    )
    await assertFails(setDoc(doc(as("provider"), "patients/chart1/notes/r2"), { ...exerciseDraft(), prescriptions: rx }))
  })
  test("an exercise plan is checked", async () => {
    const db = as("provider")
    await assertSucceeds(setDoc(doc(db, "patients/chart1/notes/e1"), exerciseDraft()))
    await assertSucceeds(setDoc(doc(db, "patients/chart1/notes/e2"), exerciseDraft({ daysPerWeek: null, minutesPerSession: null, intensity: "" })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e3"), exerciseDraft({ daysPerWeek: 9 })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e4"), exerciseDraft({ daysPerWeek: 3.5 })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e5"), exerciseDraft({ intensity: "extreme" })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e6"), exerciseDraft({ extra: 1 })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e7"), draft("provider", "provider", { type: "progress", exercisePlan: plan() })))
  })
  test("a dietitian adds addenda to dietitian notes only", async () => {
    const amendment = { text: "Added detail.", authorUid: "dietitian", authorName: "dietitian", authorRole: "dietitian", at: serverTimestamp() }
    await assertSucceeds(setDoc(doc(as("dietitian"), "patients/chart1/notes/diet1/amendments/a1"), amendment))
    await assertFails(setDoc(doc(as("dietitian"), "patients/chart1/notes/signed1/amendments/a2"), amendment))
  })
  test("admins and co-admins grant and remove the dietitian role", async () => {
    await assertSucceeds(setDoc(doc(as("admin"), "user", "newdiet"), { role: "dietitian", name: "N" }))
    await assertSucceeds(updateDoc(doc(as("coadmin"), "user", "dietitian"), { role: "" }))
  })
})

describe("appointments", () => {
  const booking = (uid, role, overrides = {}) => ({
    intakeId: "pending1",
    patientName: "Pat Doe",
    staffUid: "provider",
    staffName: "provider",
    discipline: "medical",
    start: new Date("2026-10-05T14:00:00Z"),
    minutes: 30,
    status: "scheduled",
    note: "",
    addedBy: { uid, name: uid, role },
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  })
  const change = (uid, role, overrides = {}) => ({
    kind: "moved",
    from: { start: new Date("2026-10-05T14:00:00Z") },
    to: { start: new Date("2026-10-07T18:00:00Z") },
    reason: "",
    by: { uid, name: uid, role },
    at: serverTimestamp(),
    ...overrides,
  })
  const seed = () =>
    env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "appointments", "ap1"), { ...booking("admin", "admin"), addedAt: new Date(), updatedAt: new Date() }),
    )
  const move = (db, uid, role, changeId, patch = { start: new Date("2026-10-07T18:00:00Z") }, entry = change(uid, role)) => {
    const batch = writeBatch(db)
    batch.update(doc(db, "appointments", "ap1"), { ...patch, updatedAt: serverTimestamp(), lastChangeId: changeId })
    batch.set(doc(db, "appointments/ap1/changes", changeId), entry)
    return batch.commit()
  }

  test("any clinician books, signed as themselves at server time", async () => {
    await assertSucceeds(setDoc(doc(as("dietitian"), "appointments", "n1"), booking("dietitian", "dietitian")))
    await assertSucceeds(setDoc(doc(as("provider"), "appointments", "n2"), booking("provider", "provider")))
  })
  test("a booking can't claim someone else added it, or a past time", async () => {
    await assertFails(setDoc(doc(as("provider"), "appointments", "n1"), booking("admin", "admin")))
    await assertFails(setDoc(doc(as("provider"), "appointments", "n2"), booking("provider", "provider", { addedAt: new Date("2020-01-01") })))
  })
  test("a booking starts scheduled, with a known discipline and length", async () => {
    const db = as("provider")
    await assertFails(setDoc(doc(db, "appointments", "n1"), booking("provider", "provider", { status: "completed" })))
    await assertFails(setDoc(doc(db, "appointments", "n2"), booking("provider", "provider", { discipline: "massage" })))
    await assertFails(setDoc(doc(db, "appointments", "n3"), booking("provider", "provider", { minutes: 20 })))
    await assertFails(setDoc(doc(db, "appointments", "n4"), booking("provider", "provider", { intakeId: "nope" })))
  })
  test("someone with no role can't read or book", async () => {
    await assertFails(getDoc(doc(as("nobody"), "appointments", "ap1")))
    await assertFails(setDoc(doc(as("nobody"), "appointments", "n1"), booking("nobody", "")))
  })
  test("a move with its history entry succeeds", async () => {
    await seed()
    await assertSucceeds(move(as("provider"), "provider", "provider", "c1"))
  })
  test("a move without a history entry fails", async () => {
    await seed()
    await assertFails(updateDoc(doc(as("provider"), "appointments", "ap1"), { start: new Date("2026-10-07T18:00:00Z"), updatedAt: serverTimestamp() }))
    await assertFails(
      updateDoc(doc(as("provider"), "appointments", "ap1"), { start: new Date("2026-10-07T18:00:00Z"), updatedAt: serverTimestamp(), lastChangeId: "ghost" }),
    )
  })
  test("a history entry can't be signed as someone else", async () => {
    await seed()
    await assertFails(move(as("provider"), "provider", "provider", "c1", undefined, change("admin", "admin")))
  })
  test("'added by' never changes", async () => {
    await seed()
    await assertFails(move(as("provider"), "provider", "provider", "c1", { addedBy: { uid: "provider", name: "provider", role: "provider" } }))
  })
  test("a cancelled appointment can't be moved", async () => {
    await seed()
    await assertSucceeds(move(as("provider"), "provider", "provider", "c1", { status: "cancelled" }, change("provider", "provider", { kind: "cancelled", from: { status: "scheduled" }, to: { status: "cancelled" } })))
    await assertFails(move(as("admin"), "admin", "admin", "c2"))
  })
  test("an appointment can still be cancelled after its intake record is deleted", async () => {
    await seed()
    await env.withSecurityRulesDisabled((c) => deleteDoc(doc(c.firestore(), "intakeRecords", "pending1")))
    await assertSucceeds(
      move(as("provider"), "provider", "provider", "c1", { status: "cancelled" }, change("provider", "provider", { kind: "cancelled", from: { status: "scheduled" }, to: { status: "cancelled" } })),
    )
  })
  test("a new booking still needs an existing intake record", async () => {
    await assertFails(setDoc(doc(as("provider"), "appointments", "n9"), booking("provider", "provider", { intakeId: "gone" })))
  })
  test("appointments are never deleted", async () => {
    await seed()
    await assertFails(deleteDoc(doc(as("super"), "appointments", "ap1")))
  })
  test("history: co-admins and up read it; providers and the dietitian don't; nobody edits it", async () => {
    await seed()
    await move(as("provider"), "provider", "provider", "c1")
    await assertSucceeds(getDoc(doc(as("coadmin"), "appointments/ap1/changes/c1")))
    await assertSucceeds(getDoc(doc(as("admin"), "appointments/ap1/changes/c1")))
    await assertFails(getDoc(doc(as("provider"), "appointments/ap1/changes/c1")))
    await assertFails(getDoc(doc(as("dietitian"), "appointments/ap1/changes/c1")))
    await assertFails(updateDoc(doc(as("super"), "appointments/ap1/changes/c1"), { reason: "edited" }))
    await assertFails(deleteDoc(doc(as("super"), "appointments/ap1/changes/c1")))
  })
  test("a history entry can't be written on its own", async () => {
    await seed()
    await assertFails(setDoc(doc(as("provider"), "appointments/ap1/changes/lonely"), change("provider", "provider")))
  })
  test("clinicians read the staff list, minus super admins", async () => {
    const db = as("provider")
    await assertSucceeds(getDoc(doc(db, "user", "dietitian")))
    await assertFails(getDoc(doc(db, "user", "super")))
    await assertSucceeds(getDocs(query(collection(db, "user"), where("role", "in", ["", "provider", "dietitian", "coAdmin", "admin"]))))
  })
})

describe("todos", () => {
  const todo = (uid, overrides = {}) => ({
    text: "Call the pharmacy",
    intakeId: "",
    patientName: "",
    due: "",
    visibility: "me",
    ownerUid: uid,
    ownerName: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    done: null,
    ...overrides,
  })
  const seed = (id, data) =>
    env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "todos", id), { ...data, createdAt: new Date(), updatedAt: new Date() }))
  const tick = (uid) => ({ done: { uid, name: uid, at: serverTimestamp() }, updatedAt: serverTimestamp() })

  test("anyone clinical adds a to-do as themselves", async () => {
    await assertSucceeds(setDoc(doc(as("provider"), "todos", "t1"), todo("provider")))
    await assertSucceeds(setDoc(doc(as("dietitian"), "todos", "t2"), todo("dietitian", { visibility: "everyone", due: "2026-10-09" })))
  })
  test("a to-do can't claim someone else, a past time, or come pre-ticked", async () => {
    const db = as("provider")
    await assertFails(setDoc(doc(db, "todos", "t1"), todo("admin")))
    await assertFails(setDoc(doc(db, "todos", "t2"), todo("provider", { createdAt: new Date("2020-01-01") })))
    await assertFails(setDoc(doc(db, "todos", "t3"), todo("provider", { done: { uid: "provider", name: "provider", at: serverTimestamp() } })))
  })
  test("empty text, a bad date or visibility, and extra fields are refused", async () => {
    const db = as("provider")
    await assertFails(setDoc(doc(db, "todos", "t1"), todo("provider", { text: "" })))
    await assertFails(setDoc(doc(db, "todos", "t2"), todo("provider", { due: "next week" })))
    await assertFails(setDoc(doc(db, "todos", "t3"), todo("provider", { visibility: "team" })))
    await assertFails(setDoc(doc(db, "todos", "t4"), todo("provider", { extra: 1 })))
  })
  test("someone with no role can't add or read", async () => {
    await seed("shared", todo("provider", { visibility: "everyone" }))
    await assertFails(setDoc(doc(as("nobody"), "todos", "t1"), todo("nobody")))
    await assertFails(getDoc(doc(as("nobody"), "todos", "shared")))
  })
  test("private items stay private; shared items are readable by any clinician", async () => {
    await seed("private", todo("provider"))
    await seed("shared", todo("provider", { visibility: "everyone" }))
    await assertSucceeds(getDoc(doc(as("provider"), "todos", "private")))
    await assertFails(getDoc(doc(as("provider2"), "todos", "private")))
    await assertSucceeds(getDoc(doc(as("dietitian"), "todos", "shared")))
    await assertSucceeds(getDocs(query(collection(as("provider2"), "todos"), where("visibility", "==", "everyone"))))
    await assertSucceeds(getDocs(query(collection(as("provider2"), "todos"), where("ownerUid", "==", "provider2"))))
  })
  test("only the author edits the text", async () => {
    await seed("shared", todo("provider", { visibility: "everyone" }))
    await assertSucceeds(updateDoc(doc(as("provider"), "todos", "shared"), { text: "Call them back", updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as("provider2"), "todos", "shared"), { text: "Changed", updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as("provider"), "todos", "shared"), { ownerUid: "provider2", updatedAt: serverTimestamp() }))
  })
  test("anyone can tick a shared item, only as themselves, and Undo it", async () => {
    await seed("shared", todo("provider", { visibility: "everyone" }))
    await assertFails(updateDoc(doc(as("provider2"), "todos", "shared"), { done: { uid: "admin", name: "admin", at: serverTimestamp() }, updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(as("provider2"), "todos", "shared"), tick("provider2")))
    await assertSucceeds(updateDoc(doc(as("dietitian"), "todos", "shared"), { done: null, updatedAt: serverTimestamp() }))
  })
  test("can't tick someone else's private item", async () => {
    await seed("private", todo("provider"))
    await assertFails(updateDoc(doc(as("provider2"), "todos", "private"), tick("provider2")))
  })
  test("to-dos are never deleted", async () => {
    await seed("private", todo("provider"))
    await assertFails(deleteDoc(doc(as("provider"), "todos", "private")))
    await assertFails(deleteDoc(doc(as("super"), "todos", "private")))
  })
})

describe("last sign in", () => {
  test("anyone stamps their own sign-in at server time", async () => {
    await assertSucceeds(updateDoc(doc(as("provider"), "user", "provider"), { lastSignInAt: serverTimestamp() }))
  })
  test("a client-chosen time is refused", async () => {
    await assertFails(updateDoc(doc(as("provider"), "user", "provider"), { lastSignInAt: new Date("2020-01-01") }))
  })
  test("you can't stamp someone else", async () => {
    await assertFails(updateDoc(doc(as("admin"), "user", "provider"), { lastSignInAt: serverTimestamp() }))
  })
  test("you can't change your role alongside your stamp", async () => {
    await assertFails(updateDoc(doc(as("provider"), "user", "provider"), { lastSignInAt: serverTimestamp(), role: "admin" }))
  })
  test("role change still works on a stamped record", async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), "user", "provider"), { lastSignInAt: new Date() }))
    await assertSucceeds(updateDoc(doc(as("admin"), "user", "provider"), { role: "coAdmin" }))
  })
  test("an admin can't set someone's sign-in time", async () => {
    await assertFails(setDoc(doc(as("admin"), "user", "newbie"), { role: "provider", name: "N", lastSignInAt: serverTimestamp() }))
  })
})

describe("patient accounts", () => {
  const asPatient = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore()

  test("a patient reads their own link doc", async () => {
    await assertSucceeds(getDoc(doc(asPatient("patient1", "p1@x.co"), "patientAccounts", "patient1")))
  })
  test("a patient can't read another patient's link doc", async () => {
    await assertFails(getDoc(doc(asPatient("patient1", "p1@x.co"), "patientAccounts", "patient2")))
  })
  test("signed-out visitors can't read link docs", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "patientAccounts", "patient1")))
  })
  test("a patient can't create, change or delete a link doc", async () => {
    const db = asPatient("newbie", "n@x.co")
    await assertFails(setDoc(doc(db, "patientAccounts", "newbie"), { email: "n@x.co", createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(db, "patientAccounts", "newbie"), { email: "n@x.co", intakeId: "chart1", firstName: "N", linkedAt: serverTimestamp() }))
    const own = asPatient("patient1", "p1@x.co")
    await assertFails(updateDoc(doc(own, "patientAccounts", "patient1"), { intakeId: "pending1" }))
    await assertFails(deleteDoc(doc(own, "patientAccounts", "patient1")))
  })
  test("clinical staff read link docs; nobody writes them from the client", async () => {
    await assertSucceeds(getDoc(doc(as("provider"), "patientAccounts", "patient1")))
    await assertSucceeds(getDocs(query(collection(as("provider"), "patientAccounts"), where("intakeId", "==", "chart1"))))
    await assertFails(setDoc(doc(as("super"), "patientAccounts", "x"), { email: "x@x.co", intakeId: "chart1", firstName: "X", linkedAt: serverTimestamp() }))
  })
})

describe("portal invites", () => {
  const newInvite = (uid = "provider", overrides = {}) => ({
    to: "pat@x.co",
    firstName: "Pat",
    subject: "Set up your portal",
    message: "Hi Pat",
    status: "ready",
    createdBy: { uid, name: uid },
    createdAt: serverTimestamp(),
    ...overrides,
  })
  const inviteRef = (db, id, chart = "chart1") => doc(db, `patients/${chart}/invites/${id}`)
  const seedReady = (id) =>
    env.withSecurityRulesDisabled((c) => setDoc(inviteRef(c.firestore(), id), { ...newInvite(), createdAt: new Date() }))

  test("a provider saves a ready invite to the intake email", async () => {
    await assertSucceeds(setDoc(inviteRef(as("provider"), "new1"), newInvite()))
  })
  test("an invite must go to the intake email, start ready, and be made by its creator", async () => {
    const db = as("provider")
    await assertFails(setDoc(inviteRef(db, "x1"), newInvite("provider", { to: "other@x.co" })))
    await assertFails(setDoc(inviteRef(db, "x2"), newInvite("provider", { status: "sent" })))
    await assertFails(setDoc(inviteRef(db, "x3"), newInvite("provider", { createdBy: { uid: "admin", name: "admin" } })))
    await assertFails(setDoc(inviteRef(db, "x4"), newInvite("provider", { extra: 1 })))
    await assertFails(setDoc(inviteRef(db, "x5", "inactive1"), newInvite()))
  })
  test("a dietitian can't send invites", async () => {
    await assertFails(setDoc(inviteRef(as("dietitian"), "d1"), newInvite("dietitian")))
  })
  test("a ready invite becomes sent or failed, nothing else", async () => {
    const db = as("provider")
    await assertSucceeds(updateDoc(inviteRef(db, "ready1"), { status: "sent", sentAt: serverTimestamp() }))
    await seedReady("ready2")
    await assertSucceeds(updateDoc(inviteRef(db, "ready2"), { status: "failed", error: "Bad template" }))
    await assertFails(updateDoc(inviteRef(db, "sent1"), { status: "failed", error: "x" }))
    await seedReady("ready3")
    await assertFails(updateDoc(inviteRef(db, "ready3"), { message: "changed" }))
    await assertFails(updateDoc(inviteRef(db, "ready3"), { status: "sent", sentAt: new Date("2020-01-01") }))
    await assertFails(deleteDoc(inviteRef(db, "ready3")))
  })
  test("signed out, a sent invite can be read by its id but never listed", async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(inviteRef(anon, "sent1")))
    await assertFails(getDoc(inviteRef(anon, "ready1")))
    await assertFails(getDocs(collection(anon, "patients/chart1/invites")))
    await assertSucceeds(getDocs(collection(as("provider"), "patients/chart1/invites")))
  })
  test("co-admins and up save the invite template; clinicians read it", async () => {
    const template = (uid) => ({ subject: "s", message: "m", updatedBy: { uid, name: uid }, updatedAt: serverTimestamp() })
    await assertSucceeds(setDoc(doc(as("coadmin"), "settings", "portalInvite"), template("coadmin")))
    await assertFails(setDoc(doc(as("provider"), "settings", "portalInvite"), template("provider")))
    await assertFails(setDoc(doc(as("coadmin"), "settings", "portalInvite"), template("admin")))
    await assertSucceeds(getDoc(doc(as("provider"), "settings", "portalInvite")))
  })
})
