// Self-check for roles.js: `npm run check`. Plain node:assert, like the other checks.
import assert from "node:assert/strict"
import {
  canAdmit,
  canManageMember,
  canNameStaff,
  canOpen,
  canRenameMember,
  grantableRoles,
  isClinicalRole,
  staffDisplayName,
} from "./roles.js"

// The dietitian is clinical: opens Dashboard and Applicants; not Messages or Staff.
assert.equal(isClinicalRole("dietitian"), true)
for (const page of ["dashboard", "applicants", "security"]) assert.equal(canOpen(page, "dietitian"), true, page)
for (const page of ["messages", "analytics", "staff", "activity"]) assert.equal(canOpen(page, "dietitian"), false, page)

// Naming a staff account: admin tiers only.
for (const role of ["admin", "superAdmin"]) assert.equal(canNameStaff(role), true, role)
for (const role of ["coAdmin", "provider", "dietitian", ""]) assert.equal(canNameStaff(role), false, role)

// Admitting and declining: everyone clinical except the dietitian.
assert.equal(canAdmit("dietitian"), false)
assert.equal(canAdmit("provider"), true)

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

// Staff are shown by name only; with no name set, the part of the email before @.
assert.equal(staffDisplayName({ name: "Sam Rivera, RD", email: "sam@corephia.com" }), "Sam Rivera, RD")
assert.equal(staffDisplayName({ name: "", email: "ProviderMD@CorePhia.com" }), "ProviderMD")
assert.equal(staffDisplayName({ email: "test@gmail.com" }), "test")
assert.equal(staffDisplayName({ name: "ProviderMD@CorePhia.com" }), "ProviderMD")
assert.equal(staffDisplayName({}), "")

// Help is open to every clinical role, and to nobody without one.
for (const role of ["dietitian", "provider", "coAdmin", "admin", "superAdmin"]) assert.equal(canOpen("help", role), true, role)
assert.equal(canOpen("help", ""), false)

// Charts, To-do, Calendar and the patient inbox moved to Elation (2026-11-13): nobody opens them.
for (const page of ["patients", "todo", "calendar", "inbox"])
  for (const role of ["dietitian", "provider", "coAdmin", "admin", "superAdmin"]) assert.equal(canOpen(page, role), false, `${page} ${role}`)

console.log("roles: all checks passed")
