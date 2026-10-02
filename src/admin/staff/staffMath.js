// Search, role filter and sort for the Staff table. Pure: staffMath.check.js
// runs it under node.
import { staffDisplayName } from "./roles.js"

export function filterStaff(members, { search = "", role = "all" } = {}) {
  const needle = search.trim().toLowerCase()
  return members
    .filter((member) => role === "all" || (member.role ?? "") === role)
    .filter((member) => !needle || `${member.name ?? ""} ${member.email ?? ""}`.toLowerCase().includes(needle))
    .toSorted((a, b) => staffDisplayName(a).localeCompare(staffDisplayName(b)))
}
