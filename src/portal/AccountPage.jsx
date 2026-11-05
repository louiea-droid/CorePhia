import { Link, useOutletContext } from "react-router-dom"
import { ChevronRightIcon } from "../components/icons"
import CareTeamCard from "./CareTeamCard"
import { signOutPatient } from "./lib/patientAuth"

const card = "rounded-[20px] border border-ink-950/10 bg-white p-5 sm:rounded-[22px] sm:p-6"
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
const rowLink = `-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-2 font-medium text-ink-950 transition-colors duration-200 hover:bg-paper-100 ${focusRing}`

// /account/account: the Account tab on phones (the sidebar holds the same on
// computers): who is signed in, the membership, the legal pages, Sign out.
export default function AccountPage() {
  const { user, link, chart } = useOutletContext()
  return (
    <>
      <h1 className="font-serif text-3xl text-ink-950">Account</h1>

      <section aria-label="Signed in as" className={card}>
        {link.firstName && <p className="text-lg font-medium text-ink-950">{link.firstName}</p>}
        <p className="text-sm break-all text-ink-950/70">{user.email}</p>
      </section>

      <section aria-labelledby="account-membership-heading" className={card}>
        <h2 id="account-membership-heading" className="font-serif text-xl text-ink-950">
          Membership
        </h2>
        <Link to="/account/membership" className={`mt-2 ${rowLink}`}>
          <span>{chart.membership.plan}</span>
          <span className="flex items-center gap-1 text-sm font-semibold text-accent-dark">
            Billing
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </span>
        </Link>
      </section>

      <CareTeamCard />

      <nav aria-label="More" className={card}>
        <ul className="text-sm">
          <li>
            <Link to="/" className={rowLink}>
              Back to corephia.com
            </Link>
          </li>
          <li>
            <Link to="/privacy" className={rowLink}>
              Privacy policy
            </Link>
          </li>
          <li>
            <Link to="/terms" className={rowLink}>
              Terms
            </Link>
          </li>
        </ul>
        <button
          type="button"
          onClick={() => signOutPatient()}
          className={`mt-4 cursor-pointer rounded-full border border-ink-950/15 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors duration-200 hover:bg-paper-100 ${focusRing}`}
        >
          Sign out
        </button>
      </nav>
    </>
  )
}
