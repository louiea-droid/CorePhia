import { BadgeCheckIcon, MailIcon, PhoneIcon } from "../components/icons"
import { SUPPORT_PHONE } from "../lib/siteContact"
import { signOutPatient } from "./lib/patientAuth"
import MessagesBox from "./messages/MessagesBox"
import PortalProgress from "./progress/PortalProgress"
import PortalUpdates from "./updates/PortalUpdates"

// Sections still being built, one by one (Louie, 2026-10-06). When one
// ships, take it off this list and give it its own panel on the page.
const COMING_SOON = [
  { Icon: BadgeCheckIcon, title: "Membership", line: "Your plan and what it includes." },
]

const sideCard = "rounded-3xl border border-ink-950/10 bg-white p-6"

// The portal's home page for a linked patient (PortalApp handles signing in).
export default function PortalHome({ user, link }) {
  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="font-serif text-4xl text-ink-950">
            {link.firstName ? `Welcome back, ${link.firstName}` : "Welcome back"}
          </h1>
          <p className="mt-2 text-ink-950/70">Here's what your care team has shared with you.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="break-all text-ink-950/60">Signed in as {user.email}</span>
          <button
            type="button"
            onClick={() => signOutPatient()}
            className="cursor-pointer font-semibold whitespace-nowrap text-ink-950 underline-offset-4 transition-colors duration-200 hover:text-accent-dark hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <PortalProgress intakeId={link.intakeId} />
          <PortalUpdates intakeId={link.intakeId} />
          <MessagesBox intakeId={link.intakeId} />
        </div>

        <aside className="space-y-6">
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
