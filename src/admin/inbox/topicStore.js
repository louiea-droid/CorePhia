// Patient messages on the staff side (spec 2026-10-06-portal-messages-design):
// every read and write for patients/{chartId}/topics. Each write is one batch
// that firestore.rules ties together (a message always moves its topic).
// Demo mode keeps topics in memory with a tiny listener list so the page
// still updates live, and seeds two sample topics.
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore"
import { retryOnce } from "../../lib/inviteMath"
import { PORTAL_TEMPLATE_ID, portalEmailConfigured, sendEmail } from "../../lib/emailjs"
import { db, usingSeedData } from "../lib/firebase"
import { PATIENTS_COLLECTION, demoId, getDemoStore } from "../patients/chartStore"

const TOPICS = "topics"
const MESSAGES = "messages"
export const MESSAGE_SUBJECT = "You have a new message from CorePhia"

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

const emailParams = (to) => ({
  to_email: to,
  subject: MESSAGE_SUBJECT,
  notice: "Your CorePhia care team sent you a message. Log in to your portal to read it.",
  portal_link: `${window.location.origin}/account/messages`,
})

async function emailPatient(to, wanted) {
  if (!wanted || !to) return "none"
  if (usingSeedData && !portalEmailConfigured) return "sent"
  return sendEmail(emailParams(to), PORTAL_TEMPLATE_ID).then(
    () => "sent",
    () => "failed",
  )
}

const staffFrom = (actor) => ({ kind: "staff", uid: actor.uid, name: actor.name, role: actor.role })

// --- Demo ------------------------------------------------------------------

async function demo() {
  const store = await getDemoStore()
  if (!store.topics) {
    store.topics = []
    store.topicListeners = new Set()
    const charts = [...store.charts.values()].filter((chart) => chart.status === "active").slice(0, 2)
    const hoursAgo = (h) => new Date(Date.now() - h * 3600000)
    if (charts[0]) {
      store.topics.push({
        id: demoId(),
        chartId: charts[0].id,
        subject: "Feeling dizzy after the new dose",
        status: "open",
        startedBy: "patient",
        createdAt: hoursAgo(5),
        lastMessageAt: hoursAgo(2),
        lastFrom: "patient",
        lastMessageId: "m2",
        patientReadAt: hoursAgo(2),
        staffReadAt: null,
        closed: null,
        messages: [
          { id: "m1", body: "Hi, I've felt a little dizzy in the mornings since last week.", from: { kind: "patient", uid: "p" }, createdAt: hoursAgo(5), email: "none" },
          { id: "m2", body: "It's better after breakfast. Should I keep going?", from: { kind: "patient", uid: "p" }, createdAt: hoursAgo(2), email: "none" },
        ],
      })
    }
    if (charts[1]) {
      store.topics.push({
        id: demoId(),
        chartId: charts[1].id,
        subject: "Swapping the evening snack",
        status: "open",
        startedBy: "staff",
        createdAt: hoursAgo(30),
        lastMessageAt: hoursAgo(26),
        lastFrom: "staff",
        lastMessageId: "m2",
        patientReadAt: hoursAgo(27),
        staffReadAt: hoursAgo(26),
        closed: null,
        messages: [
          { id: "m1", body: "How did the new evening snack go this week?", from: { kind: "staff", uid: "d", name: "Sam Rivera, RD", role: "dietitian" }, createdAt: hoursAgo(30), email: "sent" },
          { id: "m2", body: "Great to hear. Let's keep it for another two weeks.", from: { kind: "staff", uid: "d", name: "Sam Rivera, RD", role: "dietitian" }, createdAt: hoursAgo(26), email: "sent" },
        ],
      })
    }
  }
  return store
}

const notify = (store) => store.topicListeners.forEach((listener) => listener())
const strip = ({ messages: _messages, ...topic }) => topic

// --- Reads -----------------------------------------------------------------

export function listenTopics(onChange, onError) {
  if (usingSeedData) {
    let store
    const push = () => onChange(store.topics.map(strip))
    demo().then((loaded) => {
      store = loaded
      store.topicListeners.add(push)
      push()
    }, onError)
    return () => store?.topicListeners.delete(push)
  }
  return onSnapshot(
    collectionGroup(requireDb(), TOPICS),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, chartId: entry.ref.parent.parent.id, ...entry.data() }))),
    onError,
  )
}

export function listenMessages(chartId, topicId, onChange, onError) {
  if (usingSeedData) {
    let store
    const push = () => onChange([...(store.topics.find((topic) => topic.id === topicId)?.messages ?? [])])
    demo().then((loaded) => {
      store = loaded
      store.topicListeners.add(push)
      push()
    }, onError)
    return () => store?.topicListeners.delete(push)
  }
  return onSnapshot(
    query(collection(requireDb(), PATIENTS_COLLECTION, chartId, TOPICS, topicId, MESSAGES), orderBy("createdAt", "asc")),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    onError,
  )
}

// --- Writes ----------------------------------------------------------------

async function recordEmail(ref, emailed) {
  if (emailed === "none") return
  if (!(await retryOnce(() => updateDoc(ref, { email: emailed })))) console.error("Could not record the message email result.")
}

export async function startTopic({ chartId, subject, body, to, email }, actor) {
  const from = staffFrom(actor)
  if (usingSeedData) {
    const store = await demo()
    const now = new Date()
    const message = { id: demoId(), body, from, createdAt: now, email: "none" }
    const topic = {
      id: demoId(),
      chartId,
      subject,
      status: "open",
      startedBy: "staff",
      createdAt: now,
      lastMessageAt: now,
      lastFrom: "staff",
      lastMessageId: message.id,
      patientReadAt: null,
      staffReadAt: now,
      closed: null,
      messages: [message],
    }
    store.topics.push(topic)
    message.email = await emailPatient(to, email)
    notify(store)
    return { topicId: topic.id, emailed: message.email }
  }
  const database = requireDb()
  const topicRef = doc(collection(database, PATIENTS_COLLECTION, chartId, TOPICS))
  const messageRef = doc(collection(topicRef, MESSAGES))
  const batch = writeBatch(database)
  batch.set(topicRef, {
    subject,
    status: "open",
    startedBy: "staff",
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastFrom: "staff",
    lastMessageId: messageRef.id,
    patientReadAt: null,
    staffReadAt: serverTimestamp(),
    closed: null,
  })
  batch.set(messageRef, { body, from, createdAt: serverTimestamp(), email: "none" })
  await batch.commit()
  const emailed = await emailPatient(to, email)
  await recordEmail(messageRef, emailed)
  return { topicId: topicRef.id, emailed }
}

export async function replyToTopic({ chartId, topicId, body, to, email }, actor) {
  const from = staffFrom(actor)
  if (usingSeedData) {
    const store = await demo()
    const topic = store.topics.find((entry) => entry.id === topicId)
    const now = new Date()
    const message = { id: demoId(), body, from, createdAt: now, email: "none" }
    topic.messages.push(message)
    Object.assign(topic, { lastMessageAt: now, lastFrom: "staff", lastMessageId: message.id, status: "open", closed: null, staffReadAt: now })
    message.email = await emailPatient(to, email)
    notify(store)
    return { emailed: message.email }
  }
  const database = requireDb()
  const topicRef = doc(database, PATIENTS_COLLECTION, chartId, TOPICS, topicId)
  const messageRef = doc(collection(topicRef, MESSAGES))
  const batch = writeBatch(database)
  batch.update(topicRef, {
    lastMessageAt: serverTimestamp(),
    lastFrom: "staff",
    lastMessageId: messageRef.id,
    status: "open",
    closed: null,
    staffReadAt: serverTimestamp(),
  })
  batch.set(messageRef, { body, from, createdAt: serverTimestamp(), email: "none" })
  await batch.commit()
  const emailed = await emailPatient(to, email)
  await recordEmail(messageRef, emailed)
  return { emailed }
}

export async function closeTopic(chartId, topicId, actor) {
  if (usingSeedData) {
    const store = await demo()
    Object.assign(store.topics.find((topic) => topic.id === topicId), {
      status: "closed",
      closed: { by: "staff", name: actor.name, at: new Date() },
    })
    notify(store)
    return
  }
  await updateDoc(doc(requireDb(), PATIENTS_COLLECTION, chartId, TOPICS, topicId), {
    status: "closed",
    closed: { by: "staff", name: actor.name, at: serverTimestamp() },
  })
}

export async function markTopicRead(chartId, topicId) {
  if (usingSeedData) {
    const store = await demo()
    const topic = store.topics.find((entry) => entry.id === topicId)
    if (topic) topic.staffReadAt = new Date()
    notify(store)
    return
  }
  await updateDoc(doc(requireDb(), PATIENTS_COLLECTION, chartId, TOPICS, topicId), { staffReadAt: serverTimestamp() })
}
