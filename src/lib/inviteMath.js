// Portal invites: the pure parts, shared by the admin's chart box and the
// patient's /portal/setup page. No Firebase here, so `npm run check` can run
// it in plain node (inviteMath.check.js).

// How long an invite link works after it's sent. firestore.rules checks the
// same 7 days when a patient links their login.
export const INVITE_DAYS = 7
const DAY = 86400000

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

// 128 random bits as hex: the invite's id and the secret in its link.
export function newInviteId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// Runs a write, and once more if it fails. false = both failed.
export async function retryOnce(write) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await write()
      return true
    } catch {
      /* try again, then give up */
    }
  }
  return false
}
