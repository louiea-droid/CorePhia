import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { AUDIT_ACTIONS, MESSAGES_COLLECTION, recordAuditEvent } from "./firebase"
import { CloseIcon, TrashIcon } from "./icons"
import { getAdminPortalRoot } from "./portalRoot"

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-ink-950/45 uppercase">{label}</p>
      <p className="mt-0.5 text-sm wrap-break-word text-ink-950">{value || "—"}</p>
    </div>
  )
}

export default function MessageModal({ message, onClose, canDelete, onRequestDelete }) {
  const closeButtonRef = useRef(null)
  const open = Boolean(message)

  // Same reasoning as ApplicantModal: the open is the access event, logged once
  // per open regardless of how many times React re-runs the effect.
  const loggedMessageIdRef = useRef(null)
  useEffect(() => {
    if (!message?.id) {
      loggedMessageIdRef.current = null
      return
    }
    if (loggedMessageIdRef.current === message.id) return
    loggedMessageIdRef.current = message.id
    recordAuditEvent({
      action: AUDIT_ACTIONS.viewMessage,
      targetCollection: MESSAGES_COLLECTION,
      targetId: message.id,
      targetLabel: message.name ?? "",
    })
  }, [message])

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    document.body.style.overflow = "hidden"

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  if (!message) return null

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-scrim/50 transition-opacity duration-200"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Message from ${message.name || "this visitor"}`}
          className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-ink-950/10 px-6 py-5 sm:px-8">
            <div>
              <p className="font-serif text-2xl text-ink-950">{message.name || "Visitor"}</p>
              <p className="mt-1 text-sm text-ink-950/50">Sent {formatDate(message.submittedAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(message)}
                  aria-label="Delete this message"
                  className="rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-brand-dark/10 hover:text-brand-dark"
                >
                  <TrashIcon className="size-5" />
                </button>
              )}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-5 sm:px-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Email" value={message.email} />
              <Field label="Phone" value={message.phone} />
              <Field label="Topic" value={message.interest} />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-950/45 uppercase">Message</p>
              <p className="mt-1 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap text-ink-950">
                {message.message || "No additional message."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    getAdminPortalRoot(),
  )
}
