import { NavLink, Outlet } from "react-router-dom"
import { BadgeCheckIcon, MailIcon, PhoneIcon } from "../components/icons"
import { unreadFor } from "../lib/messageMath"
import { SUPPORT_PHONE } from "../lib/siteContact"
import { signOutPatient } from "./lib/patientAuth"
import { useMyTopics } from "./messages/useMyTopics"

// Sections still being built, one by one (Louie, 2026-10-06). When one ships,
// take it off this list and give it a tab.
const COMING_SOON = [{ Icon: BadgeCheckIcon, title: "Membership", line: "Your plan and what it includes." }]

const TABS = [
  ["/account", "Overview"],
  ["/account/progress", "Progress"],
  ["/account/messages", "Messages"],
  ["/account/updates", "Updates"],
]

const sideCard = "rounded-3xl border border-ink-950/10 bg-white p-6"

// Every portal page for a linked patient: the welcome, the tabs, the page
// itself, and the side column (account, care team, coming soon), which stays
// in view while the page scrolls on desktop. Pages read { user, link } from
// the outlet context.
export default function PortalLayout({ user, link }) {
  const { topics } = useMyTopics(link.intakeId)
  const newReplies = topics?.filter((topic) => unreadFor(topic, "patient")).length ?? 0

  return (
    <div>
      <header>
        <h1 className="font-serif text-4xl text-ink-950">{link.firstName ? `Welcome back, ${link.firstName}` : "Welcome back"}</h1>
        <p className="mt-2 text-ink-950/70">Here's what your care team has shared with you.</p>
      </header>

      <nav aria-label="Portal" className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1 border-b border-ink-950/10 whitespace-nowrap">
          {TABS.map(([to, label]) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/account"}
                className={({ isActive }) =>
                  `-mb-px inline-block border-b-2 px-4 py-3 text-sm font-semibold transition-colors duration-200 ${
                    isActive ? "border-accent-dark text-ink-950" : "border-transparent text-ink-950/60 hover:text-ink-950"
                  }`
                }
              >
                {label}
                {label === "Messages" && newReplies > 0 && (
                  <>
                    {" "}
                    <span className="ml-1 rounded-full bg-accent-dark px-1.5 py-0.5 text-xs font-semibold text-paper-50">{newReplies}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div data-portal-main className="min-w-0 space-y-6">
          <Outlet context={{ user, link }} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <section aria-labelledby="account-heading" className={sideCard}>
            <h2 id="account-heading" className="font-serif text-xl text-ink-950">
              Your account
            </h2>
            <p className="mt-1 text-sm break-all text-ink-950/70">Signed in as {user.email}</p>
            <button
              type="button"
              onClick={() => signOutPatient()}
              className="mt-4 cursor-pointer rounded-full border border-ink-950/15 px-5 py-2 text-sm font-semibold text-ink-950 transition-colors duration-200 hover:bg-paper-100"
            >
              Sign out
            </button>
          </section>

          <section aria-labelledby="care-team-heading" className={sideCard}>
            <h2 id="care-team-heading" className="font-serif text-xl text-ink-950">
              Your care team
            </h2>
            <p className="mt-1 text-sm text-ink-950/70">Questions about your care? Call or email us.</p>
            <ul className="mt-4 space-y-1 text-sm">
              <li>
                <a
                  href={`tel:${SUPPORT_PHONE.replace(/\D/g, "")}`}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 font-medium text-ink-950 transition-colors duration-200 hover:bg-paper-100"
                >
                  <PhoneIcon className="size-4 shrink-0 text-accent-dark" aria-hidden="true" />
                  {SUPPORT_PHONE}
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@corephia.com"
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 font-medium break-all text-ink-950 transition-colors duration-200 hover:bg-paper-100"
                >
                  <MailIcon className="size-4 shrink-0 text-accent-dark" aria-hidden="true" />
                  info@corephia.com
                </a>
              </li>
            </ul>
          </section>

          <section aria-labelledby="coming-heading" className={sideCard}>
            <h2 id="coming-heading" className="font-serif text-xl text-ink-950">
              Coming to your portal
            </h2>
            <ul className="mt-4 space-y-4">
              {COMING_SOON.map(({ Icon, title, line }) => (
                <li key={title} className="flex gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-ink-950/40" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-ink-950/80">{title}</p>
                    <p className="text-sm leading-relaxed text-ink-950/60">{line}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
