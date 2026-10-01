import { Link } from "react-router-dom"
import { useIntro } from "../hooks/useIntro"
import { MealPlateArt } from "./Artwork"
import {
  ChevronRightIcon,
  ClipboardCheckIcon,
  LeafIcon,
  PersonIcon,
  PillBottleIcon,
  StethoscopeIcon,
} from "./icons"

const included = [
   { label: "Medical care", detail: "Medication when a provider prescribes it", icon: PillBottleIcon },
  { label: "Dietitian services", detail: "A meal plan built around how you actually eat", icon: LeafIcon },
  { label: "Comprehensive Exercise Plan", detail: "Training matched to your level and your goal", icon: ClipboardCheckIcon },
 
]

// Each tile hovers to its own blue, bright to deep left to right. Every stop
// keeps white text at WCAG AA or better.
const quickLinks = [
  { label: "Explore our", highlight: "weight loss programs", icon: LeafIcon, href: "/#programs", fill: "from-accent-dark to-brand" },
  { label: "Learn about", highlight: "membership", icon: ClipboardCheckIcon, to: "/membership", fill: "from-brand to-brand-dark" },
  { label: "Read", highlight: "about our provider", icon: StethoscopeIcon, to: "/about", fill: "from-ink-700 to-ink-950" },
]

const trustPoints = [
  { label: "Physician Guided", icon: StethoscopeIcon },
  { label: "Evidence-Based", icon: ClipboardCheckIcon },
  { label: "Personalized Care", icon: PersonIcon },
  { label: "Sustainable Results", icon: LeafIcon },
]

export default function Hero() {
  const headlineIn = useIntro(350)
  const subheadIn = useIntro(520)
  const trustIn = useIntro(650)
  const cardsIn = useIntro(780)
  const quickLinksIn = useIntro(950)

  return (
    <section id="top" aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-24 -right-32 size-[32rem] rounded-full bg-accent/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6">
        <h1
          id="hero-heading"
          className={`font-serif text-5xl leading-[1.05] text-ink-950 transition-all duration-1000 ease-out-smooth sm:text-6xl ${
            headlineIn ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
          }`}
        >
          Weight loss built around you
        </h1>

        <ul
          className={`mt-6 flex flex-wrap gap-x-6 gap-y-3 transition-all duration-1000 ease-out-smooth ${
            trustIn ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          {trustPoints.map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-2 text-sm font-medium text-ink-950/70">
              <Icon className="size-5 text-accent-dark" />
              {label}
            </li>
          ))}
        </ul>

        <div
          className={`mt-8 grid gap-4 transition-all duration-1000 ease-out-smooth sm:grid-cols-2 ${
            cardsIn ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <Link
            to="/intake"
            className="group relative isolate flex min-h-64 flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 via-ink-900 to-accent-dark p-7 text-paper-100 shadow-lg transition-shadow duration-300 ease-out-smooth hover:shadow-2xl"
          >
            {/* Hover highlight, colour only (no movement, per Louie): a blue glow
                fades up from the plate's corner. Also on keyboard focus. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-radial-[at_85%_95%] from-accent/60 via-accent/15 via-45% to-transparent to-70% opacity-0 transition-opacity duration-500 ease-out-smooth group-hover:opacity-100 group-focus-visible:opacity-100"
            />

            {/* Declining area chart anchored to the left edge and the card
                floor, so it reads as a grounded backdrop rather than a line
                floating loose in the middle. It dives into the floor before
                the plate art's corner rather than running on to the right
                edge, which had the curve cutting across the plate's face.
                Scaled from bottom-left so those two anchors stay put. */}
            <svg
              viewBox="0 0 400 260"
              preserveAspectRatio="none"
              className={`pointer-events-none absolute inset-0 h-full w-full origin-bottom-left transition-transform duration-1000 ease-out-smooth motion-safe:group-hover:scale-105 ${
                cardsIn ? "scale-100" : "scale-110"
              }`}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="hero-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-paper-100)" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="var(--color-paper-100)" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path
                d="M0 145 C 35 138, 62 158, 96 156 S 150 130, 188 146 S 246 188, 280 212 S 320 250, 332 260 L0 260 Z"
                fill="url(#hero-trend-fill)"
              />
              <path
                d="M0 145 C 35 138, 62 158, 96 156 S 150 130, 188 146 S 246 188, 280 212 S 320 250, 332 260"
                fill="none"
                stroke="var(--color-paper-100)"
                strokeOpacity="0.3"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="relative z-10">
              <p className="font-serif text-2xl leading-snug">
                Start your
                <br />
                <span className="text-accent">weight loss program today</span>
              </p>
  
            </div>

            <div
              className={`pointer-events-none absolute -right-10 -bottom-8 opacity-90 transition-all duration-1000 ease-out-smooth motion-safe:group-hover:scale-105 ${
                cardsIn ? "scale-100" : "scale-110"
              }`}
              aria-hidden="true"
            >
              <MealPlateArt className="size-28 rotate-12 opacity-80 drop-shadow-2xl sm:size-40 sm:opacity-100" />
            </div>

            <span className="relative z-10 mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-300 ease-out-smooth group-hover:bg-paper-50 group-focus-visible:bg-paper-50">
              Get started
              <ChevronRightIcon className="size-4" />
            </span>
          </Link>

          <a
            href="/#programs"
            className="group flex min-h-64 flex-col justify-between rounded-3xl border border-ink-950/10 bg-paper-100 p-7 inset-shadow-[0_1px_0_rgb(255_255_255/0.85),0_0_60px_-12px_color-mix(in_oklab,var(--color-accent)_40%,transparent)] transition-shadow duration-300 ease-out-smooth hover:shadow-xl"
          >
            <div>
              <p className="text-xs font-semibold tracking-widest text-accent-dark uppercase">
                What's included
              </p>
              <ul className="mt-4 space-y-3">
                {included.map(({ label, detail, icon: Icon }) => (
                  <li key={label} className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper-200/70 text-accent-dark">
                      <Icon className="size-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink-950">{label}</span>
                      <span className="block text-xs text-ink-950/60">{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <span className="mt-5 flex items-center justify-between text-sm font-semibold text-ink-950">
              See the full program
              <ChevronRightIcon className="size-5" />
            </span>
          </a>
        </div>

        <ul
          className={`mt-4 grid gap-3 transition-all duration-1000 ease-out-smooth sm:grid-cols-3 ${
            quickLinksIn ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          {quickLinks.map(({ label, highlight, icon: Icon, href, to, fill }) => {
            const LinkTag = to ? Link : "a"
            const linkProps = to ? { to } : { href }
            return (
              <li key={label}>
                <LinkTag
                  {...linkProps}
                  className="group relative isolate flex items-center justify-between gap-3 overflow-hidden rounded-2xl bg-paper-100 py-4 pr-4 pl-5"
                >
                  {/* Hims-style hover: the tile fills with its own blue (a layer
                      that fades in, since gradients can't transition) and the
                      icon slowly zooms. Colour and zoom only, never movement
                      (no "shake"). Also on keyboard focus. */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-0 -z-10 bg-linear-to-br ${fill} opacity-0 transition-opacity duration-300 ease-out-smooth group-hover:opacity-100 group-focus-visible:opacity-100`}
                  />
                  <span className="text-base text-ink-950 transition-colors duration-300 ease-out-smooth group-hover:text-paper-50 group-focus-visible:text-paper-50">
                    {label}{" "}
                    {highlight && (
                      <span className="text-brand-dark transition-colors duration-300 ease-out-smooth group-hover:text-paper-50 group-focus-visible:text-paper-50">
                        {highlight}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-paper-200/70 transition-colors duration-300 ease-out-smooth group-hover:bg-paper-50/15 group-focus-visible:bg-paper-50/15">
                      <Icon className="size-6 text-ink-800 transition-[color,scale] duration-500 ease-out-smooth group-hover:text-paper-50 group-focus-visible:text-paper-50 motion-safe:group-hover:scale-115" />
                    </span>
                    <ChevronRightIcon className="size-4 text-ink-950/60 transition-colors duration-300 ease-out-smooth group-hover:text-paper-50 group-focus-visible:text-paper-50" />
                  </span>
                </LinkTag>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
