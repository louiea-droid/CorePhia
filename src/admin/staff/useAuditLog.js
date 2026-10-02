import { useEffect, useState } from "react"
import { loadAuditLog } from "../lib/firebase"

// No remove/mutate counterpart to the other hooks on purpose: the audit
// collection is append-only in firestore.rules, so there is nothing for a
// client to call.
export function useAuditLog() {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    loadAuditLog()
      .then((result) => active && setEntries(result))
      .catch((cause) => active && setError(cause.message))
    return () => {
      active = false
    }
  }, [])

  return { entries, error }
}
