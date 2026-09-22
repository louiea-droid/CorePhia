import { Suspense, lazy, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useIntro } from "../hooks/useIntro"
import { hasPatientSessionHint, onPatientSessionHintChange } from "../lib/patientSessionHint"
import { MenuIcon } from "./icons"
import MobileMenu from "./MobileMenu"

// Lazy, and only mounted once someone actually opens it (see loginTouched
// below) — otherwise every visitor to the public site would download the
// Firebase Auth SDK this pulls in, the same reason AdminApp is lazy.
const LoginPanel = lazy(() => import("./LoginPanel"))

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginTouched, setLoginTouched] = useState(false)
  const [patientSignedIn, setPatientSignedIn] = useState(() => hasPatientSessionHint())
  const [dark, setDark] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const headerRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const barIn = useIntro(0)
  const navIn = useIntro(150)

  useEffect(() => onPatientSessionHintChange(setPatientSignedIn), [])

  const openLogin = () => {
    setLoginTouched(true)
    setLoginOpen(true)
  }

  // Shared by the header's account control and the mobile menu's account
  // icon: a signed-in patient goes straight to their account, everyone else
  // gets the login panel.
  const handleAccountClick = () => {
    if (patientSignedIn) navigate("/account")
    else openLogin()
  }

  useEffect(() => {
    let frame = null

    const updateTheme = () => {
      frame = null
      const header = headerRef.current
      if (!header) return
      const y = header.getBoundingClientRect().bottom + 1
      const el = document.elementFromPoint(window.innerWidth / 2, y)
      const themed = el?.closest("[data-header-theme]")
      setDark(themed?.getAttribute("data-header-theme") === "dark")
      setScrolled(window.scrollY > 4)
    }

    const onScroll = () => {
      if (frame == null) frame = requestAnimationFrame(updateTheme)
    }

    updateTheme()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame != null) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div
        className={`transition-[transform,opacity] duration-1000 ease-out-smooth ${
          barIn ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
        }`}
      >
        {/* Purely decorative: the header's rounded top corners reveal this
            strip through the curve. The header's -mt-4 overlap (16px) has to
            be at least its rounded-t-2xl radius (16px), or the strip runs out
            partway down the arc and the colour ends on a hard horizontal
            edge. Height is that overlap plus the 12px meant to stay visible. */}
        <div className="h-7 bg-accent-dark" aria-hidden="true" />
      </div>

      <header
        ref={headerRef}
        className={`sticky top-0 z-40 -mt-4 shadow-[0_-1px_0_rgba(16,32,43,0.05)] backdrop-blur transition-[transform,opacity,background-color,border-radius] duration-500 ease-out-smooth ${
          navIn ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
        } ${dark ? "bg-ink-950/90" : "bg-paper-50/95"} ${
          scrolled ? "rounded-t-none" : "rounded-t-2xl"
        }`}
      >
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between py-4 pr-2 pl-2 sm:pr-4 sm:pl-4"
          aria-label="Primary"
        >
          <Link
            to="/"
            className="shrink-0"
            onClick={(event) => {
              if (location.pathname === "/") {
                event.preventDefault()
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
            }}
          >
            <img
              src="/cp-health.webp"
              alt="CorePhia Health"
              className={`h-12 w-auto transition-[filter] duration-500 ease-out-smooth sm:h-14 ${
                dark ? "brightness-0 invert" : ""
              }`}
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/intake"
              className={`group relative isolate inline-flex items-center overflow-hidden rounded-full px-4 py-2 text-sm font-semibold outline-2 -outline-offset-1 transition-[transform,color,outline-color,box-shadow] duration-700 ease-out-smooth hover:scale-105 sm:px-5 ${
                dark
                  ? "text-paper-100 outline-paper-100/50 hover:text-ink-950 hover:outline-accent hover:shadow-xl hover:shadow-accent/30"
                  : "text-ink-950 outline-ink-950/70 hover:text-ink-950 hover:outline-accent hover:shadow-[0_0_32px_6px] hover:shadow-accent/50"
              }`}
            >
              {/* Outlined by default; a skewed panel wipes in from the left on
                  hover to fill it solid, rather than the shine-sweep this
                  replaced. Same mechanic as the reference snippet (an
                  absolutely-positioned ::before skewed and widened on hover),
                  reimplemented as a sibling span in the site's own tokens and
                  pill shape rather than the source's teal/5px-radius look,
                  which would have clashed with every other button on the site.
                  The text/outline/shadow transition above shares this same
                  700ms duration rather than Tailwind's shorter default — they
                  used to drift out of sync, so the text flipped white before
                  the fill caught up to it, showing pale text on a still-light
                  background for part of the hover. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-[-10%] -z-10 w-0 -skew-x-12 bg-accent transition-[width] duration-700 ease-out-smooth group-hover:w-[220%]"
              />
              Get started
            </Link>
            {patientSignedIn ? (
              <Link
                to="/account"
                className={`hidden text-sm font-medium underline-offset-4 transition-colors duration-200 ease-out-smooth hover:underline sm:inline-block ${
                  dark ? "text-paper-100/80 hover:text-paper-100" : "text-ink-950/70 hover:text-ink-950"
                }`}
              >
                My account
              </Link>
            ) : (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={loginOpen}
                onClick={openLogin}
                className={`hidden text-sm font-medium underline-offset-4 transition-colors duration-200 ease-out-smooth hover:underline sm:inline-block ${
                  dark ? "text-paper-100/80 hover:text-paper-100" : "text-ink-950/70 hover:text-ink-950"
                }`}
              >
                Log in
              </button>
            )}
            <button
              type="button"
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className={`rounded-full border p-2 transition-colors duration-200 ease-out-smooth ${
                dark
                  ? "border-paper-100/20 text-paper-100 hover:border-paper-100/40 hover:bg-paper-100/10"
                  : "border-ink-950/15 text-ink-950 hover:border-ink-950/40 hover:bg-ink-950/5"
              }`}
            >
              <MenuIcon className="size-5" />
            </button>
          </div>
        </nav>

        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onAccountClick={handleAccountClick} />
      </header>

      {loginTouched && (
        <Suspense fallback={null}>
          <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
