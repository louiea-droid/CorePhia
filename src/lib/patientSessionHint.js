const KEY = "corephia-patient-session"
const EVENT = "corephia-patient-session-change"

// A cheap, synchronous, per-browser hint of whether a patient is signed in —
// used only to decide what the header shows (sign-in panel vs. straight to the portal).
// Deliberately has no Firebase import, so components that only need the
// label (Header) never trigger the Firebase Auth SDK download that
// components needing the real session (LoginPanel, Account) already pull in.
// It grants no access on its own: Account always re-verifies the actual
// session via watchPatientUser, so a stale hint just shows the wrong label
// for one click, never real account data.
export function hasPatientSessionHint() {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function setPatientSessionHint(signedIn) {
  try {
    if (signedIn) localStorage.setItem(KEY, "1")
    else localStorage.removeItem(KEY)
  } catch {
    /* private browsing / storage disabled */
  }
  // Same tab doesn't get a native `storage` event, so a custom one keeps an
  // already-mounted Header in sync right after sign-in/out without a reload.
  window.dispatchEvent(new Event(EVENT))
}

export function onPatientSessionHintChange(callback) {
  const handler = () => callback(hasPatientSessionHint())
  window.addEventListener(EVENT, handler)
  window.addEventListener("storage", handler)
  return () => {
    window.removeEventListener(EVENT, handler)
    window.removeEventListener("storage", handler)
  }
}
