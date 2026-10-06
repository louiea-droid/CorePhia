// Messages arithmetic shared by the admin inbox and the patient portal. No
// React or Firebase, so messageMath.check.js runs under plain node.

const ms = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value ? new Date(value).getTime() : 0)

export const needsReply = (topic) => topic.status === "open" && topic.lastFrom === "patient"

// The other side wrote after this side last opened it.
export const unreadFor = (topic, side) =>
  topic.lastFrom !== side && ms(side === "staff" ? topic.staffReadAt : topic.patientReadAt) < ms(topic.lastMessageAt)

// info@ is emailed only when a patient's message makes the topic newly need a
// reply: a new topic, after a staff message, or reopening a closed one. Five
// messages in a row mean one email.
export const notifiesStaff = (topicBefore) => !topicBefore || topicBefore.lastFrom === "staff" || topicBefore.status === "closed"

export function topicCounts(topics) {
  return {
    needsReply: topics.filter(needsReply).length,
    open: topics.filter((topic) => topic.status === "open").length,
    closed: topics.filter((topic) => topic.status === "closed").length,
  }
}

export const byLatest = (a, b) => ms(b.lastMessageAt) - ms(a.lastMessageAt)

// How staff roles read to a patient: the admin is Dr. Antonious, so
// "Provider"; co-admins and super admins aren't necessarily clinicians.
export const PATIENT_ROLE_LABELS = { provider: "Provider", dietitian: "Dietitian", admin: "Provider", coAdmin: "Care team", superAdmin: "Care team" }
export const patientRoleLabel = (role) => PATIENT_ROLE_LABELS[role] ?? "Care team"
