import { useEffect, useRef, useState } from "react"

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"]
// Resetting the idle deadline on every fired mousemove/scroll event is
// wasteful; one timestamp write per second is plenty to tell "active" from
// "idle" apart.
const ACTIVITY_THROTTLE_MS = 1000
const TICK_MS = 1000

// The last activity time is shared through localStorage, not just held in
// memory, for two reasons. The Firebase session itself is kept in the browser,
// so closing the tab without signing out used to reset the idle clock: on a
// shared clinic computer, the next person to open /admin hours later was still
// signed in. And each tab kept its own clock, so an idle background tab signed
// you out of the one you were working in. Now every tab reads the same time,
// and a session reopened after more than the timeout is signed out at once.
const STORAGE_KEY = "corephia-admin-last-activity"

function readStoredActivity() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0
  } catch {
    return 0
  }
}

function writeStoredActivity(time) {
  try {
    localStorage.setItem(STORAGE_KEY, String(time))
  } catch {
    // Private mode or blocked storage: the in-memory clock still works for this tab.
  }
}

// Called just before a real sign-in (lib/firebase.js), so a fresh sign-in
// isn't mistaken for a session left open since the last visit.
export const markAdminActivity = () => writeStoredActivity(Date.now())

// Returns the number of whole seconds left before onIdle fires, once that's
// within warningMs, or null the rest of the time. Any tracked activity —
// including a click inside the warning modal itself, since the listener is
// on `document` and clicks bubble — pushes the deadline back out and clears
// the countdown, so the modal's "stay signed in" affordance needs no
// separate handler.
export function useIdleTimeout({ enabled, timeoutMs, warningMs, onIdle }) {
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(null)
  const lastActivityRef = useRef(0)
  const lastActivityWriteRef = useRef(0)
  const firedRef = useRef(false)

  useEffect(() => {
    // enabled=false is reported as null below rather than reset here, so
    // this effect never needs to setState just to turn the countdown off.
    if (!enabled) return

    firedRef.current = false
    // A stored time (from this tab before a reload, another tab, or the last
    // visit) wins; with none at all, the session starts its clock now.
    const stored = readStoredActivity()
    lastActivityRef.current = stored || Date.now()
    if (!stored) writeStoredActivity(lastActivityRef.current)

    const markActive = () => {
      const now = Date.now()
      if (now - lastActivityWriteRef.current < ACTIVITY_THROTTLE_MS) return
      lastActivityWriteRef.current = now
      lastActivityRef.current = now
      writeStoredActivity(now)
    }
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, markActive, { passive: true }))

    const check = () => {
      if (firedRef.current) return
      // Activity in any other tab counts as activity here.
      const last = Math.max(lastActivityRef.current, readStoredActivity())
      const remaining = timeoutMs - (Date.now() - last)
      if (remaining <= 0) {
        firedRef.current = true
        setWarningSecondsLeft(null)
        onIdle()
      } else {
        setWarningSecondsLeft(remaining <= warningMs ? Math.ceil(remaining / 1000) : null)
      }
    }
    // Check straight away, so a session reopened after the timeout signs out
    // without first showing the admin for a second.
    check()
    const interval = setInterval(check, TICK_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, markActive))
      clearInterval(interval)
    }
  }, [enabled, timeoutMs, warningMs, onIdle])

  return enabled ? warningSecondsLeft : null
}
