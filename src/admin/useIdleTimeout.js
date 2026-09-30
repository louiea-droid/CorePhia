import { useEffect, useRef, useState } from "react"

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"]
// Resetting the idle deadline on every fired mousemove/scroll event is
// wasteful; one timestamp write per second is plenty to tell "active" from
// "idle" apart.
const ACTIVITY_THROTTLE_MS = 1000
const TICK_MS = 1000

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
    lastActivityRef.current = Date.now()

    const markActive = () => {
      const now = Date.now()
      if (now - lastActivityWriteRef.current < ACTIVITY_THROTTLE_MS) return
      lastActivityWriteRef.current = now
      lastActivityRef.current = now
    }
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, markActive, { passive: true }))

    const interval = setInterval(() => {
      if (firedRef.current) return
      const remaining = timeoutMs - (Date.now() - lastActivityRef.current)
      if (remaining <= 0) {
        firedRef.current = true
        setWarningSecondsLeft(null)
        onIdle()
      } else {
        setWarningSecondsLeft(remaining <= warningMs ? Math.ceil(remaining / 1000) : null)
      }
    }, TICK_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, markActive))
      clearInterval(interval)
    }
  }, [enabled, timeoutMs, warningMs, onIdle])

  return enabled ? warningSecondsLeft : null
}
