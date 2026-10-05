// Portal invites: the pure parts, shared by the admin's chart box and the
// patient's /portal/setup page. No Firebase here, so `npm run check` can run
// it in plain node (inviteMath.check.js).

// How long an invite link works after it's sent. firestore.rules checks the
// same 7 days when a patient links their login.
export const INVITE_DAYS = 7
const DAY = 86400000

// The default invite, used until co-admin or up saves their own wording.
export const DEFAULT_INVITE = {
  subject: "Set up your CorePhia patient portal",
  message: [
    "Hi {firstName},",
    "",
    "Your CorePhia patient portal is ready. Use the button below to choose a password and sign in. This is where you'll find updates from your care team.",
    "",
    "Questions? Call us at {phone} or email info@corephia.com.",
  ].join("\n"),
}

// Firestore Timestamp, Date, ISO string or nothing.
export function asDate(value) {
  if (!value) return null
  if (typeof value.toDate === "function") return value.toDate()
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function inviteExpiresAt(invite) {
  const sentAt = asDate(invite?.sentAt)
  return sentAt ? new Date(sentAt.getTime() + INVITE_DAYS * DAY) : null
}

export function isInviteUsable(invite, now = new Date()) {
  const expiresAt = inviteExpiresAt(invite)
  return invite?.status === "sent" && Boolean(expiresAt) && now < expiresAt
}

// What the chart's portal box says. invites: newest first. linked: a
// patientAccounts doc points at this chart, which wins over any invite.
export function inviteStatus(invites, linked, now = new Date()) {
  const invite = invites[0] ?? null
  if (linked) return { kind: "active", invite }
  if (!invite) return { kind: "none", invite }
  if (invite.status === "ready") return { kind: "sending", invite }
  if (invite.status === "failed") return { kind: "failed", invite }
  return { kind: isInviteUsable(invite, now) ? "sent" : "expired", invite }
}

export function fillTemplate(text, { firstName, phone }) {
  return text.replaceAll("{firstName}", firstName || "there").replaceAll("{phone}", phone ?? "")
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// The reverse, for "Save as the default template": the patient's name and the
// phone go back to placeholders. Whole words only, so a name like "Al" leaves
// "Also" alone. Empty values are skipped.
export function toTemplate(text, { firstName, phone }) {
  let out = text
  if (phone) out = out.replaceAll(phone, "{phone}")
  if (firstName) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(firstName)}(?![\\p{L}\\p{N}])`, "gu"), "{firstName}")
  return out
}

// The message as safe HTML for the EmailJS template's {{{message_html}}}:
// staff text is escaped first, so it can never inject markup, then line
// breaks become <br>.
export function escapeMessage(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replace(/\r?\n/g, "<br>")
}

// 128 random bits as hex: the invite's id and the secret in its link.
export function newInviteId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
