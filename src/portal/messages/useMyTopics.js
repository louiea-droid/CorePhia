import { useEffect, useState } from "react"
import { byLatest } from "../../lib/messageMath"
import { getMyChartStatus, listenMyTopics } from "../lib/messageStore"

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

export function useCanWrite(intakeId) {
  const [canWrite, setCanWrite] = useState(true)
  useEffect(() => {
    let live = true
    getMyChartStatus(intakeId)
      .then((status) => live && setCanWrite(status === "active"))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [intakeId])
  return canWrite
}
