import { useEffect, useState } from "react"

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

// Opens and closes its content smoothly (height and opacity), keeping it on
// screen while it closes and removing it after, so a form that reopens starts
// fresh. Under "reduce motion" it shows and hides at once.
export default function Collapse({ open, children }) {
  const [mounted, setMounted] = useState(open)
  const [expanded, setExpanded] = useState(open)
  // Follow `open` during render (not in an effect): mount at once when opening,
  // start shrinking at once when closing.
  if (open && !mounted) setMounted(true)
  if (!open && expanded) setExpanded(false)

  useEffect(() => {
    if (open) {
      // Two frames: the closed (0fr) state has to paint before growing.
      let second
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setExpanded(true))
      })
      return () => {
        cancelAnimationFrame(first)
        cancelAnimationFrame(second)
      }
    }
    const timer = setTimeout(() => setMounted(false), reducedMotion() ? 0 : 320)
    return () => clearTimeout(timer)
  }, [open])

  if (!mounted) return null
  return (
    <div
      data-collapse
      inert={!open}
      style={{ gridTemplateRows: expanded ? "1fr" : "0fr", opacity: expanded ? 1 : 0 }}
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-out-smooth motion-reduce:transition-none"
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
