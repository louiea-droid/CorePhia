import { useEffect, useState } from "react"
import { byLatest } from "../../lib/messageMath"
import { listenMyChartStatus, listenMyTopics } from "../lib/messageStore"

// The patient's conversations, live, newest activity first.
export function useMyTopics(intakeId) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ topics: null, failed: false })
  useEffect(
    () =>
      listenMyTopics(
        intakeId,
        (topics) => setState({ topics: [...topics].sort(byLatest), failed: false }),
        (cause) => {
          console.error("Could not load messages:", cause.code ?? cause.message)
          setState({ topics: null, failed: true })
        },
      ),
    [intakeId, attempt],
  )
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}

// true / false once the chart's status is known, null until then, so an
// inactive account never sees the compose box flash up first. Live.
export function useCanWrite(intakeId) {
  const [canWrite, setCanWrite] = useState(null)
  useEffect(() => listenMyChartStatus(intakeId, (status) => setCanWrite(status === "active")), [intakeId])
  return canWrite
}
