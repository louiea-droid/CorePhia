import { useOutletContext } from "react-router-dom"
import PortalProgress from "./PortalProgress"

// /account/progress: the full chart, logging, and every visit and weigh-in.
export default function ProgressPage() {
  const { link } = useOutletContext()
  return <PortalProgress intakeId={link.intakeId} />
}
