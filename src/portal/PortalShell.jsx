import { Link, NavLink } from "react-router-dom"
import { signOutPatient } from "./lib/patientAuth"

// Icons drawn like the approved mockup (24px grid, 1.7 stroke).
const ICONS = {
  overview: <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" />,
  progress: (
    <>
      <path d="M3 17l5-5 4 4 8-9" />
      <path d="M15 7h5v5" />
    </>
  ),
  messages: <path d="M4 5h16v11H8l-4 4z" />,
  updates: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 12h7M9 16h5" />
    </>
  ),
  membership: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
}

function Icon({ name, className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {ICONS[name]}
    </svg>
  )
}

// Sidebar on computers; the tab bar swaps Membership for Account (where
// Membership, sign-out and the legal links live on phones).
const SIDE_ITEMS = [
  ["/account", "Overview", "overview"],
  ["/account/progress", "Progress", "progress"],
  ["/account/messages", "Messages", "messages"],
  ["/account/updates", "Updates", "updates"],
  ["/account/membership", "Membership", "membership"],
]
const TAB_ITEMS = [...SIDE_ITEMS.slice(0, 4), ["/account/account", "Account", "account"]]

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
const footLink = `block rounded-lg px-2 py-1.5 text-sm text-ink-950/75 transition-colors duration-200 hover:bg-paper-100 hover:text-ink-950 ${focusRing}`

function Logo() {
  return (
    <p className="flex items-center gap-2 text-[17px] font-semibold text-ink-950">
      <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true" className="shrink-0">
        <path
          d="M7 8c0-3 2-5 4.5-5S16 8 16 8s2 5 4.5 5S25 11 25 8s-2-5-4.5-5S16 8 16 8s-2 5-4.5 5S7 11 7 8z"
          fill="none"
          stroke="#3b5bdb"
          strokeWidth="2.2"
        />
      </svg>
      CorePhia <span className="font-medium text-brand">Portal</span>
    </p>
  )
}

function initialOf(user, link) {
  return (link?.firstName || user?.email || "?").charAt(0).toUpperCase()
}

function Avatar({ user, link, className = "size-[34px] text-[13px]" }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-paper-100 font-semibold text-brand ${className}`}>
      {initialOf(user, link)}
    </span>
  )
}

// Who is signed in, the way back to the website, the legal pages and
// Sign out: the sidebar's foot, and below the page on phones when there is
// no tab bar (and so no Account tab).
function Foot({ user, link }) {
  return (
    <div className="border-t border-ink-950/10 pt-4">
      {user && (
        <div className="flex items-center gap-2.5 px-2 pb-3.5">
          <Avatar user={user} link={link} />
          <div className="min-w-0">
            {link?.firstName && <p className="truncate text-sm font-semibold text-ink-950">{link.firstName}</p>}
            <p className="truncate text-xs text-ink-950/65" title={user.email}>
              {user.email}
            </p>
          </div>
        </div>
      )}
      <Link to="/" className={footLink}>
        Back to corephia.com
      </Link>
      <Link to="/privacy" className={footLink}>
        Privacy policy
      </Link>
      <Link to="/terms" className={footLink}>
        Terms
      </Link>
      {user && (
        <button type="button" onClick={() => signOutPatient()} className={`w-full cursor-pointer text-left ${footLink}`}>
          Sign out
        </button>
      )}
    </div>
  )
}

// The patient portal's own frame (no website header, footer or cookie
// banner). nav=false is for screens before the portal opens (signed out,
// setup, reset, before payment, closed, errors): no section links.
export default function PortalShell({ user, link, nav = true, newReplies = 0, children }) {
  return (
    <div className="min-h-dvh bg-paper-50 lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="hidden border-r border-ink-950/10 bg-white px-4 py-[22px] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto">
        <div className="px-2 pb-[26px]">
          <Logo />
        </div>
        {nav && (
          <nav aria-label="Portal">
            <ul className="space-y-0.5">
              {SIDE_ITEMS.map(([to, label, icon]) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === "/account"}
                    className={({ isActive }) =>
                      `flex items-center gap-[11px] rounded-xl px-3 py-2.5 text-[14.5px] transition-colors duration-200 ${focusRing} ${
                        isActive ? "bg-paper-100 font-semibold text-ink-950" : "text-ink-950/75 hover:bg-paper-50 hover:text-ink-950"
                      }`
                    }
                  >
                    <Icon name={icon} className="size-[19px]" />
                    {label}
                    {icon === "messages" && newReplies > 0 && (
                      <span className="ml-auto rounded-full bg-accent-dark px-[7px] py-px text-[11px] font-semibold text-paper-50">
                        {newReplies}
                        <span className="sr-only"> new</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="mt-auto pt-6">
          <Foot user={user} link={link} />
        </div>
      </aside>

      <header className="flex items-center justify-between gap-3 px-[18px] pt-[18px] pb-1.5 lg:hidden">
        <Logo />
        {user &&
          (nav ? (
            <Link to="/account/account" aria-label="Account" className={`rounded-full ${focusRing}`}>
              <Avatar user={user} link={link} className="size-[30px] text-xs" />
            </Link>
          ) : (
            <Avatar user={user} link={link} className="size-[30px] text-xs" />
          ))}
      </header>

      <main
        className={`min-w-0 px-4 pt-2 sm:px-6 lg:px-10 lg:pt-[34px] lg:pb-10 ${
          nav ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-10"
        }`}
      >
        <div className="mx-auto w-full max-w-5xl">{children}</div>
        {!nav && (
          <div className="mx-auto mt-10 max-w-5xl lg:hidden">
            <Foot user={user} link={link} />
          </div>
        )}
      </main>

      {nav && (
        <nav
          aria-label="Portal"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-950/10 bg-white px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
        >
          <ul className="grid grid-cols-5">
            {TAB_ITEMS.map(([to, label, icon]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/account"}
                  className={({ isActive }) =>
                    `relative flex min-h-11 flex-col items-center gap-1 rounded-lg py-1 text-[11px] transition-colors duration-200 ${focusRing} ${
                      isActive ? "font-semibold text-accent-dark" : "text-ink-950/65 hover:text-ink-950"
                    }`
                  }
                >
                  <span className="relative">
                    <Icon name={icon} className="size-[22px]" />
                    {icon === "messages" && newReplies > 0 && (
                      <span aria-hidden="true" className="absolute -top-0.5 -right-1 size-2 rounded-full bg-accent-dark" />
                    )}
                  </span>
                  {label}
                  {icon === "messages" && newReplies > 0 && <span className="sr-only">, {newReplies} new</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
