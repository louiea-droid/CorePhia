import { useEffect, useState } from "react"
import { deleteIntakeRecord, loadIntakeRecords, updateIntakeRecord } from "./firebase"

// Shared by Dashboard and Patients so each owns its own fetch rather than
// threading records through a context — fine at this scale (a two-person
// admin team, well under a thousand records); revisit if that changes.
export function useIntakeRecords() {
  const [records, setRecords] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    loadIntakeRecords()
      .then((result) => active && setRecords(result))
      .catch((cause) => active && setError(cause.message))
    return () => {
      active = false
    }
  }, [])

  // Drops the record from local state only after Firestore confirms the
  // delete, so a permission-denied (not superAdmin, or rules not yet
  // deployed) leaves the table showing exactly what still exists.
  async function removeRecord(id) {
    await deleteIntakeRecord(id)
    setRecords((current) => current?.filter((record) => record.id !== id) ?? current)
  }

  // Same confirm-then-reflect order as removeRecord: local state only moves
  // once Firestore has actually accepted the write.
  async function patchRecord(id, patch) {
    await updateIntakeRecord(id, patch)
    setRecords((current) => current?.map((record) => (record.id === id ? { ...record, ...patch } : record)) ?? current)
  }

  return { records, error, removeRecord, patchRecord }
}
