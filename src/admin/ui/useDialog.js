import { useEffect, useLayoutEffect, useRef } from "react"

// What every admin dialog needs when it's open, in one place so the fixes
// below apply to all of them:
//
// - Escape closes only the dialog on top. Each dialog listens on `document`,
//   and the one opened first is called first, so before this a single Escape
//   in a booking or delete confirmation also closed the record underneath.
//   The open dialogs are kept in a stack and only the top one answers.
//   A popup inside a dialog (Select, DatePicker, TimePicker) that already
//   handled Escape marks it defaultPrevented, and that is respected too.
// - Focus moves to `focusRef` once, when the dialog opens. Callers pass
//   onClose as a fresh arrow every render, and when it sat in the effect's
//   dependencies, every parent re-render (a live message arriving, say)
//   jumped focus back to the close button mid-sentence.
// - The page behind stops scrolling while any dialog is open, and the lock
//   is only lifted when the last one closes. A nested confirm closing used to
//   unlock the page while its parent dialog was still open.
const openDialogs = []
let scrollLocks = 0
let overflowBefore = ""

export function useDialog({ open = true, onClose, focusRef, closable = true }) {
  const latest = useRef({ onClose, closable })
  useLayoutEffect(() => {
    latest.current = { onClose, closable }
  })

  useEffect(() => {
    if (!open) return
    const token = {}
    openDialogs.push(token)
    if (scrollLocks++ === 0) {
      overflowBefore = document.body.style.overflow
      document.body.style.overflow = "hidden"
    }
    focusRef?.current?.focus()

    const onKeyDown = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || openDialogs.at(-1) !== token) return
      event.preventDefault()
      if (latest.current.closable) latest.current.onClose?.()
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      openDialogs.splice(openDialogs.indexOf(token), 1)
      if (--scrollLocks === 0) document.body.style.overflow = overflowBefore
    }
  }, [open, focusRef])
}
