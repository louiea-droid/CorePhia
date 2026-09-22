import { PAGE_SIZE_OPTIONS } from "./constants"

// Windows the page numbers around the current page (plus first/last),
// collapsing gaps into "…" — e.g. for page 7 of 20: 1 … 6 7 8 … 20.
function getPageItems(current, total) {
  const delta = 1
  const range = []
  for (let i = 1; i <= total; i += 1) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i)
    }
  }
  const items = []
  let previous
  for (const page of range) {
    if (previous !== undefined) {
      items.push(page - previous === 2 ? previous + 1 : page - previous > 2 ? "…" : null)
    }
    items.push(page)
    previous = page
  }
  return items.filter((item) => item !== null)
}

export default function Pagination({ page, totalPages, onPageChange, pageSize, onPageSizeChange, totalRecords }) {
  const start = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalRecords)
  const arrowClass =
    "rounded-lg border border-ink-950/15 px-2.5 py-1.5 text-ink-950/70 transition-colors duration-200 enabled:cursor-pointer hover:enabled:bg-ink-950/5 hover:enabled:text-ink-950 disabled:cursor-not-allowed disabled:opacity-35"

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-950/10 pt-4 text-sm">
      <span className="text-ink-950/60">
        Showing <span className="font-medium text-ink-950">{start}</span>–
        <span className="font-medium text-ink-950">{end}</span> of {totalRecords}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={arrowClass}
        >
          ‹
        </button>

        {getPageItems(page, totalPages).map((item, index) =>
          item === "…" ? (
            <span key={`ellipsis-${index}`} className="px-1.5 text-ink-950/40">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={`min-w-8 cursor-pointer rounded-lg px-2.5 py-1.5 text-center font-medium transition-colors duration-200 ${
                item === page
                  ? "bg-accent-dark text-oncolor"
                  : "text-ink-950/70 hover:bg-ink-950/5 hover:text-ink-950"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={arrowClass}
        >
          ›
        </button>
      </div>

      <label className="flex items-center gap-2 text-ink-950/60">
        Show
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="cursor-pointer rounded-lg border border-ink-950/15 bg-white px-2 py-1.5 text-ink-950 outline-none transition-colors duration-200 focus:border-ink-950/40"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
