// Patient portal invites: every read and write for them goes through here.
// firestore.rules is the real boundary (the invites block). Demo mode keeps invites in memory and,
// without EmailJS keys, pretends the email went out.
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { newInviteId, retryOnce } from "../../lib/inviteMath"
import { db, usingSeedData } from "../lib/firebase"
import { emailjsConfigured, sendEmail } from "../../lib/emailjs"
import { PATIENTS_COLLECTION, getDemoStore } from "./chartStore"

const INVITES = "invites"

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

const demoInvites = async (chartId) => {
  const store = await getDemoStore()
  store.invites ??= new Map()
  if (!store.invites.has(chartId)) store.invites.set(chartId, [])
  return store.invites.get(chartId)
}

// The chart's invites (newest first), whether a patient login is linked, and
// when it was linked (null for a link made by hand without linkedAt).
export async function loadPortalAccess(chartId) {
  if (usingSeedData) return { invites: [...(await demoInvites(chartId))], linked: false, linkedAt: null }
  const database = requireDb()
  const [invites, links] = await Promise.all([
    getDocs(query(collection(database, PATIENTS_COLLECTION, chartId, INVITES), orderBy("createdAt", "desc"))),
    getDocs(query(collection(database, "patientAccounts"), where("intakeId", "==", chartId), limit(1))),
  ])
  return {
    invites: invites.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    linked: !links.empty,
    linkedAt: links.docs[0]?.data().linkedAt ?? null,
  }
}

// Saves the invite, emails it, and records how that went. Resolves with the
// final invite (sent, failed, or unrecorded: emailed but its status didn't save);
// throws only if the first save fails.
export async function sendInvite({ chartId, to, firstName }, actor) {
  const id = newInviteId()
  const invite = { to: to.trim().toLowerCase(), firstName, status: "ready", createdBy: { uid: actor.uid, name: actor.name } }
  // Only the address and the ids: the template types every word and builds the
  // button on https://corephia.com/portal/setup itself (see InviteDialog).
  const params = { to_email: invite.to, chart_id: chartId, invite_id: id }

  if (usingSeedData) {
    const list = await demoInvites(chartId)
    const entry = { id, ...invite, createdAt: new Date() }
    list.unshift(entry)
    try {
      if (emailjsConfigured) await sendEmail(params)
      for (const earlier of list) if (earlier !== entry && earlier.status === "sent") Object.assign(earlier, { status: "superseded", supersededAt: new Date() })
      Object.assign(entry, { status: "sent", sentAt: new Date() })
    } catch (cause) {
      Object.assign(entry, { status: "failed", error: String(cause.message).slice(0, 300) })
    }
    return { ...entry }
  }

  const ref = doc(requireDb(), PATIENTS_COLLECTION, chartId, INVITES, id)
  await setDoc(ref, { ...invite, createdAt: serverTimestamp() })
  try {
    await sendEmail(params)
  } catch (cause) {
    const error = String(cause.message).slice(0, 300)
    await updateDoc(ref, { status: "failed", error }).catch(() => {})
    return { id, ...invite, status: "failed", error, createdAt: new Date() }
  }
  // The email is out, but its link only works once the invite reads 'sent'.
  // If that write fails twice, say so: the box would show "Not sent yet" and
  // the patient's link would be dead, so a new invite is the fix.
  if (!(await retryOnce(() => updateDoc(ref, { status: "sent", sentAt: serverTimestamp() })))) {
    return { id, ...invite, status: "unrecorded", createdAt: new Date() }
  }
  // Only the newest link works: earlier sent invites are retired. If that
  // fails they still expire within 7 days, so the send still counts.
  await retryOnce(async () => {
    const earlier = await getDocs(query(collection(requireDb(), PATIENTS_COLLECTION, chartId, INVITES), where("status", "==", "sent")))
    const batch = writeBatch(requireDb())
    for (const entry of earlier.docs) if (entry.id !== id) batch.update(entry.ref, { status: "superseded", supersededAt: serverTimestamp() })
    await batch.commit()
  })
  return { id, ...invite, status: "sent", sentAt: new Date(), createdAt: new Date() }
}
