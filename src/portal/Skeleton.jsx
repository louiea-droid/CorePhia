// Loading placeholders for the portal: soft grey shapes in the layout of what's
// coming (with a gentle shimmer, still under "reduce motion"), so nothing jumps
// when the data arrives. Screen readers hear the label instead.
export function Skeleton({ className = "" }) {
  return <span data-skeleton aria-hidden="true" className={`skeleton block rounded-lg ${className}`} />
}

export function Loading({ label, className = "mt-6", children }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
