import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { CloseIcon } from "./icons"
import { getAdminPortalRoot } from "./portalRoot"

// A small admin dialog: scrim, title, close button, Escape to close (unless a
// popup inside already handled it), and focus on the close button to start.
export default function Modal({ title, onClose, children, footer, busy = false }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented && !busy) onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [busy, onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto [scrollbar-gutter:stable_both-edges]" role="presentation">
      <div aria-hidden="true" onClick={() => !busy && onClose()} className="fixed inset-0 bg-scrim/50" />
      <div className="relative flex min-h-full items-end justify-center sm:items-center sm:p-4">
        <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-t-3xl bg-paper-50 shadow-2xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-4 border-b border-ink-950/10 px-5 py-4 sm:px-6">
            <p className="font-serif text-xl text-ink-950">{title}</p>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="cursor-pointer rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
          <div className="space-y-4 px-5 py-5 sm:px-6">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink-950/10 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    getAdminPortalRoot(),
  )
}
