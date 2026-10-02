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

// What to tell the person when adding or changing staff fails.
export const staffErrorMessage = (cause) => {
  switch (cause?.code) {
    case "auth/email-already-in-use":
      return "This email already has an account. Ask Hyacinth to assign the role."
    case "auth/invalid-email":
      return "That doesn't look like a full email address."
    case "permission-denied":
      return "Your role can't do this."
    default:
      return "Something went wrong. Nothing was changed. Try again."
  }
}
