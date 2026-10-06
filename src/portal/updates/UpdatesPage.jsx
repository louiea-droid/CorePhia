import { useOutletContext } from "react-router-dom"
import PortalUpdates from "./PortalUpdates"

// /account/updates: every update from the care team, newest first.
export default function UpdatesPage() {
  const { link } = useOutletContext()
  return <PortalUpdates intakeId={link.intakeId} />
}
