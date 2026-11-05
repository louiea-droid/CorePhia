// Patient messages from the portal side (spec 2026-10-06-portal-messages-design).
// Each write is one batch firestore.rules ties together. After a patient
// message that makes the topic newly need a reply, info@ gets a content-free
// staff notice; its failure is logged, never shown (the message is saved).
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore"
import { queueMail } from "../../lib/mail"
import { notifiesStaff } from "../../lib/messageMath"
import { db } from "./patientAuth"
import { demoMarkRead, demoMessages, listenDemoChart, listenDemoTopics, portalDemo } from "./portalDemo"

const topicsOf = (intakeId) => collection(db, "patients", intakeId, "topics")

function notifyStaff() {
  if (!db) return
  // Only the kind: functions/emails.js holds the recipient, text and link.
  queueMail(db, { kind: "staff" }).catch((cause) =>
    console.error("Could not send the staff notice:", cause.message),
  )
}

export function listenMyTopics(intakeId, onChange, onError) {
  if (portalDemo) return listenDemoTopics(onChange)
  if (!db) {
    onChange([])
    return () => {}
  }
  return onSnapshot(topicsOf(intakeId), (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))), onError)
}

export function listenMyMessages(intakeId, topicId, onChange, onError) {
  if (portalDemo) {
    onChange(demoMessages(topicId))
    return () => {}
  }
  if (!db) {
    onChange([])
    return () => {}
  }
  return onSnapshot(
    // The rules only let a patient read messages not removed, so the query must
    // say removed == false. Sorted here so no composite index is needed; a
    // pending send has no server time yet, so it estimates one (and goes last).
    query(collection(db, "patients", intakeId, "topics", topicId, "messages"), where("removed", "==", false)),
    (snapshot) =>
      onChange(
        snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data({ serverTimestamps: "estimate" }) }))
          .sort((a, b) => (a.createdAt?.toMillis?.() ?? Infinity) - (b.createdAt?.toMillis?.() ?? Infinity)),
      ),
    onError,
  )
}

// The chart doc, live: onChange gets { id, ...data }, or null when the doc is
// missing. A failed read goes to onError instead, so callers never mistake it
// for a chart with no membership.
export function listenMyChart(intakeId, onChange, onError) {
  if (portalDemo) return listenDemoChart(onChange)
  if (!db) {
    onError()
    return () => {}
  }
  return onSnapshot(
    doc(db, "patients", intakeId),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (cause) => {
      console.error("Could not load the chart:", cause.code ?? cause.message)
      onError(cause)
    },
  )
}

// "active" or "inactive", live: the reply box has to close with the chart.
// Missing or unreadable reads as inactive.
export const listenMyChartStatus = (intakeId, onChange) =>
  listenMyChart(
    intakeId,
    (chart) => onChange(chart?.status === "active" ? "active" : "inactive"),
    () => onChange("inactive"),
  )

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
  batch.set(messageRef, { body, from: { kind: "patient", uid }, createdAt: serverTimestamp(), email: "none", removed: false })
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
  batch.set(messageRef, { body, from: { kind: "patient", uid }, createdAt: serverTimestamp(), email: "none", removed: false })
  await batch.commit()
  if (notifiesStaff(topic)) notifyStaff()
}

export async function closeConversation(intakeId, topicId) {
  await updateDoc(doc(topicsOf(intakeId), topicId), { status: "closed", closed: { by: "patient", name: "", at: serverTimestamp() } })
}

export async function markConversationRead(intakeId, topicId) {
  if (portalDemo) return demoMarkRead(topicId)
  await updateDoc(doc(topicsOf(intakeId), topicId), { patientReadAt: serverTimestamp() })
}
