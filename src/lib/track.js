import { readConsent } from "./analyticsConsent"

// Where counting never happens. The account and admin are never counted at
// all. The intake counts only that it was opened (one page view), never a
// click inside it: on a health site, what someone taps in the intake can
// reveal health information. firestore.rules enforces the same lines.
const isBlocked = (type, path) =>
  /^\/(account|admin)(\/|$)/.test(path) || (type !== "pageview" && /^\/intake(\/|$)/.test(path))

// Paths that only redirect elsewhere: the page they land on is counted
// instead, so counting these as well would double the visit.
const REDIRECT_ONLY = new Set(["/pricing"])

/** Counts one anonymous event, only if the visitor accepted the banner. */
export function trackEvent(type, path, label = "") {
  if (readConsent() !== "accepted" || isBlocked(type, path)) return
  if (type === "pageview" && REDIRECT_ONLY.has(path)) return
  import("./siteEvents")
    .then(({ sendSiteEvent }) => sendSiteEvent({ type, path, label }))
    // Analytics must never break the page. A failed count is just not counted.
    .catch(() => {})
}
