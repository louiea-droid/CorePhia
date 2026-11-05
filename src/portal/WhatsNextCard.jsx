import { Loading, Skeleton } from "./Skeleton"

// The pill above the heading: what kind of reminder this is.
const PILLS = {
  pastDue: "Payment",
  visitToday: "Today: your visit",
  newReply: "New message",
  nextVisit: "Next: your visit",
  newUpdate: "New update",
  weighIn: "Weigh-in",
  ending: "Membership",
  firstVisit: "Next: your first visit",
  nextVisitUnbooked: "Next: your visit",
}

// A second line under the heading, where it helps.
const SUBS = {
  visitToday: "Need to change the time? Send us a message.",
  nextVisit: "Need to change the time? Send us a message.",
  firstVisit: "Questions in the meantime? Send us a message.",
  nextVisitUnbooked: "Questions in the meantime? Send us a message.",
}

const ACTION_LABELS = {
  billing: "Manage billing",
  messages: "Open messages",
  "message-us": "Message us",
  updates: "Read the update",
  "log-weight": "Log your weight",
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"

// The Overview's top card: the one most useful reminder, up to two smaller
// ones, and (as children) the progress stats with the weight wave along the
// bottom edge. reminders is whatsNext()'s { main, more }, or null while the
// data it needs is loading. The card has no bottom padding: the children
// bring their own.
export default function WhatsNextCard({ reminders, onAction, children }) {
  const main = reminders?.main
  return (
    <section
      aria-labelledby="whats-next-heading"
      className="overflow-hidden rounded-3xl border border-ink-950/10 bg-linear-to-b from-white to-[#f2f6fd]"
    >
      <div className="px-6 pt-6 sm:px-8 sm:pt-7">
        {!main ? (
          <Loading label="Loading what's next…" className="">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="mt-4 h-7 w-full max-w-md" />
            <Skeleton className="mt-2 h-7 w-2/3 max-w-xs" />
          </Loading>
        ) : (
          <>
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:justify-between sm:gap-8">
              <div className="min-w-0">
                <p
                  className={`inline-flex items-center gap-[7px] rounded-full px-[11px] py-[5px] text-[12.5px] font-semibold ${
                    main.kind === "pastDue" ? "bg-amber-100 text-amber-900" : "bg-[#e7f3ee] text-[#1f6b4f]"
                  }`}
                >
                  <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
                  {PILLS[main.kind]}
                </p>
                <h2 id="whats-next-heading" className="mt-3 max-w-[30ch] font-serif text-[22px] leading-tight text-balance wrap-break-word text-ink-950 sm:text-[26px]">
                  {main.title}
                </h2>
                {SUBS[main.kind] && <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-ink-950/75">{SUBS[main.kind]}</p>}
              </div>
              <button
                type="button"
                onClick={() => onAction(main.action)}
                className={`min-h-11 shrink-0 cursor-pointer rounded-full border border-ink-950/15 bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-200 hover:bg-paper-100 ${focusRing}`}
              >
                {ACTION_LABELS[main.action]}
              </button>
            </div>

            {reminders.more.length > 0 && (
              <ul aria-label="Also coming up" className="mt-5 space-y-2 border-t border-ink-950/10 pt-4 text-sm">
                {reminders.more.map((reminder) => (
                  <li key={reminder.kind} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="min-w-0 text-ink-950/80">{reminder.title}</span>
                    <button
                      type="button"
                      onClick={() => onAction(reminder.action)}
                      className={`cursor-pointer rounded font-semibold text-accent-dark underline-offset-2 transition-colors duration-200 hover:text-ink-950 hover:underline ${focusRing}`}
                    >
                      {ACTION_LABELS[reminder.action]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {children}
    </section>
  )
}
