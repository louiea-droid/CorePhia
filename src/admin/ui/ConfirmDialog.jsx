import { useRef } from "react"
import { createPortal } from "react-dom"
import { getAdminPortalRoot } from "./portalRoot"
import { useDialog } from "./useDialog"

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}) {
  const cancelButtonRef = useRef(null)

  // Focus starts on Cancel, so a stray Enter backs out instead of deleting or
  // signing. While the confirm action is running (confirmDisabled), Escape waits.
  useDialog({ open, onClose: onCancel, focusRef: cancelButtonRef, closable: !confirmDisabled })

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        aria-hidden="true"
        onClick={onCancel}
        className="absolute inset-0 bg-scrim/50 transition-opacity duration-200"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        >
          <p className="font-serif text-xl text-ink-950">{title}</p>
          {description && <p className="mt-2 text-sm text-ink-950/60">{description}</p>}
          {children}

          <div className="mt-6 flex justify-end gap-2">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onCancel}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    getAdminPortalRoot(),
  )
}
