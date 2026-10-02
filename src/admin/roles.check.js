// Self-check for roles.js: `npm run check`. Plain node:assert, like
// chartMath.check.js.
import assert from "node:assert/strict"
import { canAdmit, canAmend, canManageMember, canOpen, canWriteNote, grantableRoles, isClinicalRole } from "./roles.js"

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

console.log("roles: all checks passed")
