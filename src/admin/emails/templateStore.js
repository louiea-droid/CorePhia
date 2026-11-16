// Email templates in Firestore (`emailTemplates`, with a `versions` subcollection).
// Demo mode keeps an in-memory list. Saving rewrites the whole document, as the rules require.
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore"
import { getFunctions, httpsCallable } from "firebase/functions"
import { DEFAULT_TEMPLATES } from "../../../functions/emailDefaults.js"
import { AUDIT_ACTIONS, app, db, recordAuditEvent, usingSeedData } from "../lib/firebase"

const COLLECTION = "emailTemplates"
const FIELDS = ["name", "purpose", "status", "isDefault", "subject", "headline", "body"]
const pick = (t) => Object.fromEntries(FIELDS.map((k) => [k, t[k]]))
const para = (text) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })

// ---- demo mode ----
let demo = null
const demoListeners = new Set()
const demoTemplates = () => {
  if (demo) return demo
  demo = [
    ...DEFAULT_TEMPLATES,
    { name: "Outside Florida", purpose: "declined", status: "published", isDefault: false, subject: "An update on your CorePhia form", headline: "Thank you, {firstName}", body: para("We can only see patients who live in Florida right now.") },
    { name: "Checking in", purpose: "manual", status: "published", isDefault: false, subject: "Checking in", headline: "Hi {firstName}", body: para("Just checking in to see how you're doing.") },
  ].map((t, i) => ({ ...t, id: `demo-${i}`, updatedAt: new Date(), updatedBy: "Demo" }))
  demo.forEach((t) => demoLog(t.id, t, "Demo"))
  return demo
}

const demoVersions = new Map()
const demoLog = (id, t, actorName) => {
  const v = { ...pick(t), id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, updatedAt: new Date(), updatedBy: actorName }
  demoVersions.set(id, [v, ...(demoVersions.get(id) ?? [])])
}
const demoEmit = () => demoListeners.forEach((fn) => fn([...demoTemplates()]))

export function watchTemplates(onChange, onError) {
  if (usingSeedData) {
    demoListeners.add(onChange)
    onChange([...demoTemplates()])
    return () => demoListeners.delete(onChange)
  }
  return onSnapshot(
    collection(db, COLLECTION),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

// One batch: the template, a version of it, and (for a new default) the old default(s) demoted.
export async function saveTemplate(id, fields, actorName, auditAction = AUDIT_ACTIONS.saveEmailTemplate) {
  const data = pick(fields)
  if (usingSeedData) {
    const newId = id ?? `demo-${Date.now()}`
    const at = { updatedAt: new Date(), updatedBy: actorName }
    const next = demoTemplates().map((t) =>
      data.isDefault && t.purpose === data.purpose && t.id !== newId && t.isDefault ? { ...t, isDefault: false, ...at } : t,
    )
    next.filter((t, i) => t !== demo[i]).forEach((t) => demoLog(t.id, t, actorName))
    const found = next.findIndex((t) => t.id === newId)
    const saved = { ...(found >= 0 ? next[found] : {}), id: newId, ...data, ...at }
    if (found >= 0) next[found] = saved
    else next.push(saved)
    demo = next
    demoLog(newId, saved, actorName)
    demoEmit()
    return newId
  }
  const batch = writeBatch(db)
  const ref = id ? doc(db, COLLECTION, id) : doc(collection(db, COLLECTION))
  const stamp = () => ({ updatedAt: serverTimestamp(), updatedBy: actorName })
  const write = (templateRef, full) => {
    batch.set(templateRef, { ...full, ...stamp() })
    batch.set(doc(collection(templateRef, "versions")), { ...full, ...stamp() })
  }
  write(ref, data)
  if (data.isDefault) {
    const others = await getDocs(collection(db, COLLECTION))
    others.forEach((d) => {
      const o = d.data()
      if (d.id !== ref.id && o.purpose === data.purpose && o.isDefault) write(d.ref, { ...pick(o), isDefault: false })
    })
  }
  await batch.commit()
  await recordAuditEvent({ action: auditAction, targetCollection: COLLECTION, targetId: ref.id, targetLabel: data.name })
  return ref.id
}

export async function deleteTemplate(id) {
  if (usingSeedData) {
    demo = demoTemplates().filter((t) => t.id !== id)
    demoEmit()
    return
  }
  const batch = writeBatch(db)
  batch.delete(doc(db, COLLECTION, id))
  await batch.commit()
  await recordAuditEvent({ action: AUDIT_ACTIONS.deleteEmailTemplate, targetCollection: COLLECTION, targetId: id })
}

export async function loadVersions(id) {
  if (usingSeedData) {
    demoTemplates()
    return demoVersions.get(id) ?? []
  }
  const snap = await getDocs(query(collection(db, COLLECTION, id, "versions"), orderBy("updatedAt", "desc"), limit(50)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Brings back name, subject, headline and body; purpose, status and default stay as they are now.
export async function restoreVersion(id, version, actorName, current) {
  current ??= usingSeedData ? demoTemplates().find((t) => t.id === id) : (await getDoc(doc(db, COLLECTION, id))).data()
  const { name, subject, headline, body } = version
  return saveTemplate(id, { ...pick(current), name, subject, headline, body }, actorName, AUDIT_ACTIONS.restoreEmailTemplate)
}

// Once per page load (AdminApp on an admin's sign-in, and Email templates):
// two seeds at once would both see an empty collection. A failure clears it so
// the next call tries again.
let seeding = null
export function seedDefaultsIfEmpty(actorName) {
  seeding ??= (async () => {
    if (usingSeedData) return
    if (!(await getDocs(query(collection(db, COLLECTION), limit(1)))).empty) return
    for (const d of DEFAULT_TEMPLATES) await saveTemplate(null, d, actorName)
  })().catch((error) => {
    seeding = null
    throw error
  })
  return seeding
}

export async function sendPatientEmail({ mode, templateId, intakeId }) {
  if (usingSeedData) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { sentAt: new Date().toISOString(), to: "demo@example.com" }
  }
  const call = httpsCallable(getFunctions(app, "us-central1"), "sendPatientEmail")
  return (await call({ mode, templateId, intakeId })).data
}
