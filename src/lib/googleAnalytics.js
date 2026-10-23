import { useEffect } from "react"
import { CONSENT_CHANGE, readConsent } from "./analyticsConsent.js"

// Google Analytics 4, on the public marketing pages only, and only after the
// visitor presses Accept on the privacy banner. Google won't sign a HIPAA
// agreement for Analytics, so it must never run where health information is
// entered or shown: the intake, the patient portal, the admin. HHS has warned
// that tracking on those pages can be a HIPAA violation.
const GA_ID = "G-180FKQGVY5"
const DISABLE_FLAG = `ga-disable-${GA_ID}`

// An allowlist, not a blocklist: a new route stays untracked until added here.
const PUBLIC_PAGE =
  /^\/(about|contact|faq|membership|privacy|terms|privacy-practices|success-stories|(programs|guides)\/[a-z0-9-]+)?\/?$/

export const isTrackablePage = (path) => PUBLIC_PAGE.test(path)

let loaded = false

// Google's "page changes based on browser history events" setting reacts the
// moment the address changes, before React's effect below runs. If it were on,
// a click on Get started would record /intake. So the off switch is set for
// the destination first, whatever the console says (2026-10-21 audit). Back
// and Forward change the address before any listener, so the popstate one
// (added before Google's script loads, so it runs first) sets it from there.
// Declining later must keep it off on public pages too, hence `accepted`.
export function guardHistory(win, accepted = () => readConsent() === "accepted") {
  if (win.history.corephiaGuarded) return
  win.history.corephiaGuarded = true
  const setFlag = (path) => {
    win[DISABLE_FLAG] = !accepted() || !isTrackablePage(path)
  }
  for (const method of ["pushState", "replaceState"]) {
    const original = win.history[method]
    win.history[method] = function (state, title, url) {
      if (url != null) setFlag(new URL(url, win.location.href).pathname)
      return original.call(this, state, title, url)
    }
  }
  win.addEventListener("popstate", () => setFlag(win.location.pathname))
}

function load() {
  if (loaded) return
  loaded = true
  guardHistory(window)
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag("js", new Date())
  window.gtag("config", GA_ID, {
    send_page_view: false, // sent below on every route change, the app being a single page
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })
  const script = document.createElement("script")
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)
}

// Declining after accepting: stop sending and remove Google's cookies.
function forget() {
  window[DISABLE_FLAG] = true
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim()
    if (name === "_ga" || name.startsWith("_ga_")) {
      for (const domain of ["", `; domain=${location.hostname}`, `; domain=.${location.hostname.replace(/^www\./, "")}`]) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain}`
      }
    }
  }
}

function sync(path) {
  const consented = readConsent() === "accepted"
  if (!consented) {
    if (loaded) forget()
    return
  }
  // The flag stops every Google Analytics hit, including Google's automatic
  // ones, while the visitor is on a page that isn't public.
  window[DISABLE_FLAG] = !isTrackablePage(path)
  if (window[DISABLE_FLAG]) return
  load()
  window.gtag("event", "page_view", {
    page_location: `${location.origin}${path}`, // no query string or hash
    page_title: document.title,
  })
}

/** Called once from App, above its admin/intake branches, so every route change passes through. */
export function useGoogleAnalytics(pathname) {
  useEffect(() => {
    // Production only: local and preview builds never send to the live property.
    if (!import.meta.env.PROD) return
    // After the page's <title> has updated.
    const timer = setTimeout(() => sync(pathname), 0)
    const onConsent = () => sync(window.location.pathname)
    window.addEventListener(CONSENT_CHANGE, onConsent)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(CONSENT_CHANGE, onConsent)
    }
  }, [pathname])
}
