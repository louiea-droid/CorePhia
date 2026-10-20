import { useEffect, useRef, useState } from "react"
import { isPrerenderedStart } from "./useIntro"

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Tracks whether an element has scrolled into view, for one-time scroll-reveal
 * animations (styled by the `data-reveal` rule in index.css).
 *
 * Fires as soon as the element's top edge clears the bottom 8% of the
 * viewport, so it is already moving when the eye gets there. The old 30%
 * threshold made people scroll into an empty gap first. Elements already
 * above the viewport (a #hash jump, or back-navigation restoring scroll)
 * reveal immediately instead of staying hidden forever.
 *
 * `eager` is for above-the-fold content (a page's hero): like useIntro, it
 * starts shown in the prerendered HTML and on the first render over it.
 */
export function useReveal(eager = false) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => (eager && isPrerenderedStart()) || prefersReducedMotion())

  useEffect(() => {
    if (visible) return

    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  return [ref, visible]
}
