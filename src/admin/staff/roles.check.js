// Self-check for roles.js: `npm run check`. Plain node:assert, like
// chartMath.check.js.
import assert from "node:assert/strict"
import {
  canAdmit,
  canEditInviteTemplate,
  canRemoveUpdate,
  canAmend,
  canManageMember,
  canOpen,
  canRenameMember,
  canSeeAppointmentHistory,
  canWriteNote,
  grantableRoles,
  isClinicalRole,
  staffDisplayName,
} from "./roles.js"

// The dietitian is clinical: opens charts, To-do, Calendar; not Messages or Staff.
assert.equal(isClinicalRole("dietitian"), true)
for (const page of ["dashboard", "applicants", "patients", "todo", "calendar", "security"]) assert.equal(canOpen(page, "dietitian"), true, page)
for (const page of ["messages", "analytics", "staff", "activity"]) assert.equal(canOpen(page, "dietitian"), false, page)

// Who writes which note type.
assert.equal(canWriteNote("dietitian", "dietitian"), true)
assert.equal(canWriteNote("dietitian", "admin"), true)
for (const role of ["provider", "coAdmin", "superAdmin"]) assert.equal(canWriteNote("dietitian", role), false, role)
for (const type of ["consultation", "progress", "exercise"]) {
  assert.equal(canWriteNote(type, "dietitian"), false, type)
  for (const role of ["provider", "coAdmin", "admin", "superAdmin"]) assert.equal(canWriteNote(type, role), true, `${type} ${role}`)
}
assert.equal(canWriteNote("unknown", "admin"), false)

// Admitting and declining: everyone clinical except the dietitian.
assert.equal(canAdmit("dietitian"), false)
assert.equal(canAdmit("provider"), true)
// The portal-invite template: co-admin and up (settings/portalInvite in firestore.rules).
for (const role of ["coAdmin", "admin", "superAdmin"]) assert.equal(canEditInviteTemplate(role), true, role)
for (const role of ["provider", "dietitian", ""]) assert.equal(canEditInviteTemplate(role), false, role)
assert.equal(canAdmit(null), false)

// Addenda: a dietitian only on dietitian notes; others on anything.
assert.equal(canAmend("dietitian", "dietitian"), true)
assert.equal(canAmend("progress", "dietitian"), false)
assert.equal(canAmend("dietitian", "provider"), true)
assert.equal(canAmend("progress", ""), false)

// Granting: admin and co-admin can hand out dietitian; and manage dietitians.
assert.ok(grantableRoles("admin").includes("dietitian"))
assert.ok(grantableRoles("coAdmin").includes("dietitian"))
assert.ok(grantableRoles("superAdmin").includes("dietitian"))
assert.equal(canManageMember({ uid: "a", role: "coAdmin" }, { uid: "d", role: "dietitian" }), true)
assert.equal(canManageMember({ uid: "a", role: "admin" }, { uid: "d", role: "dietitian" }), true)
assert.equal(canManageMember({ uid: "d", role: "dietitian" }, { uid: "p", role: "provider" }), false)

// Renaming: admin and super admin only, on accounts they can manage, never their own.
const target = (role, uid = "t") => ({ uid, role })
assert.equal(canRenameMember({ uid: "a", role: "admin" }, target("provider")), true)
assert.equal(canRenameMember({ uid: "a", role: "admin" }, target("coAdmin")), true)
assert.equal(canRenameMember({ uid: "a", role: "admin" }, target("admin")), false)
assert.equal(canRenameMember({ uid: "a", role: "admin" }, target("superAdmin")), false)
assert.equal(canRenameMember({ uid: "s", role: "superAdmin" }, target("admin")), true)
assert.equal(canRenameMember({ uid: "s", role: "superAdmin" }, target("superAdmin", "s")), false)
for (const role of ["coAdmin", "provider", "dietitian"]) assert.equal(canRenameMember({ uid: "a", role }, target("provider")), false, role)

// Appointment history: co-admin, admin, super admin.
for (const role of ["coAdmin", "admin", "superAdmin"]) assert.equal(canSeeAppointmentHistory(role), true, role)
for (const role of ["provider", "dietitian", ""]) assert.equal(canSeeAppointmentHistory(role), false, role)

// Staff are shown by name only; with no name set, the part of the email before @.
assert.equal(staffDisplayName({ name: "Sam Rivera, RD", email: "sam@corephia.com" }), "Sam Rivera, RD")
assert.equal(staffDisplayName({ name: "", email: "ProviderMD@CorePhia.com" }), "ProviderMD")
assert.equal(staffDisplayName({ email: "test@gmail.com" }), "test")
assert.equal(staffDisplayName({ name: "ProviderMD@CorePhia.com" }), "ProviderMD")
assert.equal(staffDisplayName({}), "")

// The author or co-admin and up take an update out of the portal, once.
const posted = { author: { uid: "p1" }, removed: false }
assert.equal(canRemoveUpdate(posted, { uid: "p1", role: "provider" }), true)
assert.equal(canRemoveUpdate(posted, { uid: "d1", role: "dietitian" }), false)
assert.equal(canRemoveUpdate(posted, { uid: "p2", role: "provider" }), false)
assert.equal(canRemoveUpdate(posted, { uid: "c1", role: "coAdmin" }), true)
assert.equal(canRemoveUpdate({ ...posted, removed: { by: { uid: "p1" } } }, { uid: "p1", role: "provider" }), false)

// Help is open to every clinical role, and to nobody without one.
for (const role of ["dietitian", "provider", "coAdmin", "admin", "superAdmin"]) assert.equal(canOpen("help", role), true, role)
assert.equal(canOpen("help", ""), false)

// The patient Messages inbox is for every clinical role.
assert.equal(canOpen("inbox", "dietitian"), true)
assert.equal(canOpen("inbox", "provider"), true)
assert.equal(canOpen("inbox", ""), false)

console.log("roles: all checks passed")
