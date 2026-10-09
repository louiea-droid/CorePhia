import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { byLatest, needsReply, topicCounts, unreadFor } from "../../lib/messageMath"
import PageHeader from "../layout/PageHeader"
import { formatRelativeTime, useRelativeTimeClock } from "../lib/relativeTime"
import { loadCharts } from "../patients/chartStore"
import { formatDay } from "../patients/noteUi"
import { SearchIcon } from "../ui/icons"
import NewTopicDialog from "./NewTopicDialog"
import TopicView from "./TopicView"
import { useTopics } from "./useTopics"

const FILTERS = [
  ["needsReply", "Needs a reply"],
  ["open", "Open"],
  ["closed", "Closed"],
  ["all", "All"],
]
const EMPTY = {
  needsReply: "Nothing needs a reply.",
  open: "No open topics.",
  closed: "No closed topics.",
  all: "No messages yet. Patients' messages and your replies show here.",
}
const asIso = (value) => (typeof value?.toDate === "function" ? value.toDate().toISOString() : value ? new Date(value).toISOString() : null)
const when = (value, now) => {
  const iso = asIso(value)
  if (!iso) return ""
  return now - new Date(iso).getTime() < 86_400_000 ? formatRelativeTime(iso, now) : formatDay(iso)
}

// The care team's shared inbox (spec 2026-10-06-portal-messages-design).
// ?topic= opens one; ?patient= narrows the list to one chart.
export default function MessagesPage({ actor }) {
  const { topics, error } = useTopics()
  const [charts, setCharts] = useState(new Map())
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState(params.get("patient") ? "all" : "needsReply")
  const [search, setSearch] = useState("")
  const [composing, setComposing] = useState(false)
  // Ticks every 30 seconds, so "10 mins ago" keeps counting while the inbox
  // stays open and a message that arrives meanwhile doesn't read "just now" for hours.
  const now = useRelativeTimeClock(true, 30_000)
  const selectedId = params.get("topic")
  const patient = params.get("patient")

  useEffect(() => {
    loadCharts()
      .then((all) => setCharts(new Map(all.map((chart) => [chart.id, chart]))))
      .catch((cause) => console.error("Could not load patients:", cause.code ?? cause.message))
  }, [])

  const nameOf = (chartId) => {
    const chart = charts.get(chartId)
    return chart ? `${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient" : "Patient"
  }

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (topics ?? [])
      .filter((topic) => !patient || topic.chartId === patient)
      .filter((topic) => (filter === "needsReply" ? needsReply(topic) : filter === "all" ? true : topic.status === filter))
      .filter((topic) => !needle || nameOf(topic.chartId).toLowerCase().includes(needle))
      .sort(byLatest)
    // nameOf reads charts, which is in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, filter, search, patient, charts])

  const counts = topicCounts(topics ?? [])
  const selected = topics?.find((topic) => topic.id === selectedId) ?? null
  const open = (topic) => {
    const next = new URLSearchParams(params)
    next.set("topic", topic.id)
    setParams(next)
  }
  const back = () => {
    const next = new URLSearchParams(params)
    next.delete("topic")
    setParams(next)
  }

  return (
    <div className="flex h-full flex-col pb-6">
      <PageHeader title="Messages" />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section aria-label="Topics" className={`flex min-h-0 flex-col rounded-2xl border border-ink-950/10 bg-white ${selected ? "hidden lg:flex" : "flex"}`}>
          <div className="space-y-3 border-b border-ink-950/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink-950">{patient ? `Messages with ${nameOf(patient)}` : "All patients"}</h2>
              <button type="button" onClick={() => setComposing(true)} className="cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark">
                New message
              </button>
            </div>
            <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                    filter === value ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/70 hover:bg-ink-950/10"
                  }`}
                >
                  {label}
                  {value === "needsReply" && counts.needsReply > 0 ? ` (${counts.needsReply})` : ""}
                </button>
              ))}
            </div>
            <label className="relative block">
              <span className="sr-only">Search by patient</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-950/40" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by patient"
                className="w-full rounded-lg border border-ink-950/15 bg-paper-50 py-2 pr-3 pl-9 text-sm text-ink-950 outline-none placeholder:text-ink-950/40 focus:border-ink-950/40"
              />
            </label>
            {patient && (
              <button type="button" onClick={() => setParams(new URLSearchParams())} className="cursor-pointer text-xs font-semibold text-accent-text hover:underline">
                Show all patients
              </button>
            )}
          </div>
          <ol className="min-h-0 flex-1 divide-y divide-ink-950/10 overflow-y-auto">
            {error ? (
              <li className="p-4 text-sm text-brand-dark">Couldn't load messages.</li>
            ) : !topics ? (
              <li className="p-4 text-sm text-ink-950/50">Loading…</li>
            ) : shown.length === 0 ? (
              <li className="p-6 text-center text-sm text-ink-950/55">{EMPTY[filter]}</li>
            ) : (
              shown.map((topic) => {
                const unread = unreadFor(topic, "staff")
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      onClick={() => open(topic)}
                      aria-current={topic.id === selectedId ? "true" : undefined}
                      className={`block w-full cursor-pointer px-4 py-3 text-left transition-colors duration-150 hover:bg-paper-50 ${topic.id === selectedId ? "bg-paper-100" : ""}`}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`truncate text-sm ${unread ? "font-semibold text-ink-950" : "text-ink-950/80"}`}>{nameOf(topic.chartId)}</span>
                        <span className="shrink-0 text-xs text-ink-950/50">{when(topic.lastMessageAt, now)}</span>
                      </span>
                      <span className={`mt-0.5 block truncate text-sm ${unread ? "font-semibold text-ink-950" : "text-ink-950/70"}`}>{topic.subject}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {needsReply(topic) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Needs a reply</span>}
                        {topic.status === "closed" && <span className="rounded-full bg-ink-950/10 px-2 py-0.5 text-xs font-medium text-ink-950/60">Closed</span>}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ol>
        </section>

        <div className={selected ? "min-h-0" : "hidden lg:block"}>
          {selected ? (
            <TopicView key={selected.id} topic={selected} chart={charts.get(selected.chartId)} actor={actor} onBack={back} />
          ) : (
            <div className="grid h-full min-h-60 place-items-center rounded-2xl border border-dashed border-ink-950/15 p-6 text-center text-sm text-ink-950/55">
              Choose a topic to read it.
            </div>
          )}
        </div>
      </div>

      {composing && (
        <NewTopicDialog
          actor={actor}
          initialChartId={patient ?? ""}
          onClose={() => setComposing(false)}
          onStarted={({ topicId }) => {
            setComposing(false)
            setFilter("all")
            const next = new URLSearchParams(params)
            next.set("topic", topicId)
            setParams(next)
          }}
        />
      )}
    </div>
  )
}
