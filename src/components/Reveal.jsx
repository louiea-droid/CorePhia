import { useReveal } from "../hooks/useReveal"

/** Wraps content in a one-time scroll reveal. `index` staggers siblings in a
    row (desktop only, see the data-reveal rule in index.css). `eager` for a
    page's hero, so it is on screen in the prerendered HTML. */
export default function Reveal({ as: Tag = "div", index = 0, eager = false, className, children }) {
  const [ref, visible] = useReveal(eager)
  return (
    <Tag
      ref={ref}
      data-reveal={visible ? "shown" : "hidden"}
      style={{ "--reveal-i": index }}
      className={className}
    >
      {children}
    </Tag>
  )
}
