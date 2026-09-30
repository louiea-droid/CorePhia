// The visitor's answer to the privacy banner (CookieBanner.jsx). Stored in
// their own browser only. Nothing is counted until they press Accept, and a
// missing or unreadable answer counts as "not yet asked".
const CONSENT_KEY = "corephia:analytics-consent"
export const CONSENT_CHANGE = "corephia:consent-change"
export const OPEN_PRIVACY_CHOICES = "corephia:open-privacy-choices"

/** "accepted" | "declined" | null (not answered, or storage unavailable). */
export function readConsent() {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === "accepted" || value === "declined" ? value : null
  } catch {
    return null
  }
}

export function writeConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // Storage blocked: the choice holds for this page view only.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE, { detail: value }))
}

/** Reopens the banner, from the footer's "Privacy choices" link. */
export function openPrivacyChoices() {
  window.dispatchEvent(new Event(OPEN_PRIVACY_CHOICES))
}
