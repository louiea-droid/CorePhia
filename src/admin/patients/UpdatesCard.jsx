import { useCallback, useEffect, useState } from "react"
import { canRemoveUpdate, ROLE_LABELS } from "../staff/roles"
import ConfirmDialog from "../ui/ConfirmDialog"
import { NOTE_TYPE_LABELS, formatDay, formatStamp } from "./noteUi"
import { loadUpdates, removeUpdate } from "./updateStore"

const SHOWN = 5
const EMAIL_WORDS = { sent: "Email sent", failed: "Email not sent", none: "Not emailed" }

// The chart's "Updates" card: what the patient sees in their portal, newest
// first. Posting is the chart's job (it also opens the dialog after a
// signing); this card lists, reloads on `version`, and removes.
export default function UpdatesCard({ chartId, notes, actor, canPost, version, emailFailed, onPost }) {
  const [updates, setUpdates] = useState(null)
  const [failed, setFailed] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [removeError, setRemoveError] = useState(null)

  const reload = useCallback(() => {
    loadUpdates(chartId).then(
      (next) => {
        setUpdates(next)
        setFailed(false)
      },
      (cause) => {
        console.error("Could not load updates:", cause.code ?? cause.message)
        setFailed(true)
      },
    )
  }, [chartId])

  useEffect(reload, [reload, version])

  const confirmRemove = async () => {
    setBusy(true)
    try {
      await removeUpdate(chartId, removing.id, actor)
      setRemoveError(null)
      reload()
    } catch {
      setRemoveError("Couldn't remove the update. Try again.")
    }
    setBusy(false)
    setRemoving(null)
  }

  const sourceNote = (id) => notes?.find((note) => note.id === id)
  const shown = showAll ? updates : updates?.slice(0, SHOWN)

  return (
    <section className="rounded-2xl border border-ink-950/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-950">Updates</h2>
        {canPost && (
          <button
            type="button"
            onClick={onPost}
            className="cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-paper-50 transition-colors duration-200 hover:bg-brand-dark"
          >
            Post an update
          </button>
        )}
      </div>

      {emailFailed && (
        <p role="status" className="mt-3 text-sm text-brand-dark">
          Update posted, but the email didn't send.
        </p>
      )}
      {removeError && (
        <p role="alert" className="mt-3 text-sm text-brand-dark">
          {removeError}
        </p>
      )}

      <div className="mt-3 text-sm">
        {failed ? (
          <p className="text-brand-dark">Couldn't load the updates.</p>
        ) : !updates ? (
          <p className="text-ink-950/50">Loading…</p>
        ) : updates.length === 0 ? (
          <p className="text-ink-950/55">No updates yet. Updates you post here show in the patient's portal.</p>
        ) : (
          <ol className="divide-y divide-ink-950/10">
            {shown.map((update) => {
              const note = update.fromNoteId && sourceNote(update.fromNoteId)
              return (
                <li key={update.id} className={`py-3 first:pt-0 last:pb-0 ${update.removed ? "opacity-55" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-xs text-ink-950/55">
                      {formatStamp(update.createdAt)} · {update.author?.name} ({ROLE_LABELS[update.author?.role] ?? update.author?.role})
                    </p>
                    {canRemoveUpdate(update, actor) && (
                      <button
                        type="button"
                        onClick={() => setRemoving(update)}
                        className="cursor-pointer text-xs font-semibold text-ink-950/60 transition-colors duration-200 hover:text-brand-dark"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-line wrap-break-word text-ink-950">{update.body}</p>
                  <p className="mt-1 text-xs text-ink-950/50">
                    {[
                      update.removed
                        ? `Removed by ${update.removed.by?.name} on ${formatDay(update.removed.at)}`
                        : EMAIL_WORDS[update.email] ?? EMAIL_WORDS.none,
                      note && `Shared from the ${formatDay(note.visitDate)} ${NOTE_TYPE_LABELS[note.type]?.toLowerCase() ?? "note"}`,
                    ]
                      .filter(Boolean)
                      .join(". ")}
                  </p>
                </li>
              )
            })}
          </ol>
        )}
        {updates?.length > SHOWN && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-3 cursor-pointer text-xs font-semibold text-accent-text hover:underline"
          >
            Show all ({updates.length})
          </button>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this update?"
        description="The patient won't see it any more. It stays on the chart as removed."
        confirmLabel={busy ? "Removing…" : "Remove"}
        confirmDisabled={busy}
        onConfirm={confirmRemove}
        onCancel={() => !busy && setRemoving(null)}
      />
    </section>
  )
}
