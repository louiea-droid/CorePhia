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
// Everyone clinical except the dietitian: admits applicants, writes medical
// and exercise notes. Exercise notes are theirs until an exercise role exists
// (Louie, 2026-10-02).
const PRESCRIBERS = ["provider", "coAdmin", "admin", "superAdmin"]

export const isClinicalRole = (role) => CLINICAL_ROLES.includes(role)

const PAGE_ROLES = {
  dashboard: CLINICAL_ROLES,
  applicants: CLINICAL_ROLES,
  patients: CLINICAL_ROLES,
  todo: CLINICAL_ROLES,
  calendar: CLINICAL_ROLES,
  inbox: CLINICAL_ROLES,
  messages: STAFF_ROLES,
  analytics: STAFF_ROLES,
  staff: STAFF_ROLES,
  activity: ["superAdmin"],
  security: CLINICAL_ROLES,
}

export const canOpen = (page, role) => PAGE_ROLES[page]?.includes(role) ?? false

// Which note types a role may write and sign. Mirrors canWriteType in
// firestore.rules. The admin (Dr. Antonious) also writes dietitian notes.
const NOTE_WRITERS = {
  consultation: PRESCRIBERS,
  progress: PRESCRIBERS,
  exercise: PRESCRIBERS,
  dietitian: ["dietitian", "admin"],
}

export const canWriteNote = (type, role) => NOTE_WRITERS[type]?.includes(role) ?? false
export const canAdmit = (role) => PRESCRIBERS.includes(role)
// The default portal-invite wording. Mirrors settings/portalInvite (isStaff) in firestore.rules.
export const canEditInviteTemplate = (role) => STAFF_ROLES.includes(role)
// Who takes a portal update out of the patient's view: its author, or
// co-admin and up, and only once. Mirrors isRemoval in firestore.rules.
export const canRemoveUpdate = (update, actor) =>
  !update.removed && (update.author?.uid === actor.uid || STAFF_ROLES.includes(actor.role))

// A dietitian adds addenda only to dietitian notes, so they can't add text
// to a medical record. Everyone else clinical: any signed note.
export const canAmend = (noteType, role) => isClinicalRole(role) && (role !== "dietitian" || noteType === "dietitian")

// Who sees an appointment's move and cancel history (Louie, 2026-10-02).
// Mirrors the changes read rule (isStaff) in firestore.rules.
export const canSeeAppointmentHistory = (role) => STAFF_ROLES.includes(role)

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

// How a staff member is shown in lists (the calendar's "With" and staff
// filter): their name, or with none set, the part of their email before @.
export function staffDisplayName(member) {
  const raw = member?.name?.trim() || member?.email || ""
  return raw.includes("@") ? raw.split("@")[0] : raw
}
