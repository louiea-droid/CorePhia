import { useEffect, useRef, useState } from "react"
import { ActivityArt } from "./Artwork"
import { useReveal } from "../hooks/useReveal"

// useReveal is deliberately one-shot, which left the needle's drop playing
// while the section was still scrolling into place and finished before anyone
// was looking at it. This one tracks visibility both ways, so leaving and
// returning re-arms the card and its gauge together.
function useReplayOnView() {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.3,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, inView]
}

function DoseGauge({ dose = "7.2 mg", active }) {
  const ticks = Array.from({ length: 13 })
  const cx = 100
  const cy = 88
  const rInner = 62
  const rOuter = 82

  const trackPath = Array.from({ length: 49 })
    .map((_, i) => {
      const angle = 180 - (i / 48) * 180
      const rad = (angle * Math.PI) / 180
      const x = cx + rOuter * Math.cos(rad)
      const y = cy - rOuter * Math.sin(rad)
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 200 100" className="w-44" aria-hidden="true">
        <path d={trackPath} fill="none" stroke="#24365f" strokeWidth="1.5" strokeOpacity="0.6" />
        {ticks.map((_, i) => {
          const angle = 180 - (i / (ticks.length - 1)) * 180
          const rad = (angle * Math.PI) / 180
          const x1 = cx + rInner * Math.cos(rad)
          const y1 = cy - rInner * Math.sin(rad)
          const x2 = cx + rOuter * Math.cos(rad)
          const y2 = cy - rOuter * Math.sin(rad)
          const isMid = i === Math.floor(ticks.length / 2)
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isMid ? "#60a5fa" : "#2a3f66"}
              strokeWidth={isMid ? 3 : 1.5}
              strokeLinecap="round"
              style={
                active ? { animation: `tick-fade 0.35s ease-out ${i * 0.03}s both` } : { opacity: 0 }
              }
            />
          )
        })}
        {/* Drawn before the hub so the hub caps its base. The needle rests at
            rotate(0) — straight up, on the highlighted tick — so the keyframes
            can express the drop as offsets from the reading itself. */}
        <path
          d={`M ${cx - 1.7} ${cy} L ${cx} ${cy - rOuter + 8} L ${cx + 1.7} ${cy} Z`}
          fill="var(--color-accent)"
          className={active ? "animate-needle-drop" : ""}
          style={active ? undefined : { opacity: 0 }}
        />
        <circle cx={cx} cy={cy} r="4.5" fill="var(--color-accent)" />
        <circle cx={cx} cy={cy} r="1.8" fill="#1b2a4d" />
      </svg>
      <p className="mt-1 text-sm font-medium text-paper-100">{dose}</p>
    </div>
  )
}

export default function ScienceSection() {
  const [absorptionRef, absorptionVisible] = useReveal()
  // The results card drives its own gauge, so the card's entrance and the
  // needle's drop start on the same frame and replay together.
  const [doseRef, doseVisible] = useReplayOnView()
  const magnetRef = useRef(null)

  // Written straight to style rather than through state so pointer movement
  // doesn't re-render the section on every mousemove. It also has to live on
  // a wrapper, not on the art itself: animate-sphere-drift already animates
  // that element's transform, and a running animation outranks inline styles.
  const pullTowardCursor = (event) => {
    const el = magnetRef.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const rect = el.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `translate(${x * 24}px, ${y * 16}px) scale(1.12)`
  }

  const releaseCursor = () => {
    if (magnetRef.current) magnetRef.current.style.transform = ""
  }

  return (
    <section
      id="science"
      aria-labelledby="science-heading"
      data-header-theme="dark"
      className="bg-ink-950 py-12 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 id="science-heading" className="sr-only">
          How Corephia's weight loss programs work
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <div
            ref={absorptionRef}
            className={`flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-ink-700 via-ink-800 to-ink-900 p-6 shadow-lg transition-[transform,box-shadow,opacity] duration-700 ease-out-smooth hover:-translate-y-1 hover:shadow-2xl sm:p-8 ${
              absorptionVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            <p className="font-serif text-2xl leading-tight text-paper-100 sm:text-3xl">
              A program built on
              <br />
              <span className="text-accent">real, sustainable habits</span>
            </p>

            <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row sm:justify-between sm:gap-8">
              <p
                className={`max-w-64 text-center text-sm text-paper-100/70 transition-all delay-150 duration-700 ease-out-smooth sm:max-w-32 sm:text-right ${
                  absorptionVisible ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
                }`}
              >
                Builds habits through <span className="text-paper-100">personalized nutrition coaching</span>
              </p>
              <div
                ref={magnetRef}
                onMouseMove={pullTowardCursor}
                onMouseLeave={releaseCursor}
                className="shrink-0 transition-transform duration-300 ease-out-smooth"
              >
                <ActivityArt
                  className={`h-20 w-48 transition-all delay-300 duration-700 ease-out-smooth ${
                    absorptionVisible ? "scale-100 animate-sphere-drift opacity-100" : "scale-75 opacity-0"
                  }`}
                />
              </div>
              <p
                className={`max-w-64 text-center text-sm text-paper-100/70 transition-all delay-450 duration-700 ease-out-smooth sm:max-w-32 sm:text-left ${
                  absorptionVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                }`}
              >
                Combines <span className="text-paper-100">structured exercise with medical support</span>
              </p>
            </div>
          </div>

          <div
            ref={doseRef}
            className={`flex flex-col items-center rounded-3xl bg-gradient-to-bl from-ink-700 via-ink-800 to-ink-900 p-6 text-center shadow-lg transition-[transform,box-shadow,opacity] duration-700 ease-out-smooth hover:-translate-y-1 hover:shadow-2xl sm:p-8 ${
              doseVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            <span className="animate-soft-pulse rounded-full border border-accent/40 px-3 py-1 text-xs font-semibold text-accent">
              Real member results
            </span>
            <p className="mt-3 font-serif text-2xl leading-tight text-paper-100 sm:text-3xl">
              Members lose up to 20% body weight*
            </p>

            <div className="mt-6">
              <DoseGauge dose="20%" active={doseVisible} />
            </div>

            <a
              href="/#programs"
              className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-ink-950 transition-[transform,background-color] duration-200 ease-out-smooth hover:scale-105 hover:bg-accent-dark"
            >
              Explore our programs
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-paper-100/40">
          *Based on program outcomes combining nutrition, exercise, and medication when prescribed. Individual
          results vary.
        </p>
      </div>
    </section>
  )
}
