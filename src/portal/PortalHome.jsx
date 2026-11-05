import { useOutletContext } from "react-router-dom"
import { CareTeamCard } from "./AccountPage"
import MembershipCard from "./membership/MembershipCard"
import MessagesBox from "./messages/MessagesBox"
import PortalProgress from "./progress/PortalProgress"
import PortalUpdates from "./updates/PortalUpdates"

// The portal's Overview (/account): one short screen of headlines, each
// linking to its own page.
export default function PortalHome() {
  const { link, chart } = useOutletContext()
  return (
    <>
      <header>
        <h1 className="font-serif text-3xl text-ink-950 sm:text-4xl">
          {link.firstName ? `Welcome back, ${link.firstName}` : "Welcome back"}
        </h1>
        <p className="mt-2 text-ink-950/70">Here's what your care team has shared with you.</p>
      </header>
      <MembershipCard membership={chart.membership} />
      <PortalProgress intakeId={link.intakeId} compact />
      <MessagesBox intakeId={link.intakeId} />
      <PortalUpdates intakeId={link.intakeId} latestOnly />
      <CareTeamCard />
    </>
  )
}
