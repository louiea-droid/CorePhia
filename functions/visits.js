// The patient's copy of an appointment (patients/{chartId}/visits/{id}),
// which the portal reads. appointments/{id} holds staff-only data (the note,
// the patient's and staff member's names, who booked it), so the copy is built
// from an allowlist: these five fields and nothing else.
export function visitFromAppointment(appointment, staffRole) {
  if (!appointment) return null
  const { start, minutes, discipline, status } = appointment
  return { start, minutes, discipline, staffRole: staffRole ?? null, status }
}
