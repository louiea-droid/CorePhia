import Select from "../../components/Select"
import { useEffect, useMemo, useRef, useState } from "react"
import { BarList, Card, ColumnChart, StatTile } from "../ui/charts"
import { loadSiteEvents } from "../lib/firebase"
import { TIME_ZONE, addDays, todayInTampa } from "../calendar/calendarMath"
import PageHeader from "../layout/PageHeader"
import { BarListSkeleton, ColumnChartSkeleton, StatTileSkeleton } from "../ui/Skeleton"
import { useIntakeRecords } from "../applicants/useIntakeRecords"

const RANGES = [7, 30, 90]
const UNIT_DAYS = { days: 1, weeks: 7, months: 30 }
const MAX_DAYS = 365
const UNIT_OPTIONS = ["days", "weeks", "months"].map((value) => ({ value, label: value }))
const QUICK_PICKS = [
  [14, "days", "14 days"],
  [8, "weeks", "8 weeks"],
  [6, "months", "6 months"],
  [12, "months", "12 months"],
]

// Readable names for paths, so the table says "Membership" rather than "/membership".
const PAGE_NAMES = {
  "/": "Home",
  "/about": "About",
  "/contact": "Contact",
  "/faq": "FAQs",
  "/membership": "Membership",
  "/success-stories": "Success stories",
  "/intake": "Intake (opened)",
  "/programs/medical-care": "Medical care",
  "/programs/dietitian-services": "Dietitian services",
  "/programs/exercise-plan": "Comprehensive Exercise Plan",
  "/programs/follow-ups": "Follow-ups",
}

// Every button that opens the intake: "Get started", the pricing cards'
// "Choose {plan}" (off for now), and the menu's "Ready to lose weight? Start
// here" card.
const isStartClick = (label) => label === "Get started" || label.startsWith("Choose ") || label.includes("Start here")

// Views of /pricing recorded before the site stopped counting it (it only
// redirects to /membership, which was counted as well), so they're dropped
// rather than double-counted.
const REDIRECT_ONLY = new Set(["/pricing"])

// Menu and panel controls: real clicks, but they crowd the real links out of
// "Most clicked". Still stored, just not ranked.
const CHROME_LABELS = new Set(["Open menu", "Close menu", "Back to menu", "Close", "Show password", "Hide password"])

// Tampa calendar days, stepped as dates rather than 24-hour blocks, so the day
// after a clock change doesn't repeat one day and drop another.
const dayOf = (offset) => addDays(todayInTampa(), -offset)
const tampaDay = (value) => new Date(value).toLocaleDateString("en-CA", { timeZone: TIME_ZONE })
const shortDate = (day) => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })

function tally(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

// The same calendar-day window as the page views beside it.
function submittedSince(records, days) {
  const since = dayOf(days - 1)
  return records.filter((record) => record.submittedAt && tampaDay(record.submittedAt) >= since).length
}

// Daily columns for 7 and 30 days; weekly for 90, where 90 daily columns
// would be too thin to read or label.
function viewsOverTime(views, days) {
  const step = days > 30 ? 7 : 1
  const buckets = []
  for (let start = days - 1; start >= 0; start -= step) {
    const from = dayOf(start)
    const to = dayOf(Math.max(start - step + 1, 0))
    buckets.push({ from, to, label: shortDate(from), value: 0 })
  }
  for (const view of views) {
    const bucket = buckets.find((item) => view.day >= item.from && view.day <= item.to)
    if (bucket) bucket.value += 1
  }
  return { step, data: buckets }
}

function derive(allEvents, days) {
  const since = dayOf(days - 1)
  const events = allEvents.filter(
    (event) => event.day >= since && !(event.type === "pageview" && REDIRECT_ONLY.has(event.path)),
  )
  const views = events.filter((event) => event.type === "pageview")
  const clicks = events.filter((event) => event.type === "click")

  return {
    views: views.length,
    startClicks: clicks.filter((click) => isStartClick(click.label)).length,
    intakesOpened: views.filter((view) => view.path === "/intake").length,
    overTime: viewsOverTime(views, days),
    topPages: tally(views.map((view) => PAGE_NAMES[view.path] ?? view.path)).slice(0, 10),
    topClicks: tally(clicks.filter((click) => !CHROME_LABELS.has(click.label)).map((click) => click.label)).slice(0, 10),
  }
}

const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "—")

// Each step shows its count and what share of the step before it made it
// through, which is the number that says where visitors drop off.
function Funnel({ steps }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.label} className="rounded-xl bg-paper-100 p-4">
          <p className="text-sm text-ink-950/60">{step.label}</p>
          <p className="mt-1 text-2xl font-semibold text-ink-950 tabular-nums">{step.value}</p>
          <p className="mt-1 text-xs text-ink-950/50">
            {index === 0
              ? "Where the funnel starts"
              : step.value > steps[index - 1].value
                ? // Over 100% is real (people also reach the intake by reloading it
                  // or from a saved link) but reads as an error as a percentage.
                  `More than ${steps[index - 1].label.toLowerCase()}, includes direct visits`
                : `${percent(step.value, steps[index - 1].value)} of ${steps[index - 1].label.toLowerCase()}`}
          </p>
        </li>
      ))}
    </ol>
  )
}

const pill = (on) =>
  `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ease-out-smooth ${
    on ? "bg-accent-dark text-oncolor" : "text-ink-950/60 hover:text-ink-950"
  }`

// 7, 30 and 90 days, or "Custom": a number plus days, weeks or months.
// A month is 30 days. Applied on Enter or Apply, not per keystroke, since a
// longer range reloads the data. Custom opens a dropdown under its pill.
function RangeSwitch({ value, onChange }) {
  const custom = !RANGES.includes(value)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("14")
  const [unit, setUnit] = useState("days")
  const root = useRef(null)

  // Close on Escape or a click outside the menu.
  useEffect(() => {
    if (!open) return
    const close = (event) => {
      if (event.key === "Escape" || (event.type === "mousedown" && !root.current?.contains(event.target))) setOpen(false)
    }
    document.addEventListener("keydown", close)
    document.addEventListener("mousedown", close)
    return () => {
      document.removeEventListener("keydown", close)
      document.removeEventListener("mousedown", close)
    }
  }, [open])

  const apply = (event) => {
    event.preventDefault()
    const days = Math.round(Number(amount) * UNIT_DAYS[unit])
    if (days < 1) return
    onChange(Math.min(days, MAX_DAYS))
    setOpen(false)
  }

  return (
    <div ref={root} className="relative">
      <div role="group" aria-label="Date range" className="inline-flex rounded-full border border-ink-950/10 bg-white p-1">
        {RANGES.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={value === days}
            onClick={() => {
              setOpen(false)
              onChange(days)
            }}
            className={pill(value === days)}
          >
            {days} days
          </button>
        ))}
        <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)} className={pill(custom)}>
          {custom ? `${value} days` : "Custom"}
          <svg viewBox="0 0 12 12" aria-hidden="true" className={`ml-1.5 inline size-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <path d="M2 4.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <form
          onSubmit={apply}
          className="animate-pop-in absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-ink-950/10 bg-white p-4 shadow-xl"
        >
          <p className="text-sm font-semibold text-ink-950">Custom range</p>
          <p className="mt-0.5 text-xs text-ink-950/55">Count back from today, up to a year.</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_PICKS.map(([amount, unit, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setAmount(String(amount))
                  setUnit(unit)
                }}
                className="cursor-pointer rounded-full border border-ink-950/15 px-2.5 py-1 text-xs font-medium text-ink-950/70 transition-colors duration-200 hover:border-accent-dark hover:text-accent-text"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[auto_5rem_1fr] items-center gap-2">
            <label htmlFor="range-amount" className="text-sm text-ink-950/60">
              Last
            </label>
            <input
              id="range-amount"
              type="number"
              inputMode="numeric"
              min="1"
              max={Math.floor(MAX_DAYS / UNIT_DAYS[unit])}
              step="1"
              required
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-xl border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm text-ink-950 tabular-nums outline-none transition-colors duration-200 focus:border-ink-950/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Select
              value={unit}
              onChange={setUnit}
              ariaLabel="Unit"
              options={UNIT_OPTIONS}
              triggerClassName="px-3 py-2 text-sm"
            />
          </div>

          <button type="submit" className={`${pill(true)} mt-4 w-full`}>
            Apply
          </button>
        </form>
      )}
    </div>
  )
}

// Page views and clicks from the public site (meeting item 15). Counts only
// visitors who accepted the privacy banner, which the page says up front so
// nobody reads these as total traffic.
export default function SiteTraffic() {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(30)
  const { records } = useIntakeRecords()

  // Loads the chosen range (30 days on open) and keeps the longest loaded so
  // far: a shorter range filters it in place, only a longer one reloads.
  // Each event is one document read, so this used to read 90 days on every open.
  // ponytail: still one read per event; per-day totals need a server
  // (Cloud Functions, Blaze plan) once traffic makes this expensive.
  const [loadDays, setLoadDays] = useState(days)
  if (days > loadDays) setLoadDays(days)
  useEffect(() => {
    let active = true
    loadSiteEvents(loadDays)
      .then((result) => active && setEvents({ days: loadDays, list: result }))
      .catch((cause) => active && setError(cause.message))
    return () => {
      active = false
    }
  }, [loadDays])

  // Hold the skeleton until the load covers the chosen range.
  const ready = events && events.days >= days
  const metrics = useMemo(() => (ready ? derive(events.list, days) : null), [ready, events, days])
  const submitted = useMemo(() => (records ? submittedSince(records, days) : null), [records, days])
  const rangeLabel = days === 1 ? "Today" : `Last ${days} days`

  return (
    <div>
      <PageHeader title="Analytics" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-ink-950/60">
          Anonymous counts from visitors who accepted the privacy banner, so real traffic is higher. No cookies and no
          visitor IDs: these show what gets used, not who used it.
        </p>
        <RangeSwitch value={days} onChange={setDays} />
      </div>

      {error ? (
        <div className="rounded-2xl border border-ink-950/10 bg-white p-6">
          <h2 className="font-semibold text-ink-950">Could not load analytics</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
        </div>
      ) : !metrics ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </div>
          <ColumnChartSkeleton columns={14} />
          <div className="grid gap-4 lg:grid-cols-2">
            <BarListSkeleton rows={6} />
            <BarListSkeleton rows={6} />
          </div>
        </div>
      ) : !events.list.length ? (
        <div className="rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl text-ink-950">No visits counted yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-950/60">
            Counting starts once the updated Firestore rules are published and visitors accept the privacy banner on
            the site. Page views and clicks will appear here as they come in.
          </p>
        </div>
      ) : (
        <div className="space-y-4 overflow-x-clip">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Page views" value={metrics.views} caption={rangeLabel} />
            <StatTile label="Get started clicks" value={metrics.startClicks} caption={`${rangeLabel}, every intake button`} />
            <StatTile label="Intakes opened" value={metrics.intakesOpened} caption={rangeLabel} />
            <StatTile label="Intakes submitted" value={submitted ?? "—"} caption={`${rangeLabel}, all applicants`} />
          </div>

          <Card title={metrics.overTime.step > 1 ? "Page views per week" : "Page views per day"} hint={rangeLabel}>
            <ColumnChart
              data={metrics.overTime.data}
              describe={(item) =>
                `${item.value} page view${item.value === 1 ? "" : "s"} ${metrics.overTime.step > 1 ? "the week of" : "on"} ${item.label}`
              }
            />
          </Card>

          <Card title="From visit to intake" hint={`${rangeLabel}, visitors who accepted`}>
            <Funnel
              steps={[
                { label: "Page views", value: metrics.views },
                { label: "Get started clicks", value: metrics.startClicks },
                { label: "Intakes opened", value: metrics.intakesOpened },
              ]}
            />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Top pages" hint={`Page views, ${rangeLabel.toLowerCase()}`}>
              <BarList data={metrics.topPages} total={metrics.views} emptyLabel="No page views in this range" />
            </Card>
            <Card title="Most clicked" hint={`Buttons and links, ${rangeLabel.toLowerCase()}`}>
              <BarList
                data={metrics.topClicks}
                total={metrics.topClicks.reduce((sum, item) => sum + item.value, 0)}
                emptyLabel="No clicks in this range"
              />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
