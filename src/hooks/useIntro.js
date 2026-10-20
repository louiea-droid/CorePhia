import { useEffect, useState } from "react"

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

// A prerendered page (scripts/prerender.mjs) is already on screen before the
// script runs, so the intro would hide it and fade it back in, and the
// headline would first paint long after the HTML arrived. Read once, while
// #root still holds that markup (modules run before main.jsx renders); App
// turns it off after its first render, so later navigations get the intro.
let startVisible =
  typeof document === "undefined" || Boolean(document.getElementById("root")?.hasChildNodes())
export const isPrerenderedStart = () => startVisible
export const endPrerenderedStart = () => {
  startVisible = false
}

/** Becomes true `delay`ms after mount, for choreographing a one-time page-load intro sequence. */
export function useIntro(delay = 0) {
  const [visible, setVisible] = useState(() => startVisible || prefersReducedMotion())

  useEffect(() => {
    if (visible) return
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay, visible])

  return visible
}
