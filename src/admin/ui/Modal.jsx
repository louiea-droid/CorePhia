import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import ConfirmDialog from "./ConfirmDialog"
import { CloseIcon } from "./icons"
import { getAdminPortalRoot } from "./portalRoot"
import { useDialog } from "./useDialog"

// A small admin dialog: scrim, title, close button, Escape to close (see
// useDialog), and focus on the close button to start. With `dirty` (typed
// text that isn't sent yet), Escape, the scrim and the X ask before discarding.
export default function Modal({ title, onClose, children, footer, busy = false, dirty = false }) {
  const closeRef = useRef(null)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const requestClose = () => (dirty ? setConfirmingClose(true) : onClose())
  useDialog({ onClose: requestClose, focusRef: closeRef, closable: !busy })

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto [scrollbar-gutter:stable_both-edges]" role="presentation">
      <div aria-hidden="true" onClick={() => !busy && requestClose()} className="fixed inset-0 bg-scrim/50" />
      <div className="relative flex min-h-full items-end justify-center sm:items-center sm:p-4">
        <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-t-3xl bg-paper-50 shadow-2xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-4 border-b border-ink-950/10 px-5 py-4 sm:px-6">
            <p className="font-serif text-xl text-ink-950">{title}</p>
            <button
              ref={closeRef}
              type="button"
              onClick={requestClose}
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
      <ConfirmDialog
        open={confirmingClose}
        title="Discard what you wrote?"
        description="It hasn't been sent, and closing throws it away."
        confirmLabel="Discard"
        cancelLabel="Keep writing"
        onConfirm={onClose}
        onCancel={() => setConfirmingClose(false)}
      />
    </div>,
    getAdminPortalRoot(),
  )
}
