import { useEffect, useRef, useState } from "react"
import { vitalsText } from "../lib/progressMath"

const H = 220
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }
const TIP_WIDTH = 176 // px; fixed so it can be placed beside the cursor without measuring
const TIP_GAP = 14
const utc = (iso) => Date.UTC(...iso.split("-").map((part, index) => Number(part) - (index === 1 ? 1 : 0)))
const label = (iso) => new Date(utc(iso)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
const longLabel = (iso) => new Date(utc(iso)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
const SOURCE = { visit: "Visit", home: "Logged at home" }

// What a point says about where it came from: "Logged at home", or "Visit"
// plus that visit's blood pressure and heart rate.
const sourceLine = (point) => {
  if (point.source !== "visit") return SOURCE[point.source]
  const extra = vitalsText({ systolic: point.systolic, diastolic: point.diastolic, heartRate: point.heartRate })
  return extra ? `Visit, ${extra}` : "Visit"
}

// Weight over time for the chart page and the patient portal. Visit points
// solid, home points hollow, goal dashed. Colours are theme tokens, so it
// follows the admin's dark mode and the site's palette. Drawn at its real
// pixel width (measured), so labels stay readable in a narrow card and don't
// balloon in a wide one.
//
// Hover anywhere over the chart (or tap, or focus a point with the keyboard):
// the nearest weight gets a guide line and a halo, and a card beside the
// cursor gives its date, weight and source.
//
// `animate` (the portal): the line draws in once, then the dots fade in; the
// hover card fades in. The staff chart stays still.
export default function WeightChart({ points, goalLb = null, animate = false }) {
  const [tip, setTip] = useState(null) // { index, px, py } in px from the figure's top left
  const [announced, setAnnounced] = useState("") // keyboard focus only, so hovering stays quiet
  const [W, setW] = useState(600)
  const box = useRef(null)
  const svgRef = useRef(null)
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
  // Points on the same spot (same day, same weight) are shown together, since
  // only the top one could be picked out by eye.
  const samePlace = (point) => points.filter((other) => other.date === point.date && other.weightLb === point.weightLb)
  const describe = (point) => `${longLabel(point.date)}: ${point.weightLb} lbs, ${samePlace(point).map(sourceLine).join("; ")}`

  // The pointer only has to be closest: nearest date first, then nearest weight.
  const pick = (event) => {
    const rect = svgRef.current.getBoundingClientRect()
    const scale = rect.width / W
    const sx = (event.clientX - rect.left) / scale
    const sy = (event.clientY - rect.top) / scale
    let best = 0
    points.forEach((point, index) => {
      const dx = Math.abs(x(point.date) - sx) - Math.abs(x(points[best].date) - sx)
      if (dx < -0.5 || (Math.abs(dx) <= 0.5 && Math.abs(y(point.weightLb) - sy) < Math.abs(y(points[best].weightLb) - sy))) best = index
    })
    setTip({ index: best, px: event.clientX - rect.left, py: event.clientY - rect.top })
  }

  const tipPoint = tip ? points[tip.index] : null
  // Beside the cursor: to the right, else to the left, else clamped inside
  // and lifted above the cursor so it doesn't sit under the finger.
  let tipLeft = 0
  let tipTop = 0
  if (tip) {
    const right = tip.px + TIP_GAP
    const left = tip.px - TIP_GAP - TIP_WIDTH
    const fitsRight = right + TIP_WIDTH <= W
    const fitsLeft = left >= 0
    tipLeft = fitsRight ? right : fitsLeft ? left : Math.min(Math.max(tip.px - TIP_WIDTH / 2, 0), W - TIP_WIDTH)
    tipTop = fitsRight || fitsLeft ? Math.min(Math.max(tip.py, 40), H - 40) : Math.max(tip.py - 70, 40)
  }

  return (
    <figure ref={box} className="relative mt-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block max-w-full touch-pan-y"
        role="img"
        aria-label="Weight over time"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(event) => event.pointerType === "mouse" && setTip(null)}
      >
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
        {tipPoint && (
          <line
            data-guide
            aria-hidden="true"
            x1={x(tipPoint.date)}
            x2={x(tipPoint.date)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            strokeDasharray="3 3"
            className="stroke-ink-950/30"
          />
        )}
        {points.length > 1 && (
          <polyline
            points={points.map((point) => `${x(point.date)},${y(point.weightLb)}`).join(" ")}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            pathLength="1"
            className={`stroke-accent-dark ${animate ? "animate-draw" : ""}`}
          />
        )}
        {/* The picked point gets a soft halo, never a size change. */}
        {tipPoint && <circle cx={x(tipPoint.date)} cy={y(tipPoint.weightLb)} r="11" aria-hidden="true" className="fill-accent-dark/25" />}
        {points.map((point, index) => (
          <circle
            key={point.id}
            cx={x(point.date)}
            cy={y(point.weightLb)}
            r="5"
            strokeWidth="2"
            tabIndex={0}
            aria-label={`${longLabel(point.date)}, ${point.weightLb} lbs, ${sourceLine(point)}`}
            onFocus={() => {
              const scale = (svgRef.current?.getBoundingClientRect().width ?? W) / W
              setTip({ index, px: x(point.date) * scale, py: y(point.weightLb) * scale })
              setAnnounced(describe(point))
            }}
            onBlur={() => setTip(null)}
            className={`cursor-pointer stroke-accent-dark outline-none ${point.source === "home" ? "fill-white" : "fill-accent-dark"} ${animate ? "animate-dots-in" : ""}`}
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

      {tipPoint && (
        <div
          role="tooltip"
          style={{ left: tipLeft, top: tipTop, width: TIP_WIDTH }}
          className={`pointer-events-none absolute z-10 -translate-y-1/2 rounded-xl border border-ink-950/10 bg-white px-3 py-2 text-xs shadow-lg ${animate ? "animate-tip-in" : ""}`}
        >
          <p className="text-ink-950/60">{longLabel(tipPoint.date)}</p>
          <p className="mt-0.5 text-sm font-semibold text-ink-950">{tipPoint.weightLb} lbs</p>
          {samePlace(tipPoint).map((point) => (
            <p key={point.id} className="mt-0.5 text-ink-950/70">
              {sourceLine(point)}
            </p>
          ))}
        </div>
      )}

      <figcaption className="mt-2 flex items-center justify-end gap-3 text-xs text-ink-950/60">
        <span aria-live="polite" className="sr-only">
          {announced}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent-dark" aria-hidden="true" />
          Visit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-accent-dark" aria-hidden="true" />
          Logged at home
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Weights</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <td>{longLabel(point.date)}</td>
              <td>{point.weightLb} lbs</td>
              <td>{sourceLine(point)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
