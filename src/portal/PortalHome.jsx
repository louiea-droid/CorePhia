import { useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { tampaParts } from "../admin/calendar/calendarMath"
import CareTeamCard from "./CareTeamCard"
import { listenMyVisits } from "./lib/visitStore"
import { seenUpdateId, whatsNext } from "./lib/whatsNext"
import MembershipCard from "./membership/MembershipCard"
import MessagesBox from "./messages/MessagesBox"
import PortalProgress from "./progress/PortalProgress"
import PortalUpdates from "./updates/PortalUpdates"
import WhatsNextCard from "./WhatsNextCard"

const ROUTES = {
  billing: "/account/membership",
  messages: "/account/messages",
  "message-us": "/account/messages",
  updates: "/account/updates",
  "log-weight": "/account/progress",
}

function greeting(now) {
  const hour = Math.floor(tampaParts(now).minutes / 60)
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

// The portal's Overview (/account): what's next with the progress numbers,
// then messages and membership, then the latest update.
export default function PortalHome() {
  const { link, chart, topics } = useOutletContext()
  const navigate = useNavigate()
  const [visits, setVisits] = useState(null)
  const [progress, setProgress] = useState(null)
  const [updates, setUpdates] = useState(null)
  useEffect(() => listenMyVisits(link.intakeId, setVisits), [link.intakeId])

  const now = new Date()
  const reminders =
    visits && progress && updates && topics
      ? whatsNext({ membership: chart.membership, chartStatus: chart.status, visits, topics, updates, lastSeenUpdateId: seenUpdateId(), progress, now })
      : null

  return (
    <>
      <header>
        <h1 className="font-serif text-3xl text-ink-950 sm:text-[34px] sm:tracking-[-0.01em]">
          {greeting(now)}
          {link.firstName ? `, ${link.firstName}` : ""}
        </h1>
        <p className="mt-1.5 text-ink-950/70">Here's where things stand with your program.</p>
      </header>
      <WhatsNextCard reminders={reminders} onAction={(action) => navigate(ROUTES[action])}>
        <PortalProgress intakeId={link.intakeId} compact onLoad={setProgress} />
      </WhatsNextCard>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <MessagesBox intakeId={link.intakeId} />
        <MembershipCard membership={chart.membership} />
      </div>
      <PortalUpdates intakeId={link.intakeId} latestOnly onLoad={setUpdates} />
      <CareTeamCard />
    </>
  )
}
