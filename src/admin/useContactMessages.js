import { useEffect, useState } from "react"
import { deleteContactMessage, watchContactMessages } from "./firebase"

// enabled=false skips the subscription: a provider can't read messages (rules),
// so the sidebar badge mustn't open a listener that is only ever refused.
export function useContactMessages({ enabled = true } = {}) {
  const [messages, setMessages] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) return
    return watchContactMessages(setMessages, (cause) => setError(cause.message))
  }, [enabled])

  async function removeMessage(id) {
    await deleteContactMessage(id)
    // The listener's own next snapshot reflects the delete too, but updating
    // here avoids a flash of the deleted row while that round trip is in flight.
    setMessages((current) => current?.filter((message) => message.id !== id) ?? current)
  }

  return { messages, error, removeMessage }
}
