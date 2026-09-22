import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { CloseIcon } from "./icons"
import { getAdminPortalRoot } from "./portalRoot"

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// A lightweight list — name + submitted date, click through to PatientModal
// for the full record — rather than reusing PatientsTable here. The table's
// four fixed columns (plan, reason, submitted) are about triage across all
// patients; this is a narrow "who matched" result for one condition, where
// only the name and a way to open the full chart matter.
export default function PatientListModal({ title, subtitle, records, onSelectPatient, onClose }) {
  const closeButtonRef = useRef(null)
  const open = Boolean(title)

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

  if (!open) return null

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
          aria-label={title}
          className="relative flex max-h-[80vh] w-full max-w-sm flex-col rounded-3xl bg-white shadow-2xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-950/10 px-6 py-5">
            <div>
              <p className="font-serif text-xl text-ink-950">{title}</p>
              {subtitle && <p className="mt-1 text-sm text-ink-950/50">{subtitle}</p>}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>

          {records.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-ink-950/45">No matching patients.</p>
          ) : (
            <ul className="divide-y divide-ink-950/5 overflow-y-auto px-2 py-2">
              {records.map((record) => {
                const name =
                  `${record.demographics?.firstName ?? ""} ${record.demographics?.lastName ?? ""}`.trim() || "—"
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPatient(record)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors duration-150 hover:bg-paper-100"
                    >
                      <span className="truncate text-sm font-medium text-ink-950">{name}</span>
                      <span className="shrink-0 text-xs text-ink-950/45">{formatDate(record.submittedAt)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    getAdminPortalRoot(),
  )
}
