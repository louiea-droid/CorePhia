import { useOutletContext } from "react-router-dom"
import MembershipCard from "./MembershipCard"

// /account/membership: the plan, the next billing or end date, and Manage
// billing. On phones it is reached from the Account tab.
export default function MembershipPage() {
  const { chart } = useOutletContext()
  return <MembershipCard membership={chart.membership} Heading="h1" />
}
