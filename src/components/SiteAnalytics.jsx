import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { CONSENT_CHANGE } from "../lib/analyticsConsent"
import { trackEvent } from "../lib/track"

// Collapses a clicked element to a short, human label: an explicit
// data-track wins, then aria-label, then the visible text.
function labelOf(element) {
  const raw = element.dataset.track || element.getAttribute("aria-label") || element.textContent || ""
  return raw.replace(/\s+/g, " ").trim()
}

/** Page views and link/button clicks on the public site (not the intake). */
export default function SiteAnalytics() {
  const { pathname } = useLocation()

  useEffect(() => {
    trackEvent("pageview", pathname)
  }, [pathname])

  useEffect(() => {
    // Accepting on a page counts that page, so the first view isn't lost.
    const onConsent = (event) => {
      if (event.detail === "accepted") trackEvent("pageview", window.location.pathname)
    }
    // Capture phase, so a link that navigates away is still counted first.
    const onClick = (event) => {
      const element = event.target.closest?.("a, button, [data-track]")
      if (!element || element.closest("[data-no-track]")) return
      const label = labelOf(element)
      if (label) trackEvent("click", window.location.pathname, label)
    }
    window.addEventListener(CONSENT_CHANGE, onConsent)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener(CONSENT_CHANGE, onConsent)
      document.removeEventListener("click", onClick, true)
    }
  }, [])

  return null
}
