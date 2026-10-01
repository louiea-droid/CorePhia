// Who can open what. The sidebar and the route guards both read this, and
// firestore.rules enforces the same lines independently (isClinical / isStaff,
// canActOn, isRoleChange), so a role edited in the browser gains nothing.
//
// admin is Dr. Antonious; coAdmin is anyone he adds at that level (Louie,
// 2026-10-01). Same pages, but a co-admin can't change or delete the admin
// or another co-admin, so nobody below super admin can remove him.
export const ROLE_LABELS = { superAdmin: "Super admin", admin: "Admin", coAdmin: "Co-admin", provider: "Provider" }

export const CLINICAL_ROLES = ["provider", "coAdmin", "admin", "superAdmin"]
const STAFF_ROLES = ["coAdmin", "admin", "superAdmin"]

export const isClinicalRole = (role) => CLINICAL_ROLES.includes(role)

const PAGE_ROLES = {
  dashboard: CLINICAL_ROLES,
  applicants: CLINICAL_ROLES,
  patients: CLINICAL_ROLES,
  todo: CLINICAL_ROLES,
  messages: STAFF_ROLES,
  analytics: STAFF_ROLES,
  staff: STAFF_ROLES,
  activity: ["superAdmin"],
  security: CLINICAL_ROLES,
}

export const canOpen = (page, role) => PAGE_ROLES[page]?.includes(role) ?? false

// The roles a signed-in person may hand out on the Staff page. Only a super
// admin grants admin or super admin.
export const grantableRoles = (role) =>
  role === "superAdmin"
    ? ["provider", "coAdmin", "admin", "superAdmin"]
    : role === "admin" || role === "coAdmin"
      ? ["provider", "coAdmin"]
      : []

// Whose current role a person may change or delete (never their own):
// super admin, anyone; admin, providers, co-admins and no-access accounts;
// co-admin, providers and no-access accounts only. Mirrors canActOn.
const ACTS_ON = { admin: ["", "provider", "coAdmin"], coAdmin: ["", "provider"] }

export const canManageMember = (viewer, member) =>
  member.uid !== viewer.uid &&
  (viewer.role === "superAdmin" || (ACTS_ON[viewer.role]?.includes(member.role ?? "") ?? false))
