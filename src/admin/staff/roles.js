// Who can open what. The sidebar and the route guards both read this, and
// firestore.rules enforces the same lines independently (isClinical / isStaff,
// canActOn, isRoleChange), so a role edited in the browser gains nothing.
//
// admin is Dr. Antonious; coAdmin is anyone he adds at that level (Louie,
// 2026-10-01). Same pages, but a co-admin can't change or delete the admin
// or another co-admin, so nobody below super admin can remove him.
export const ROLE_LABELS = {
  superAdmin: "Super admin",
  admin: "Admin",
  coAdmin: "Co-admin",
  provider: "Provider",
  dietitian: "Dietitian",
}

export const CLINICAL_ROLES = ["dietitian", "provider", "coAdmin", "admin", "superAdmin"]
const STAFF_ROLES = ["coAdmin", "admin", "superAdmin"]
// Everyone clinical except the dietitian admits and declines applicants.
const ADMITTERS = ["provider", "coAdmin", "admin", "superAdmin"]

export const isClinicalRole = (role) => CLINICAL_ROLES.includes(role)

const PAGE_ROLES = {
  dashboard: CLINICAL_ROLES,
  applicants: CLINICAL_ROLES,
  messages: STAFF_ROLES,
  analytics: STAFF_ROLES,
  staff: STAFF_ROLES,
  activity: ["superAdmin"],
  security: CLINICAL_ROLES,
  help: CLINICAL_ROLES,
}

export const canOpen = (page, role) => PAGE_ROLES[page]?.includes(role) ?? false

export const canAdmit = (role) => ADMITTERS.includes(role)
// Renaming someone else's staff record: admin and super admin only, and only
// accounts they can already manage. Mirrors the name check in isRoleChange.
export const canRenameMember = (viewer, member) => canNameStaff(viewer.role) && canManageMember(viewer, member)

// Setting a staff account's name, including when adding it: admin and super
// admin only, so nobody else can create an account named as someone else. Mirrors the name check in isRoleChange.
export function canNameStaff(role) {
  return ["admin", "superAdmin"].includes(role)
}

// The roles a signed-in person may hand out on the Staff page. Only a super
// admin grants admin or super admin.
export const grantableRoles = (role) =>
  role === "superAdmin"
    ? ["provider", "dietitian", "coAdmin", "admin", "superAdmin"]
    : role === "admin" || role === "coAdmin"
      ? ["provider", "dietitian", "coAdmin"]
      : []

// Whose current role a person may change or delete (never their own):
// super admin, anyone; admin, providers, dietitians, co-admins and no-access
// accounts; co-admin, providers, dietitians and no-access accounts only.
// Mirrors canActOn.
const ACTS_ON = { admin: ["", "provider", "dietitian", "coAdmin"], coAdmin: ["", "provider", "dietitian"] }

export const canManageMember = (viewer, member) =>
  member.uid !== viewer.uid &&
  (viewer.role === "superAdmin" || (ACTS_ON[viewer.role]?.includes(member.role ?? "") ?? false))

// How a staff member is shown in lists: their name, or with none set, the part of their email before @.
export function staffDisplayName(member) {
  const raw = member?.name?.trim() || member?.email || ""
  return raw.includes("@") ? raw.split("@")[0] : raw
}
