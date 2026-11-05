import { MailIcon, PhoneIcon } from "../components/icons"
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "../lib/siteContact"

const card = "rounded-[20px] border border-ink-950/10 bg-white p-5 sm:rounded-[22px] sm:p-6"
const rowLink =
  "-mx-2 flex min-h-11 items-center justify-start gap-3 rounded-xl px-2 py-2 font-medium text-ink-950 transition-colors duration-200 hover:bg-paper-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"

// How to reach the care team: on the Overview and the Account page.
export default function CareTeamCard() {
  return (
    <section aria-labelledby="care-team-heading" className={card}>
      <h2 id="care-team-heading" className="font-serif text-xl text-ink-950">
        Your care team
      </h2>
      <p className="mt-1 text-sm text-ink-950/70">Questions about your care? Call or email us.</p>
      <ul className="mt-3 space-y-1 text-sm">
        <li>
          <a href={SUPPORT_PHONE_HREF} className={rowLink}>
            <PhoneIcon className="size-4 shrink-0 text-accent-dark" aria-hidden="true" />
            {SUPPORT_PHONE}
          </a>
        </li>
        <li>
          <a href="mailto:info@corephia.com" className={`${rowLink} break-all`}>
            <MailIcon className="size-4 shrink-0 text-accent-dark" aria-hidden="true" />
            info@corephia.com
          </a>
        </li>
      </ul>
    </section>
  )
}
