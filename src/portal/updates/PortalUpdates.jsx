import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ClipboardCheckIcon } from "../../components/icons"
import { patientRoleLabel } from "../../lib/messageMath"
import { getMyUpdates } from "../lib/patientAuth"

const asDate = (value) => (typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null)
const dayOf = (value) => asDate(value)?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? ""
const yearOf = (value) => asDate(value)?.getFullYear() ?? ""

// The portal's Updates: what the care team posted, newest first, as a dated
// timeline. Plain text only; React escapes it, so staff text never renders
// as HTML.
// `latestOnly` (the Overview): the newest update and a link to the rest.
export default function PortalUpdates({ intakeId, latestOnly = false }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null) // { attempt, updates } | { attempt, failed }

  useEffect(() => {
    let live = true
    getMyUpdates(intakeId).then(
      (updates) => live && setResult({ attempt, updates }),
      (cause) => {
        console.error("Could not load updates:", cause.code ?? cause.message)
        if (live) setResult({ attempt, failed: true })
      },
    )
    return () => {
      live = false
    }
  }, [intakeId, attempt])

  const current = result?.attempt === attempt ? result : null

  return (
    <section id="updates" aria-labelledby="updates-heading" className="scroll-mt-24 rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="updates-heading" className="font-serif text-2xl text-ink-950">
          Updates
        </h2>
        {latestOnly && (
          <Link
            to="/account/updates"
            className="rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-200 hover:bg-paper-100"
          >
            All updates
          </Link>
        )}
      </div>

      {!current ? (
        <p className="mt-6 text-sm text-ink-950/60">Loading your updates…</p>
      ) : current.failed ? (
        <div className="mt-6">
          <p className="text-ink-950/75">We couldn't load your updates.</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-4 cursor-pointer rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
          >
            Try again
          </button>
        </div>
      ) : current.updates.length === 0 ? (
        <div className="mt-6 flex items-start gap-4 rounded-2xl bg-paper-100 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-50 text-accent-dark">
            <ClipboardCheckIcon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium text-ink-950">No updates yet</p>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-950/70">
              Updates from your care team will show up here. When your provider or dietitian posts one, we'll usually
              send you an email too.
            </p>
          </div>
        </div>
      ) : (
        <ol className="mt-6">
          {(latestOnly ? current.updates.slice(0, 1) : current.updates).map((update, index, shown) => (
            <li key={update.id} className="grid grid-cols-[4.25rem_1fr] gap-x-4 sm:grid-cols-[5rem_1fr]">
              <div className="pt-0.5 text-right">
                <p className="text-sm font-semibold text-ink-950">{dayOf(update.createdAt)}</p>
                <p className="text-xs text-ink-950/50">{yearOf(update.createdAt)}</p>
              </div>
              <div className={`relative border-l border-ink-950/15 pl-5 ${index === shown.length - 1 ? "pb-0" : "pb-8"}`}>
                <span aria-hidden="true" className="absolute top-1.5 -left-[5px] size-[9px] rounded-full bg-accent-dark" />
                <p className="text-sm text-ink-950/60">
                  From {update.author?.name} ({patientRoleLabel(update.author?.role)})
                </p>
                <p className="mt-1.5 max-w-prose whitespace-pre-line wrap-break-word leading-relaxed text-ink-950">{update.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
