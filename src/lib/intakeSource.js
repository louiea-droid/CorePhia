// The ad tag in an intake link (/intake?src=ig), saved as visit.source so the
// admin can see which link brought each applicant. Same shape as the check in
// firestore.rules: lowercase letters, digits, - and _, at most 40. Anything
// else is dropped rather than repaired.
export const cleanSource = (raw) => {
  const tag = (raw ?? "").toLowerCase()
  return /^[a-z0-9_-]{1,40}$/.test(tag) ? tag : ""
}
