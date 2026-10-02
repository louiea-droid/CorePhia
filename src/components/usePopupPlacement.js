import { useLayoutEffect, useState } from "react"

// Room the popup keeps from the edge of the screen.
const EDGE = 16

// Whether an open popup should open upwards: when it wouldn't fit below its
// trigger but there's more room above. Measured before paint, so the popup
// never shows in the wrong place first, and opening it never makes the page
// (or a dialog's overlay) grow and jump.
export function usePopupPlacement(open, anchorRef, popupRef) {
  const [up, setUp] = useState(false)
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !popupRef.current) return
    const anchor = anchorRef.current.getBoundingClientRect()
    const needed = popupRef.current.offsetHeight + EDGE
    const below = window.innerHeight - anchor.bottom
    const above = anchor.top
    // Synchronous on purpose: this is a measurement that has to land before
    // the first paint of the open popup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUp(below < needed && above > below)
  }, [open, anchorRef, popupRef])
  return up
}
