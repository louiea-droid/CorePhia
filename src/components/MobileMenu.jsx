import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link, useLocation } from "react-router-dom"
import { ActivityArt, CareShieldArt, HealthCheckArt, MealPlateArt } from "./Artwork"
import { ArrowRightIcon, ChevronRightIcon, CloseIcon, PersonIcon } from "./icons"

const exploreLinks = [
  { label: "Home", to: "/" },
  { label: "Weight Loss", view: "weightLoss" },
  { label: "Membership", to: "/membership" },
  { label: "Success Stories", to: "/success-stories" },
  { label: "About Us", to: "/about" },
  { label: "Contact Us", to: "/contact" },
  { label: "FAQs", to: "/faq" },
]

const weightLossLinks = [
  { label: "Medical care", to: "/programs/medical-care" },
  { label: "Dietitian services", to: "/programs/dietitian-services" },
  { label: "Comprehensive Exercise Plan", to: "/programs/exercise-plan" },
  { label: "Follow-ups", to: "/programs/follow-ups" },
  { label: "Membership", to: "/membership" },
  { label: "Success Stories", to: "/success-stories" },
]

const topPrograms = [
// The illustrations are drawn for the blue program cards (their whites vanish
// on white), so each sits on a small brand tile, sized to read at one weight.
  { label: "Medical care", to: "/programs/medical-care", art: <CareShieldArt className="h-11" /> },
  { label: "Dietitian services", to: "/programs/dietitian-services", art: <MealPlateArt className="size-10" /> },
  { label: "Comprehensive Exercise Plan", to: "/programs/exercise-plan", art: <ActivityArt className="h-6 w-15" /> },
  { label: "Follow-ups", to: "/programs/follow-ups", art: <HealthCheckArt className="size-11" /> },
]

const rowClass =
  "flex w-full items-center justify-between rounded-xl px-2 py-4 -mx-2 text-lg font-medium text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"

// The "Start here" card from the client meeting, modelled on the Hims menu card.
// TODO: /start-here.webp is a free Unsplash placeholder. The client is
// supplying the real image; it needs a signed model release before launch.
function StartHereCard({ onClick }) {
  return (
    <Link
      to="/intake"
      onClick={onClick}
      className="group relative block aspect-video overflow-hidden rounded-3xl bg-[radial-gradient(90%_110%_at_62%_45%,var(--color-brand)_0%,var(--color-brand-dark)_50%,var(--color-ink-950)_100%)]"
    >
      {/* Fine grain over the glow, the same studio-backdrop texture as the
          Hims card. Inline SVG noise, so it costs no extra request. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-25 mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Drawn before the photo so the trend line runs behind the person.
          Pale line, saturated dots, as in the reference. */}
      <svg aria-hidden="true" viewBox="0 0 320 180" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path
          d="M0 78 C18 84 28 90 38 94 S78 114 96 122 S170 148 210 152 S270 158 320 156"
          fill="none"
          strokeWidth="1.5"
          className="stroke-paper-100/40"
        />
        <circle cx="38" cy="94" r="3.5" className="fill-accent" />
        <circle cx="96" cy="122" r="3.5" className="fill-accent" />
        <circle cx="288" cy="155" r="3.5" className="fill-accent" />
      </svg>
      {/* Transparent cutout, so it sits directly on the card colour. */}
      <img
        src="/start-here.webp"
        alt=""
        width="485"
        height="520"
        className="absolute bottom-0 left-[30%] h-[74%] w-auto"
      />
      <p className="relative p-6 text-xl leading-snug font-semibold text-paper-50">
        Ready to lose weight? <span className="block">Start here</span>
      </p>
      <span className="absolute bottom-5 left-5 flex size-10 items-center justify-center rounded-full bg-paper-50 text-ink-950 transition-colors duration-200 ease-out-smooth group-hover:bg-accent">
        <ArrowRightIcon className="size-5" />
      </span>
    </Link>
  )
}

export default function MobileMenu({ open, onClose, onAccountClick }) {
  const closeButtonRef = useRef(null)
  // "Home" is only offered away from the homepage; on it, the link goes nowhere.
  const onHome = useLocation().pathname === "/"
  const backButtonRef = useRef(null)
  const weightLossRowRef = useRef(null)
  const panelRef = useRef(null)
  // dir picks the slide direction; null on a fresh open so nothing animates.
  const [view, setView] = useState({ name: "main", dir: null })
  const [prevOpen, setPrevOpen] = useState(open)

  // Every open starts on the main view. Reset during render, not in an
  // effect, so the panel never paints the sub-view for a frame first.
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setView({ name: "main", dir: null })
  }

  useEffect(() => {
    if (!open) return

    closeButtonRef.current?.focus()
    document.body.style.overflow = "hidden"

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  // Keep keyboard focus on the view that just slid in: the back button going
  // forward, the row that opened it coming back.
  useEffect(() => {
    if (view.dir === "forward") backButtonRef.current?.focus()
    if (view.dir === "back") weightLossRowRef.current?.focus()
  }, [view])

  const accountButton = (
    <button
      type="button"
      aria-label="Patient portal"
      onClick={() => {
        onClose()
        onAccountClick?.()
      }}
    >
      <PersonIcon className="size-6" />
    </button>
  )

  const closeButton = (
    <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close menu">
      <CloseIcon className="size-6" />
    </button>
  )

  const slideClass = view.dir === "forward" ? "animate-view-forward" : view.dir === "back" ? "animate-view-back" : ""

  return createPortal(
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-ink-950/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute top-0 right-0 flex h-full w-full max-w-sm flex-col overflow-x-hidden overflow-y-auto rounded-l-3xl bg-paper-50 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {view.name === "weightLoss" ? (
          <div key="weightLoss" className={slideClass}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <button
                ref={backButtonRef}
                type="button"
                onClick={() => setView({ name: "main", dir: "back" })}
                aria-label="Back to menu"
                className="-ml-1 text-ink-950"
              >
                <ChevronRightIcon className="size-6 rotate-180" />
              </button>
              <div className="flex items-center gap-4 text-ink-950">
                {accountButton}
                {closeButton}
              </div>
            </div>

            <div className="px-6 pb-8">
              <h2 className="font-serif text-3xl text-ink-950">Weight Loss</h2>
              <div className="mt-5">
                <StartHereCard onClick={onClose} />
              </div>

              <p className="mt-8 text-xs font-semibold tracking-widest text-ink-950/70 uppercase">Explore</p>
              <ul className="mt-2 divide-y divide-ink-950/10">
                {weightLossLinks.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} onClick={onClose} className={rowClass}>
                      {item.label}
                      <ArrowRightIcon className="size-5 text-ink-950/50" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div key="main" className={slideClass}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="font-serif text-2xl text-ink-950">Menu</h2>
              <div className="flex items-center gap-4 text-ink-950">
                {accountButton}
                {closeButton}
              </div>
            </div>

            <div className="px-6">
              <p className="text-xs font-semibold tracking-widest text-ink-950/70 uppercase">Explore</p>
              <ul className="mt-2 divide-y divide-ink-950/10">
                {exploreLinks.filter((item) => !(onHome && item.to === "/")).map((item) => (
                  <li key={item.label}>
                    {item.view ? (
                      <button
                        ref={weightLossRowRef}
                        type="button"
                        onClick={() => setView({ name: item.view, dir: "forward" })}
                        className={rowClass}
                      >
                        {item.label}
                        <ChevronRightIcon className="size-5 text-ink-950/50" />
                      </button>
                    ) : (
                      <Link to={item.to} onClick={onClose} className={rowClass}>
                        {item.label}
                        <ChevronRightIcon className="size-5 text-ink-950/50" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-2 border-t border-ink-950/10 px-6 py-6">
              <p className="text-xs font-semibold tracking-widest text-ink-950/70 uppercase">What's included</p>
              {/* A 2x2 grid, so all four programs show at once and every tile is
                  the same height (it was a sideways scroller that clipped the
                  third tile and hid the fourth). */}
              <ul className="mt-4 grid auto-rows-fr grid-cols-2 gap-3">
                {topPrograms.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      onClick={onClose}
                      className="flex h-full flex-col items-center gap-3 rounded-2xl border border-ink-950/10 bg-white px-3 pt-4 pb-3.5 text-center transition-colors duration-200 ease-out-smooth hover:border-accent-dark/40 hover:bg-paper-100"
                    >
                      <span className="flex size-16 items-center justify-center rounded-2xl bg-linear-to-b from-brand to-brand-dark shadow-sm" aria-hidden="true">
                        {item.art}
                      </span>
                      <span className="text-sm leading-snug font-medium text-balance text-ink-950">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
