import assert from "node:assert/strict"
import { filterStaff } from "./staffMath.js"

const staff = [
  { uid: "1", name: "Sam Rivera, RD", email: "sam@corephia.com", role: "dietitian" },
  { uid: "2", name: "", email: "ProviderMD@CorePhia.com", role: "provider" },
  { uid: "3", name: "Jordan Lee, NP", email: "jordan@corephia.com", role: "" },
  { uid: "4", name: "Alex Admin", email: "alex@corephia.com", role: "admin" },
]
const uids = (list) => list.map((member) => member.uid)

// Sorted by what's shown: the name, or the part of the email before @.
assert.deepEqual(uids(filterStaff(staff, {})), ["4", "3", "2", "1"])
// Search matches name or email, ignoring case.
assert.deepEqual(uids(filterStaff(staff, { search: "RIVERA" })), ["1"])
assert.deepEqual(uids(filterStaff(staff, { search: "providermd@" })), ["2"])
assert.deepEqual(filterStaff(staff, { search: "nobody" }), [])
// Role filter: a role, or "" for No access.
assert.deepEqual(uids(filterStaff(staff, { role: "provider" })), ["2"])
assert.deepEqual(uids(filterStaff(staff, { role: "" })), ["3"])
assert.deepEqual(uids(filterStaff(staff, { role: "provider", search: "sam" })), [])

console.log("staffMath: all checks passed")
