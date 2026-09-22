// Categorical slots 1-3 of the validated data-viz palette. Hardcoded on purpose:
// they were checked for colour-vision separation against the white card surface
// as a set, so they are not interchangeable with the site's @theme tokens.
// Single-hue magnitude bars use accent-dark and do follow the tokens.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"]

export function Card({ title, hint, children, className = "" }) {
  const hasHeader = Boolean(title || hint)
  return (
    <section className={`rounded-2xl border border-ink-950/10 bg-white p-4 ${className}`}>
      {hasHeader && (
        <div className="flex items-baseline justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-ink-950">{title}</h2>}
          {hint && <span className="text-xs text-ink-950/45">{hint}</span>}
        </div>
      )}
      <div className={hasHeader ? "mt-3" : ""}>{children}</div>
    </section>
  )
}

// Deliberately not the same shell as Card below: these are the headline
// numbers on the page, so they carry a top accent edge and a larger figure
// rather than reading as just another one of the detail-chart boxes beneath
// them. The label skips the tracked-uppercase treatment other admin labels
// use — the number is the content here, not a value under a heading, so it
// doesn't need eyebrow styling to be legible.
export function StatTile({ label, value, unit, caption }) {
  return (
    <div className="rounded-2xl border border-ink-950/10 border-t-2 border-t-accent-dark bg-white p-4">
      <p className="text-sm font-medium text-ink-950/60">{label}</p>
      <p className="mt-1 text-3xl leading-none font-semibold text-ink-950">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-ink-950/50">{unit}</span>}
      </p>
      {caption && <p className="mt-1.5 text-xs text-ink-950/45">{caption}</p>}
    </div>
  )
}

// Horizontal magnitude bars: one hue, length carries the value, every row
// direct-labelled so identity never depends on colour.
export function BarList({ data, total, emptyLabel = "No data yet", onSelect }) {
  if (!data.length) return <p className="py-6 text-sm text-ink-950/45">{emptyLabel}</p>

  const max = Math.max(...data.map((item) => item.value))

  return (
    <ul className="space-y-2">
      {data.map((item) => {
        const share = total ? Math.round((item.value / total) * 100) : 0
        // Only rows a caller actually wired up (onSelect) become clickable —
        // e.g. "which patients reported this condition" makes sense for
        // Conditions/Family history, not for a plain per-week count.
        const interactiveProps = onSelect
          ? {
              onClick: () => onSelect(item),
              onKeyDown: (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onSelect(item)
                }
              },
              tabIndex: 0,
              role: "button",
              "aria-label": `See patients who reported ${item.label}`,
            }
          : {}
        return (
          <li
            key={item.label}
            {...interactiveProps}
            className={`group relative ${
              onSelect
                ? "-mx-2 cursor-pointer rounded-lg px-2 py-1 outline-none transition-colors duration-150 hover:bg-paper-100 focus-visible:bg-paper-100"
                : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-ink-950/80">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-950">{item.value}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-xs bg-paper-100">
              <div
                className="h-1.5 rounded-r-sm bg-accent-dark transition-[width] duration-500 ease-out-smooth"
                style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
              />
            </div>
            <span className="pointer-events-none absolute -top-1 right-0 z-10 rounded-lg bg-ink-950 px-2 py-1 text-xs whitespace-nowrap text-paper-50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {item.value} of {total} patients ({share}%)
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// Weekly submission counts. Columns rather than a line because each bar is a
// discrete per-week total, not a continuous measure.
export function ColumnChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div>
      {/* items-stretch (not items-end) so each column fills the row height —
          the bars' percentage heights resolve against it. */}
      <div className="flex h-40 items-stretch gap-1.5 border-b border-ink-950/10">
        {data.map((item) => (
          <div key={item.label} className="group relative flex flex-1 flex-col items-center justify-end">
            <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-ink-950 px-2 py-1 text-xs whitespace-nowrap text-paper-50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {item.value} intake{item.value === 1 ? "" : "s"} the week of {item.label}
            </span>
            {item.value > 0 && (
              <span className="mb-1 text-xs font-semibold tabular-nums text-ink-950/70">{item.value}</span>
            )}
            <div
              className="w-full rounded-t-sm bg-accent-dark transition-[height] duration-500 ease-out-smooth"
              // Capped below 100% to leave room for the value label above the bar.
              style={{ height: `${(item.value / max) * 88}%`, minHeight: item.value > 0 ? "3px" : "0" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((item) => (
          <span key={item.label} className="flex-1 text-center text-[10px] text-ink-950/40">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// Compact rank rows rather than magnitude bars — for a field with only a
// handful of possible values (states), a full-width progress bar exaggerates
// a small row count into a stretched, mostly-empty-looking bar (worst case:
// one value at 100%, all bar and no comparison to carry). A badge + count
// reads correctly whether there's one entry or ten, since row height follows
// the item count instead of bar length trying to fill the card.
export function RankedList({ data, total, emptyLabel = "No data yet", onSelect }) {
  if (!data.length) return <p className="py-6 text-sm text-ink-950/45">{emptyLabel}</p>

  return (
    <ul className="space-y-1">
      {data.map((item, index) => {
        const share = total ? Math.round((item.value / total) * 100) : 0
        const interactiveProps = onSelect
          ? {
              onClick: () => onSelect(item),
              onKeyDown: (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onSelect(item)
                }
              },
              tabIndex: 0,
              role: "button",
              "aria-label": `See patients reporting ${item.label}`,
            }
          : {}
        return (
          <li
            key={item.label}
            {...interactiveProps}
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 outline-none ${
              onSelect
                ? "cursor-pointer transition-colors duration-150 hover:bg-paper-100 focus-visible:bg-paper-100"
                : ""
            }`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                index === 0 ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/60"
              }`}
            >
              {index + 1}
            </span>
            <span className="flex-1 truncate text-sm text-ink-950/80">{item.label}</span>
            <span className="text-sm font-semibold tabular-nums text-ink-950">{item.value}</span>
            <span className="w-10 text-right text-xs tabular-nums text-ink-950/45">{share}%</span>
          </li>
        )
      })}
    </ul>
  )
}

// Fixed-width numeric bins: bars sit flush against each other (no gaps),
// unlike ColumnChart's per-week bars, because a histogram's axis is
// continuous — there's no real gap between "100–124 lb" and "125–149 lb" the
// way there is between one week and the next. Boundary numbers sit between
// bars instead of a label centered under each one, matching how a real
// histogram axis is read.
export function Histogram({ data, unit, onSelect }) {
  if (!data.length) return <p className="py-6 text-sm text-ink-950/45">No data yet</p>

  const max = Math.max(...data.map((item) => item.value), 1)
  const boundaries = [...data.map((item) => item.min), data[data.length - 1].max]

  return (
    <div>
      <div className="flex h-32 items-stretch border-b border-ink-950/10">
        {data.map((item, index) => {
          const interactiveProps = onSelect
            ? {
                onClick: () => onSelect(item),
                onKeyDown: (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelect(item)
                  }
                },
                tabIndex: 0,
                role: "button",
                "aria-label": `See patients in the ${item.label} range`,
              }
            : {}
          return (
            <div
              key={item.label}
              {...interactiveProps}
              className={`group relative flex flex-1 flex-col items-stretch justify-end outline-none ${
                index > 0 ? "border-l border-white" : ""
              } ${onSelect ? "cursor-pointer" : ""}`}
            >
              <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-ink-950 px-2 py-1 text-xs whitespace-nowrap text-paper-50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {item.value} patient{item.value === 1 ? "" : "s"} in the {item.label} range
              </span>
              <div
                className="w-full bg-accent-dark/70 transition-[height] duration-500 ease-out-smooth group-hover:bg-accent-dark"
                style={{ height: `${(item.value / max) * 100}%`, minHeight: item.value > 0 ? "3px" : "0" }}
              />
            </div>
          )
        })}
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] text-ink-950/40">
        {boundaries.map((value, index) => {
          const isFirst = index === 0
          const isLast = index === boundaries.length - 1
          return (
            <span
              key={value}
              className="absolute"
              style={{
                left: `${(index / data.length) * 100}%`,
                transform: isFirst ? "none" : isLast ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {value}
              {isLast && unit ? ` ${unit}` : ""}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// A cluster of pills rather than ranked rows — for fields where a patient can
// report more than one (conditions, family history), so the values don't sum
// to the intake total and a shared-length bar would imply a "share of whole"
// that isn't real. Frequency reads through fill weight instead: the more
// patients who reported it, the darker/bolder the pill.
export function TagCloud({ data, emptyLabel = "No data yet", onSelect }) {
  if (!data.length) return <p className="py-6 text-sm text-ink-950/45">{emptyLabel}</p>

  const max = Math.max(...data.map((item) => item.value))

  return (
    <ul className="flex flex-wrap gap-2">
      {data.map((item) => {
        const share = item.value / max
        const tone =
          share >= 0.7
            ? "bg-accent-dark text-oncolor font-semibold"
            : share >= 0.35
              ? "bg-accent-dark/15 text-ink-950 font-medium"
              : "bg-paper-100 text-ink-950/70"
        const interactiveProps = onSelect
          ? {
              onClick: () => onSelect(item),
              onKeyDown: (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onSelect(item)
                }
              },
              tabIndex: 0,
              role: "button",
              "aria-label": `See patients who reported ${item.label}`,
            }
          : {}
        return (
          <li key={item.label}>
            <span
              {...interactiveProps}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm outline-none transition-transform duration-150 ease-out-smooth hover:scale-[1.04] focus-visible:scale-[1.04] ${tone}`}
            >
              {item.label}
              <span className="text-xs tabular-nums opacity-70">{item.value}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// Part-to-whole across a handful of named series: the one place categorical
// colour earns its place. Legend carries swatch + label + value.
export function StackedBar({ data, total }) {
  if (!data.length) return <p className="py-6 text-sm text-ink-950/45">No data yet</p>

  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden">
        {data.map((item, index) => (
          <div
            key={item.label}
            title={`${item.label}: ${item.value}`}
            className="h-3 first:rounded-l-sm last:rounded-r-sm"
            style={{
              width: `${(item.value / total) * 100}%`,
              backgroundColor: SERIES[index % SERIES.length],
            }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {data.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SERIES[index % SERIES.length] }}
            />
            <span className="flex-1 truncate text-ink-950/80">{item.label}</span>
            <span className="font-semibold tabular-nums text-ink-950">{item.value}</span>
            <span className="w-10 text-right text-xs tabular-nums text-ink-950/45">
              {Math.round((item.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
