import { useEffect, useState } from "react"
import { listenTopics } from "./topicStore"

// Every patient topic, live. The sidebar count and the Messages page each
// hold one listener.
export function useTopics({ enabled = true } = {}) {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!enabled) return
    return listenTopics(
      (next) => {
        setTopics(next)
        setError(null)
      },
      (cause) => {
        console.error("Could not load messages:", cause.code ?? cause.message)
        setError(cause.message ?? "error")
      },
    )
  }, [enabled])
  return { topics, error }
}
