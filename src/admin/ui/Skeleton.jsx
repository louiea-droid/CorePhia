// Every skeleton here reuses the exact wrapper classNames from charts.jsx /
// ApplicantsTable.jsx (border-radius, padding, grid columns, row heights) —
// only the text/values inside are swapped for pulsing bars. That's what
// makes this "placement-accurate": the loaded content drops into identical
// boxes rather than the page reflowing once real data arrives.
function Bar({ className = "" }) {
  return <div className={`animate-pulse rounded-full bg-ink-950/10 ${className}`} />
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-2xl border border-ink-950/10 border-t-2 border-t-accent-dark/40 bg-white p-4">
      <Bar className="h-3 w-24" />
      <Bar className="mt-2.5 h-8 w-14" />
      <Bar className="mt-2.5 h-2.5 w-32" />
    </div>
  )
}

// Mirrors Card's own header row exactly so a real Card can swap in without
// the title/hint position shifting even by a pixel.
function CardFrame({ className = "", children }) {
  return (
    <section className={`rounded-2xl border border-ink-950/10 bg-white p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <Bar className="h-3.5 w-36" />
        <Bar className="h-2.5 w-16" />
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

// Slight width variation per row so it reads as content, not a repeated tile.
const ROW_WIDTHS = ["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4", "w-1/3", "w-3/5", "w-2/5", "w-1/2"]
const BAR_WIDTHS = ["w-full", "w-2/3", "w-4/5", "w-1/2", "w-3/5", "w-1/3", "w-3/4", "w-2/5", "w-1/2"]

export function BarListSkeleton({ rows = 4, className = "" }) {
  return (
    <CardFrame className={className}>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index}>
            <div className="flex items-baseline justify-between gap-3">
              <Bar className={`h-3 ${ROW_WIDTHS[index % ROW_WIDTHS.length]}`} />
              <Bar className="h-3 w-4 shrink-0" />
            </div>
            <Bar className={`mt-1 h-1.5 ${BAR_WIDTHS[index % BAR_WIDTHS.length]}`} />
          </div>
        ))}
      </div>
    </CardFrame>
  )
}

export function ColumnChartSkeleton({ className = "", columns = 10 }) {
  // Random-looking but fixed per index, so it doesn't visibly shuffle on
  // every re-render while still avoiding a flat, obviously-fake bar chart.
  const heights = [55, 30, 70, 45, 85, 25, 60, 40, 95, 50]
  return (
    <CardFrame className={className}>
      <div className="flex h-40 items-end gap-1.5 border-b border-ink-950/10 pb-0">
        {Array.from({ length: columns }).map((_, index) => (
          <div key={index} className="flex-1" style={{ height: `${heights[index % heights.length]}%` }}>
            <Bar className="h-full w-full rounded-t-sm rounded-b-none" />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {Array.from({ length: columns }).map((_, index) => (
          <Bar key={index} className="h-2 flex-1" />
        ))}
      </div>
    </CardFrame>
  )
}

export function StackedBarSkeleton({ className = "", segments = 3 }) {
  return (
    <CardFrame className={className}>
      <Bar className="h-3 w-full rounded-sm" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: segments }).map((_, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <div className="size-2.5 shrink-0 animate-pulse rounded-full bg-ink-950/10" />
            <Bar className="h-3 flex-1" />
            <Bar className="h-3 w-6 shrink-0" />
            <Bar className="h-3 w-8 shrink-0" />
          </div>
        ))}
      </div>
    </CardFrame>
  )
}

// Shared by Dashboard's "Most recent intakes" preview and the full Patients
// list loading states — matches ApplicantsTable's real table-fixed + colgroup
// widths and py-4 row height exactly.
// The dashboard's recent-patients table and the Patients page's table have
// different column counts, so the shape is a parameter rather than baked in —
// each caller passes the colgroup it actually renders, and neither reflows.
const DASHBOARD_TABLE_COLS = [
  { col: "w-[26%]", head: "w-16", cell: "w-28" },
  { col: "w-[18%]", head: "w-20", cell: "w-20" },
  { col: "w-[18%]", head: "w-12", cell: "w-16" },
  { col: "w-[38%]", head: "w-14", cell: "w-32" },
]

// Mirrors ApplicantsTable.jsx's own colgroup.
const PATIENTS_TABLE_COLS = [
  { col: "w-[20%]", head: "w-16", cell: "w-28" },
  { col: "w-[14%]", head: "w-20", cell: "w-20" },
  { col: "w-[12%]", head: "w-10", cell: "w-14" },
  { col: "w-[14%]", head: "w-12", cell: "w-16" },
  { col: "w-[16%]", head: "w-10", cell: "w-20" },
  { col: "w-[24%]", head: "w-14", cell: "w-32" },
]

export function TableSkeleton({ rows = 8, cols = DASHBOARD_TABLE_COLS }) {
  return (
    <table className="w-full min-w-xl table-fixed text-left text-sm">
      <colgroup>
        {cols.map((column, index) => (
          <col key={index} className={column.col} />
        ))}
      </colgroup>
      <thead>
        <tr className="border-b border-ink-950/10">
          {cols.map((column, index) => (
            <th key={index} className="pb-2">
              <Bar className={`h-2.5 ${column.head}`} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-ink-950/5">
        {Array.from({ length: rows }).map((_, index) => (
          <tr key={index}>
            {cols.map((column, columnIndex) => (
              <td key={columnIndex} className="py-4">
                <Bar className={`h-3.5 ${column.cell}`} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Mirrors Dashboard.jsx's populated layout row-for-row: 4 stat tiles, 3 weight
// stat tiles, the weekly chart + plan split, three bar-list cards, two more
// bar-list rows, the weight spread, and the recent-intakes table preview.
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Mirrors Dashboard.jsx's own stat-tile grid (3 columns, 6 tiles). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ColumnChartSkeleton className="lg:col-span-2" />
        <StackedBarSkeleton />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BarListSkeleton rows={6} />
        <BarListSkeleton rows={4} />
        <BarListSkeleton rows={5} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarListSkeleton rows={8} />
        <BarListSkeleton rows={7} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <BarListSkeleton rows={6} />
        <BarListSkeleton rows={4} />
      </div>

      <CardFrame>
        <TableSkeleton rows={8} />
      </CardFrame>
    </div>
  )
}

// Mirrors Patients.jsx's populated layout: the bordered section with the
// search/filter toolbar (shrink-0), the table, and the pagination footer
// (shrink-0) — same structure, so nothing shifts when real data lands.
export function ApplicantsSkeleton() {
  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-ink-950/10 bg-white">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-950/10 p-4">
        <Bar className="h-9 min-w-0 flex-1 rounded-lg" />
        <Bar className="h-9 w-28 rounded-lg" />
        <Bar className="h-9 w-32 rounded-lg" />
      </div>

      <div className="flex-1 overflow-hidden px-4 pt-3">
        <TableSkeleton rows={10} cols={PATIENTS_TABLE_COLS} />
      </div>

      <div className="shrink-0 px-4 pb-4">
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-950/10 pt-4">
          <Bar className="h-3.5 w-32" />
          <div className="flex items-center gap-1.5">
            <Bar className="h-8 w-16 rounded-lg" />
            <Bar className="h-8 w-8 rounded-lg" />
            <Bar className="h-8 w-8 rounded-lg" />
            <Bar className="h-8 w-16 rounded-lg" />
          </div>
          <Bar className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </section>
  )
}
