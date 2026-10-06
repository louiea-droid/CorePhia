// Patient portal invites and the invite template: every read and write for
// them goes through here. firestore.rules is the real boundary (the invites
// and settings/portalInvite blocks). Demo mode keeps invites in memory and,
// without EmailJS keys, pretends the email went out.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore"
import { DEFAULT_INVITE, escapeMessage, newInviteId, retryOnce } from "../../lib/inviteMath"
import { db, usingSeedData } from "../lib/firebase"
import { emailjsConfigured, sendEmail } from "../../lib/emailjs"
import { PATIENTS_COLLECTION, getDemoStore } from "./chartStore"

const INVITES = "invites"
const TEMPLATE_REF = ["settings", "portalInvite"]

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
export async function sendInvite({ chartId, to, firstName, subject, message }, actor) {
  const id = newInviteId()
  const invite = { to: to.trim().toLowerCase(), firstName, subject, message, status: "ready", createdBy: { uid: actor.uid, name: actor.name } }
  const params = {
    to_email: invite.to,
    subject,
    message_html: escapeMessage(message),
    setup_link: `${window.location.origin}/portal/setup?c=${encodeURIComponent(chartId)}&i=${id}`,
  }

  if (usingSeedData) {
    const list = await demoInvites(chartId)
    const entry = { id, ...invite, createdAt: new Date() }
    list.unshift(entry)
    try {
      if (emailjsConfigured) await sendEmail(params)
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
  return { id, ...invite, status: "sent", sentAt: new Date(), createdAt: new Date() }
}

export async function loadInviteTemplate() {
  if (usingSeedData) return (await getDemoStore()).inviteTemplate ?? DEFAULT_INVITE
  const snapshot = await getDoc(doc(requireDb(), ...TEMPLATE_REF))
  const data = snapshot.data()
  return data?.subject && data?.message ? { subject: data.subject, message: data.message } : DEFAULT_INVITE
}

export async function saveInviteTemplate({ subject, message }, actor) {
  if (usingSeedData) {
    ;(await getDemoStore()).inviteTemplate = { subject, message }
    return
  }
  await setDoc(doc(requireDb(), ...TEMPLATE_REF), {
    subject,
    message,
    updatedBy: { uid: actor.uid, name: actor.name },
    updatedAt: serverTimestamp(),
  })
}
