import { useOutletContext } from "react-router-dom"
import { markUpdatesSeen } from "../lib/whatsNext"
import PortalUpdates from "./PortalUpdates"

// /account/updates: every update from the care team, newest first. Opening
// it clears the Overview's "posted an update" reminder on this device.
export default function UpdatesPage() {
  const { link } = useOutletContext()
  return (
    <>
      <h1 className="sr-only">Updates</h1>
      <PortalUpdates intakeId={link.intakeId} onLoad={markUpdatesSeen} />
    </>
  )
}
