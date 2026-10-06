// Patient messages from the portal side (spec 2026-10-06-portal-messages-design).
// Each write is one batch firestore.rules ties together. After a patient
// message that makes the topic newly need a reply, info@ gets a content-free
// staff notice; its failure is logged, never shown (the message is saved).
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore"
import { STAFF_TEMPLATE_ID, sendEmail, staffEmailConfigured } from "../../lib/emailjs"
import { notifiesStaff } from "../../lib/messageMath"
import { db } from "./patientAuth"

const topicsOf = (intakeId) => collection(db, "patients", intakeId, "topics")

function notifyStaff() {
  if (!staffEmailConfigured) return
  // No parameters: the template holds the recipient, text and link.
  sendEmail({}, STAFF_TEMPLATE_ID).catch((cause) =>
    console.error("Could not send the staff notice:", cause.message),
  )
}

export function listenMyTopics(intakeId, onChange, onError) {
  if (!db) {
    onChange([])
    return () => {}
  }
  return onSnapshot(topicsOf(intakeId), (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))), onError)
}

export function listenMyMessages(intakeId, topicId, onChange, onError) {
  if (!db) {
    onChange([])
    return () => {}
  }
  return onSnapshot(
    query(collection(db, "patients", intakeId, "topics", topicId, "messages"), orderBy("createdAt", "asc")),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    onError,
  )
}

// "active" or "inactive", live: staff can make a chart inactive while the
// patient has a conversation open, and the reply box has to close with it.
export function listenMyChartStatus(intakeId, onChange) {
  if (!db) {
    onChange("inactive")
    return () => {}
  }
  return onSnapshot(
    doc(db, "patients", intakeId),
    (snap) => onChange(snap.data()?.status === "active" ? "active" : "inactive"),
    (cause) => {
      console.error("Could not load the chart status:", cause.code ?? cause.message)
      onChange("inactive")
    },
  )
}

export async function startConversation(intakeId, uid, { subject, body }) {
  const topicRef = doc(topicsOf(intakeId))
  const messageRef = doc(collection(topicRef, "messages"))
  const batch = writeBatch(db)
  batch.set(topicRef, {
    subject,
    status: "open",
    startedBy: "patient",
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastFrom: "patient",
    lastMessageId: messageRef.id,
    patientReadAt: serverTimestamp(),
    staffReadAt: null,
    closed: null,
  })
  batch.set(messageRef, { body, from: { kind: "patient", uid }, createdAt: serverTimestamp(), email: "none" })
  await batch.commit()
  notifyStaff()
  return topicRef.id
}

export async function replyInConversation(intakeId, uid, topic, body) {
  const topicRef = doc(topicsOf(intakeId), topic.id)
  const messageRef = doc(collection(topicRef, "messages"))
  const batch = writeBatch(db)
  batch.update(topicRef, {
    lastMessageAt: serverTimestamp(),
    lastFrom: "patient",
    lastMessageId: messageRef.id,
    status: "open",
    closed: null,
    patientReadAt: serverTimestamp(),
  })
  batch.set(messageRef, { body, from: { kind: "patient", uid }, createdAt: serverTimestamp(), email: "none" })
  await batch.commit()
  if (notifiesStaff(topic)) notifyStaff()
}

export async function closeConversation(intakeId, topicId) {
  await updateDoc(doc(topicsOf(intakeId), topicId), { status: "closed", closed: { by: "patient", name: "", at: serverTimestamp() } })
}

export async function markConversationRead(intakeId, topicId) {
  await updateDoc(doc(topicsOf(intakeId), topicId), { patientReadAt: serverTimestamp() })
}
