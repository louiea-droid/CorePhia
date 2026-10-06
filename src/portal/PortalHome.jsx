import { useOutletContext } from "react-router-dom"
import MessagesBox from "./messages/MessagesBox"
import PortalProgress from "./progress/PortalProgress"
import PortalUpdates from "./updates/PortalUpdates"

// The portal's Overview (/account): one short screen of headlines, each
// linking to its own page.
export default function PortalHome() {
  const { link } = useOutletContext()
  return (
    <>
      <PortalProgress intakeId={link.intakeId} compact />
      <MessagesBox intakeId={link.intakeId} />
      <PortalUpdates intakeId={link.intakeId} latestOnly />
    </>
  )
}
