// Portal updates (spec: 2026-10-05-portal-updates-design): every read and
// write for patients/{chartId}/updates goes through here. firestore.rules is
// the real boundary. The "new update" email never carries the message, only
// a link to the portal. Demo mode keeps updates in memory and, without the
// EmailJS keys, pretends the email went out.
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"
import { retryOnce } from "../../lib/inviteMath"
import { db, usingSeedData } from "../lib/firebase"
import { UPDATE_TEMPLATE_ID, sendEmail, updateEmailConfigured } from "../../lib/emailjs"
import { PATIENTS_COLLECTION, demoId, getDemoStore } from "./chartStore"

const UPDATES = "updates"

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

const demoUpdates = async (chartId) => {
  const store = await getDemoStore()
  store.updates ??= new Map()
  if (!store.updates.has(chartId)) store.updates.set(chartId, [])
  return store.updates.get(chartId)
}

// Only the address: the update template holds its own subject, text and link.
const emailParams = (to) => ({ to_email: to })

// Newest first, removed ones included (the chart shows them greyed).
export async function loadUpdates(chartId) {
  if (usingSeedData) return (await demoUpdates(chartId)).map((update) => ({ ...update }))
  const snapshot = await getDocs(query(collection(requireDb(), PATIENTS_COLLECTION, chartId, UPDATES), orderBy("createdAt", "desc")))
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

// Saves the update, then (if asked and there's an address) sends the email
// and records how it went. Throws only if the save fails: once saved, the
// patient sees it on their next login whatever the email did. If recording
// the email result fails twice, the chart says "Not emailed"; acceptable.
export async function postUpdate({ chartId, to, body, fromNoteId = null, email }, actor) {
  const update = {
    body,
    author: { uid: actor.uid, name: actor.name, role: actor.role },
    email: "none",
    fromNoteId,
    removed: false,
  }
  const wantsEmail = Boolean(email && to)

  if (usingSeedData) {
    const entry = { id: demoId(), ...update, createdAt: new Date() }
    ;(await demoUpdates(chartId)).unshift(entry)
    if (wantsEmail) {
      try {
        if (updateEmailConfigured) await sendEmail(emailParams(to), UPDATE_TEMPLATE_ID)
        entry.email = "sent"
      } catch {
        entry.email = "failed"
      }
    }
    return { update: { ...entry }, emailed: entry.email }
  }

  const ref = doc(collection(requireDb(), PATIENTS_COLLECTION, chartId, UPDATES))
  await setDoc(ref, { ...update, createdAt: serverTimestamp() })
  let emailed = "none"
  if (wantsEmail) {
    emailed = await sendEmail(emailParams(to), UPDATE_TEMPLATE_ID).then(
      () => "sent",
      () => "failed",
    )
    if (!(await retryOnce(() => updateDoc(ref, { email: emailed })))) console.error("Could not record the update email result.")
  }
  return { update: { id: ref.id, ...update, email: emailed, createdAt: new Date() }, emailed }
}

// Hides it from the patient; it stays on the chart, marked removed.
export async function removeUpdate(chartId, updateId, actor) {
  const by = { uid: actor.uid, name: actor.name }
  if (usingSeedData) {
    const entry = (await demoUpdates(chartId)).find((update) => update.id === updateId)
    if (entry) entry.removed = { by, at: new Date() }
    return
  }
  await updateDoc(doc(requireDb(), PATIENTS_COLLECTION, chartId, UPDATES, updateId), {
    removed: { by, at: serverTimestamp() },
  })
}
