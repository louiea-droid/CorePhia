// A message counts as "new" for its first 24 hours, or until this admin has
// opened the Messages page since it arrived — whichever comes first. One
// definition, shared by the sidebar's Messages badge and the highlighted
// rows on the Messages page, so the number on the badge is always exactly
// the set of rows highlighted, and both clear together once viewed.
export const NEW_MESSAGE_WINDOW_MS = 24 * 60 * 60 * 1000

const LAST_VIEWED_KEY = "corephia-admin-messages-viewed-at"

export function readLastViewedMessagesAt() {
  try {
    const stored = Number(localStorage.getItem(LAST_VIEWED_KEY))
    return Number.isFinite(stored) ? stored : 0
  } catch {
    return 0
  }
}

export function writeLastViewedMessagesAt(timestamp) {
  try {
    localStorage.setItem(LAST_VIEWED_KEY, String(timestamp))
  } catch {
    /* private browsing / storage disabled */
  }
}

export function isNewMessage(message, now, viewedAt = 0) {
  const submittedAt = new Date(message.submittedAt).getTime()
  return now - submittedAt < NEW_MESSAGE_WINDOW_MS && submittedAt > viewedAt
}
