import { useEffect, useRef, useState } from "react"

const H = 220
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }
const utc = (iso) => Date.UTC(...iso.split("-").map((part, index) => Number(part) - (index === 1 ? 1 : 0)))
const label = (iso) => new Date(utc(iso)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
const longLabel = (iso) => new Date(utc(iso)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
const SOURCE = { visit: "Visit", home: "Logged at home" }

// Weight over time for the chart page and the patient portal. Visit points
// solid, home points hollow, goal dashed. Colours are theme tokens, so it
// follows the admin's dark mode and the site's palette. Each point is
// focusable; the line under the chart reads out the focused (or latest) one.
// Drawn at its real pixel width (measured), so labels stay readable in a
// narrow card and don't balloon in a wide one.
export default function WeightChart({ points, goalLb = null }) {
  const [active, setActive] = useState(null)
  const [announced, setAnnounced] = useState("") // keyboard focus only, so hovering stays quiet
  const [W, setW] = useState(600)
  const box = useRef(null)
  const hasPoints = points.length > 0
  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setW(Math.max(240, Math.round(entry.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasPoints])
  if (!points.length) return null

  const weights = points.map((point) => point.weightLb).concat(goalLb ?? [])
  const low = Math.floor(Math.min(...weights) - 5)
  const high = Math.ceil(Math.max(...weights) + 5)
  const first = utc(points[0].date)
  // Every point on one day (a first visit and a weigh-in, say): centre them.
  const oneDay = utc(points.at(-1).date) === first
  const span = Math.max(utc(points.at(-1).date) - first, 1)
  const x = (iso) => (oneDay ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((utc(iso) - first) / span) * (W - PAD.left - PAD.right))
  const y = (lb) => PAD.top + ((high - lb) / (high - low)) * (H - PAD.top - PAD.bottom)
  const ticks = [high, Math.round((high + low) / 2), low]
  const shown = points[active ?? points.length - 1]
  // Points on the same spot (same day, same weight) are read out together,
  // since only the top one can be hovered.
  const describe = (point) => {
    const here = points.filter((other) => other.date === point.date && other.weightLb === point.weightLb)
    const sources = [...new Set(here.map((other) => SOURCE[other.source].toLowerCase()))].join(" and ")
    return `${longLabel(point.date)}: ${point.weightLb} lbs, ${sources}`
  }

  return (
    <figure ref={box} className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Weight over time">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-ink-950/10" />
            <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-ink-950/50 text-[11px]">
              {tick}
            </text>
          </g>
        ))}
        {goalLb != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(goalLb)} y2={y(goalLb)} strokeDasharray="6 5" className="stroke-ink-950/45" />
            <text x={W - PAD.right} y={y(goalLb) - 6} textAnchor="end" className="fill-ink-950/60 text-[11px]">
              Goal {goalLb} lbs
            </text>
          </g>
        )}
        {points.length > 1 && (
          <polyline
            points={points.map((point) => `${x(point.date)},${y(point.weightLb)}`).join(" ")}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            className="stroke-accent-dark"
          />
        )}
        {/* Hover and focus highlight with a soft halo, never a size change. */}
        {active != null && (
          <circle cx={x(points[active].date)} cy={y(points[active].weightLb)} r="11" aria-hidden="true" className="fill-accent-dark/25" />
        )}
        {points.map((point, index) => (
          <circle
            key={point.id}
            cx={x(point.date)}
            cy={y(point.weightLb)}
            r="5"
            strokeWidth="2"
            tabIndex={0}
            aria-label={`${longLabel(point.date)}, ${point.weightLb} lbs, ${SOURCE[point.source]}`}
            onMouseEnter={() => setActive(index)}
            onFocus={() => {
              setActive(index)
              setAnnounced(describe(point))
            }}
            onMouseLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            className={`cursor-pointer stroke-accent-dark outline-none ${point.source === "home" ? "fill-white" : "fill-accent-dark"}`}
          />
        ))}
        <text x={oneDay ? x(points[0].date) : PAD.left} y={H - 8} textAnchor={oneDay ? "middle" : "start"} className="fill-ink-950/50 text-[11px]">
          {label(points[0].date)}
        </text>
        {!oneDay && (
          <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-ink-950/50 text-[11px]">
            {label(points.at(-1).date)}
          </text>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-950/60">
        <span aria-hidden="true">{describe(shown)}</span>
        <span aria-live="polite" className="sr-only">
          {announced}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-accent-dark" aria-hidden="true" />
            Visit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-accent-dark" aria-hidden="true" />
            Logged at home
          </span>
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Weights</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <td>{longLabel(point.date)}</td>
              <td>{point.weightLb} lbs</td>
              <td>{SOURCE[point.source]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
