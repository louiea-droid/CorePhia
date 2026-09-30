import { createPortal } from "react-dom"
import { signOutAdmin } from "./firebase"
import { getAdminPortalRoot } from "./portalRoot"

export default function IdleWarningModal({ secondsLeft }) {
  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div aria-hidden="true" className="absolute inset-0 bg-scrim/50" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-warning-title"
          className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        >
          <p id="idle-warning-title" className="font-serif text-xl text-ink-950">
            Still there?
          </p>
          <p className="mt-2 text-sm text-ink-950/60">
            You'll be signed out in {secondsLeft}s for inactivity.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={signOutAdmin}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5"
            >
              Sign out now
            </button>
            {/* No onClick: this button's own click bubbles to the document
                listener useIdleTimeout installs, which resets the idle
                deadline the same as any other activity would. */}
            <button
              type="button"
              className="rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-ink-900"
            >
              Stay signed in
            </button>
          </div>
        </div>
      </div>
    </div>,
    getAdminPortalRoot(),
  )
}
