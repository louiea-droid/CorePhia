// firestore.rules tests: staff roles, applicant status, the public forms,
// site events, staff photos, the audit log, and that the collections retired
// with Elation (2026-11-13) refuse every browser write.
//
// Run: npm run test:rules
// Needs Java 21+ for the Firestore emulator (firebase-tools starts it).
// Run them before every rules deploy.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { after, before, beforeEach, describe, test } from "node:test"
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing"
import {
  collection,
  collectionGroup,
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
    const invite = { to: "pat@x.co", firstName: "Pat", createdBy: { uid: "provider", name: "provider" }, createdAt: new Date() }
    await setDoc(doc(db, "patients/chart1/invites/sent1"), { ...invite, status: "sent", sentAt: new Date() })
    await setDoc(doc(db, "patients/chart1/invites/ready1"), { ...invite, status: "ready" })
    await setDoc(doc(db, "patients/chart1/invites/old1"), { ...invite, status: "sent", sentAt: new Date(Date.now() - 8 * 86400000) })
    await setDoc(doc(db, "patientAccounts", "p2"), { email: "pat@x.co", intakeId: "chart1", firstName: "Pat", inviteId: "sent1", linkedAt: new Date() })
    await setDoc(doc(db, "patients", "inactive1"), { intakeRecordId: "inactive1", status: "inactive" })
    await setDoc(doc(db, "intakeRecords", "inactive1"), { status: "declined", demographics: { email: "pat@x.co" } })
    await setDoc(doc(db, "patientAccounts", "patient1"), { email: "p1@x.co", intakeId: "chart1", firstName: "Pat", linkedAt: new Date() })
    await setDoc(doc(db, "patientAccounts", "patient2"), { email: "p2@x.co", intakeId: "pending1", firstName: "Sam", linkedAt: new Date() })
    await setDoc(doc(db, "intakeRecords", "paid1"), { status: "admitted", demographics: { email: "paid@x.co" } })
    await setDoc(doc(db, "patients", "paid1"), {
      intakeRecordId: "paid1",
      status: "active",
      membership: { plan: "Core", status: "active", source: "stripe", currentPeriodEnd: new Date(), cancelAtPeriodEnd: false, since: new Date(), updatedAt: new Date() },
    })
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
    await assertFails(setDoc(doc(db, "user", "newbie"), { role: "provider", name: "N", addedBy: { uid: "admin", name: "Someone else" }, addedAt: serverTimestamp() }))
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
  test("a co-admin can add providers and co-admins, but not name them", async () => {
    // A name is what signed notes carry, so only the admin tiers set it.
    await assertFails(setDoc(doc(as("coadmin"), "user", "named"), { role: "provider", name: "Dr. Daniel Antonious" }))
    await assertSucceeds(setDoc(doc(as("admin"), "user", "named"), { role: "provider", name: "Jordan Lee, NP" }))
    await assertSucceeds(setDoc(doc(as("coadmin"), "user", "newbie"), { role: "coAdmin" }))
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
  test("an admin renames a provider, dietitian or co-admin; a super admin renames anyone but themselves", async () => {
    await assertSucceeds(updateDoc(doc(as("admin"), "user", "provider"), { name: "Jordan Lee, NP" }))
    await assertSucceeds(updateDoc(doc(as("admin"), "user", "dietitian"), { name: "Sam Rivera, RD" }))
    await assertSucceeds(updateDoc(doc(as("admin"), "user", "coadmin"), { name: "Casey" }))
    await assertSucceeds(updateDoc(doc(as("super"), "user", "admin"), { name: "Dr. A" }))
    await assertFails(updateDoc(doc(as("super"), "user", "super"), { name: "Me" }))
  })
  test("an admin can't rename another admin or a super admin", async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "user", "admin2"), { role: "admin", name: "admin2" }))
    await assertFails(updateDoc(doc(as("admin"), "user", "admin2"), { name: "X" }))
    await assertFails(updateDoc(doc(as("admin"), "user", "super"), { name: "X" }))
  })
  test("a co-admin, provider or dietitian can't rename anyone", async () => {
    await assertFails(updateDoc(doc(as("coadmin"), "user", "provider"), { name: "X" }))
    await assertFails(updateDoc(doc(as("provider"), "user", "provider2"), { name: "X" }))
    await assertFails(updateDoc(doc(as("dietitian"), "user", "provider"), { name: "X" }))
  })
  test("a name is 1 to 100 characters", async () => {
    await assertFails(updateDoc(doc(as("admin"), "user", "provider"), { name: "" }))
    await assertFails(updateDoc(doc(as("admin"), "user", "provider"), { name: "x".repeat(101) }))
    await assertSucceeds(updateDoc(doc(as("admin"), "user", "provider"), { name: "x".repeat(100) }))
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

describe("applicant status", () => {
  // Admitting is a status change only since Elation (2026-11-13): no chart is written.
  test("an admitter sets the status with no chart write", async () => {
    await assertSucceeds(updateDoc(doc(as("provider"), "intakeRecords", "pending1"), { status: "admitted" }))
    await assertSucceeds(updateDoc(doc(as("admin"), "intakeRecords", "pending1"), { status: "declined" }))
    await assertFails(updateDoc(doc(as("dietitian"), "intakeRecords", "pending1"), { status: "admitted" }))
  })
})

describe("retired collections (Elation, 2026-11-13)", () => {
  test("nobody writes charts, appointments, todos, mail or patient accounts from the browser", async () => {
    await assertFails(setDoc(doc(as("super"), "patients", "new1"), { status: "active" }))
    await assertFails(setDoc(doc(as("admin"), "appointments", "a1"), { intakeId: "chart1" }))
    await assertFails(setDoc(doc(as("provider"), "todos", "t1"), { text: "x" }))
    await assertFails(setDoc(doc(as("super"), "mail", "m1"), { kind: "staff", createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(as("patient1"), "patientAccounts", "patient1"), { email: "p1@x.co" }))
    await assertFails(getDoc(doc(as("super"), "patients", "chart1")))
  })

  test("the super admin deletes any intake, admitted ones too", async () => {
    await assertSucceeds(deleteDoc(doc(as("super"), "intakeRecords", "chart1")))
    await assertFails(deleteDoc(doc(as("admin"), "intakeRecords", "pending1")))
  })
})

describe("audit log", () => {
  const withEmail = (uid, email) => env.authenticatedContext(uid, { email }).firestore()
  const entry = (overrides = {}) => ({
    actorUid: "provider",
    actorEmail: "provider@x.co",
    action: "view_intake_record",
    targetCollection: "intakeRecords",
    targetId: "pending1",
    targetLabel: "Test Patient",
    at: serverTimestamp(),
    ...overrides,
  })

  test("staff write their own entry with the server's time", async () => {
    await assertSucceeds(setDoc(doc(withEmail("provider", "provider@x.co"), "auditLog", "a1"), entry()))
  })
  test("an entry can't claim someone else's email, a client time or an unknown action", async () => {
    const db = withEmail("provider", "provider@x.co")
    await assertFails(setDoc(doc(db, "auditLog", "a2"), entry({ actorEmail: "admin@x.co" })))
    await assertFails(setDoc(doc(db, "auditLog", "a3"), entry({ at: new Date("2099-01-01") })))
    await assertFails(setDoc(doc(db, "auditLog", "a4"), entry({ at: "2026-01-01T00:00:00Z" })))
    await assertFails(setDoc(doc(db, "auditLog", "a5"), entry({ action: "made_up" })))
    await assertFails(setDoc(doc(db, "auditLog", "a8"), entry({ action: "sign_note" })))
    await assertFails(setDoc(doc(db, "auditLog", "a6"), entry({ actorUid: "admin" })))
  })
  test("entries are append-only and only the super admin reads them", async () => {
    await assertSucceeds(setDoc(doc(withEmail("provider", "provider@x.co"), "auditLog", "a7"), entry()))
    await assertFails(updateDoc(doc(as("super"), "auditLog", "a7"), { targetLabel: "x" }))
    await assertFails(deleteDoc(doc(as("super"), "auditLog", "a7")))
    await assertFails(getDoc(doc(as("admin"), "auditLog", "a7")))
    await assertSucceeds(getDoc(doc(as("super"), "auditLog", "a7")))
  })
})

describe("public intake and contact forms", () => {
  const visitor = () => env.unauthenticatedContext().firestore()
  // The shape PatientIntakeForm.buildIntakeRecord sends.
  const intake = (overrides = {}) => ({
    submittedAt: "2026-10-08T14:03:09.123Z",
    demographics: {
      firstName: "Test",
      lastName: "Patient",
      dateOfBirth: "1980-03-15",
      sexAssignedAtBirth: "Female",
      phone: "8135550100",
      email: "test@x.co",
      address: { line1: "", city: "Tampa", state: "FL", postalCode: "33601" },
    },
    vitals: { heightFeet: "5", heightInches: "6", currentWeightLb: "210", goalWeightLb: "170", weightLossGoalRange: "", highestAdultWeightLb: "230" },
    medicalHistory: { conditions: ["None of the above"], medications: "", allergies: "", surgeries: "", priorWeightLossTreatment: "No", medicationInterest: "unsure" },
    familyHistory: { conditions: [], notes: "" },
    socialHistory: { tobacco: "Never", alcohol: "None", exerciseFrequency: "Rarely" },
    nutrition: { waterIntake: "", estimatedDailyCalories: "", estimatedDailyCaloriesRange: "Not sure", mealsPerDay: "3", dietNotes: "" },
    visit: { membershipPlan: "", reason: "Weight loss", preferredDate: "2026-10-20", preferredTime: "Morning", notes: "" },
    consent: { telehealth: true, hipaaAcknowledged: true, signature: "Test Patient", signedOn: "2026-10-08" },
    ...overrides,
  })
  const contact = (overrides = {}) => ({
    name: "Visitor",
    phone: "8135550100",
    email: "v@x.co",
    interest: "General question",
    message: "Hello",
    submittedAt: "2026-10-08T14:03:09.123Z",
    ...overrides,
  })

  test("the intake form's own record is accepted", async () => {
    await assertSucceeds(setDoc(doc(visitor(), "intakeRecords", "i1"), intake()))
  })
  test("an intake can't carry values that break the admin", async () => {
    await assertFails(setDoc(doc(visitor(), "intakeRecords", "i2"), intake({ submittedAt: "2099-01-01" })))
    await assertFails(setDoc(doc(visitor(), "intakeRecords", "i3"), intake({ submittedAt: {} })))
    await assertFails(setDoc(doc(visitor(), "intakeRecords", "i4"), intake({ medicalHistory: { conditions: { x: 1 } } })))
    await assertFails(setDoc(doc(visitor(), "intakeRecords", "i5"), intake({ vitals: "tall" })))
    await assertFails(
      setDoc(doc(visitor(), "intakeRecords", "i6"), intake({ demographics: { ...intake().demographics, dateOfBirth: "03/15/1980" } })),
    )
    await assertFails(setDoc(doc(visitor(), "intakeRecords", "i7"), intake({ emergencyContact: { name: "X" } })))
  })
  test("an intake section holds only the form's fields, each capped", async () => {
    const d = intake().demographics
    await assertFails(setDoc(doc(visitor(), "intakeRecords", "i8"), intake({ demographics: { ...d, emergencyContact: { name: "X" } } })))
    await assertFails(setDoc(doc(visitor(), "intakeRecords", "i9"), intake({ insurance: {} })))
    await assertFails(
      setDoc(doc(visitor(), "intakeRecords", "i10"), intake({ medicalHistory: { ...intake().medicalHistory, medications: "x".repeat(2001) } })),
    )
    await assertFails(setDoc(doc(visitor(), "intakeRecords", "i11"), intake({ consent: { ...intake().consent, signature: "x".repeat(201) } })))
    await assertFails(setDoc(doc(visitor(), "intakeRecords", "i12"), intake({ visit: { ...intake().visit, extra: "x" } })))
    await assertSucceeds(
      setDoc(doc(visitor(), "intakeRecords", "i13"), intake({ medicalHistory: { ...intake().medicalHistory, medications: "x".repeat(2000) } })),
    )
  })
  test("a contact message needs the form's time format", async () => {
    await assertSucceeds(setDoc(doc(visitor(), "contactMessages", "c1"), contact()))
    await assertFails(setDoc(doc(visitor(), "contactMessages", "c2"), contact({ submittedAt: "2099-01-01" })))
  })
})
describe("site events", () => {
  const visitor = () => env.unauthenticatedContext().firestore()
  const event = (overrides = {}) => ({ type: "pageview", path: "/about", label: "", day: "2026-10-08", at: serverTimestamp(), ...overrides })

  test("an anonymous page view or click is accepted in exactly that shape", async () => {
    await assertSucceeds(setDoc(doc(visitor(), "siteEvents", "e1"), event()))
    await assertSucceeds(setDoc(doc(visitor(), "siteEvents", "e2"), event({ type: "click", label: "Get started" })))
  })
  test("nothing from the account, admin or inside the intake, and no extra fields", async () => {
    await assertFails(setDoc(doc(visitor(), "siteEvents", "e3"), event({ path: "/admin/patients" })))
    await assertFails(setDoc(doc(visitor(), "siteEvents", "e4"), event({ path: "/account" })))
    await assertFails(setDoc(doc(visitor(), "siteEvents", "e5"), event({ type: "click", path: "/intake" })))
    await assertSucceeds(setDoc(doc(visitor(), "siteEvents", "e6"), event({ path: "/intake" })))
    await assertFails(setDoc(doc(visitor(), "siteEvents", "e7"), event({ email: "x@x.co" })))
    await assertFails(setDoc(doc(visitor(), "siteEvents", "e8"), event({ at: new Date("2026-01-01") })))
  })
  test("only co-admin and up read them, and nobody edits them", async () => {
    await assertSucceeds(setDoc(doc(visitor(), "siteEvents", "e9"), event()))
    await assertFails(getDoc(doc(visitor(), "siteEvents", "e9")))
    await assertFails(getDoc(doc(as("provider"), "siteEvents", "e9")))
    await assertSucceeds(getDoc(doc(as("coadmin"), "siteEvents", "e9")))
    await assertFails(deleteDoc(doc(as("super"), "siteEvents", "e9")))
  })
})
describe("staff photos", () => {
  const photo = (overrides = {}) => ({ image: "data:image/jpeg;base64,/9j/4AAQSkZJRg==", updatedAt: serverTimestamp(), ...overrides })

  test("staff set, change and remove their own photo, and the team sees it", async () => {
    await assertSucceeds(setDoc(doc(as("provider"), "staffPhotos", "provider"), photo()))
    await assertSucceeds(setDoc(doc(as("provider"), "staffPhotos", "provider"), photo({ image: "data:image/jpeg;base64,AAAA" })))
    await assertSucceeds(getDoc(doc(as("dietitian"), "staffPhotos", "provider")))
    await assertSucceeds(deleteDoc(doc(as("provider"), "staffPhotos", "provider")))
  })
  test("nobody sets someone else's photo, and only small JPEG data is accepted", async () => {
    await assertFails(setDoc(doc(as("super"), "staffPhotos", "provider"), photo()))
    await assertFails(setDoc(doc(as("provider"), "staffPhotos", "provider"), photo({ image: "https://example.com/a.jpg" })))
    await assertFails(setDoc(doc(as("provider"), "staffPhotos", "provider"), photo({ image: `data:image/jpeg;base64,${"A".repeat(140000)}` })))
    await assertFails(setDoc(doc(as("provider"), "staffPhotos", "provider"), photo({ caption: "hi" })))
    await assertFails(setDoc(doc(as("provider"), "staffPhotos", "provider"), photo({ updatedAt: new Date("2020-01-01") })))
  })
  test("signed-out visitors and patients can't read staff photos", async () => {
    await assertSucceeds(setDoc(doc(as("provider"), "staffPhotos", "provider"), photo()))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "staffPhotos", "provider")))
    await assertFails(getDoc(doc(env.authenticatedContext("patient1", { email: "p1@x.co" }).firestore(), "staffPhotos", "provider")))
  })
})