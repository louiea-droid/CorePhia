// firestore.rules tests for charts, notes, amendments and staff roles.
//
// Run: npm run test:rules
// Needs Java 21+ for the Firestore emulator (firebase-tools starts it). This
// machine had no Java when these were written (2026-10-01), so they have not
// been run yet. Run them before deploying the rules.
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

const ROLES = { super: "superAdmin", admin: "admin", coadmin: "coAdmin", coadmin2: "coAdmin", provider: "provider", provider2: "provider" }
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
    await setDoc(doc(db, "intakeRecords", "chart1"), { status: "admitted" })
    await setDoc(doc(db, "patients", "chart1"), { intakeRecordId: "chart1", status: "active" })
    await setDoc(doc(db, "patients/chart1/notes/signed1"), { ...draft("provider", "provider"), status: "signed" })
    await setDoc(doc(db, "patients/chart1/notes/draft1"), draft("provider", "provider"))
    await setDoc(doc(db, "contactMessages", "m1"), { name: "x" })
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
