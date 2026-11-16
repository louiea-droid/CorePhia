// Email templates in Firestore (`emailTemplates`, with a `versions` subcollection).
// Demo mode keeps an in-memory list. Saving rewrites the whole document, as the rules require.
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore"
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
const demoTemplates = () =>
  (demo ??= [
    ...DEFAULT_TEMPLATES,
    { name: "Outside Florida", purpose: "declined", status: "published", isDefault: false, subject: "An update on your CorePhia form", headline: "Thank you, {firstName}", body: para("We can only see patients who live in Florida right now.") },
    { name: "Checking in", purpose: "manual", status: "published", isDefault: false, subject: "Checking in", headline: "Hi {firstName}", body: para("Just checking in to see how you're doing.") },
  ].map((t, i) => ({ ...t, id: `demo-${i}`, updatedAt: new Date(), updatedBy: "Demo" })))
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
    const list = demoTemplates()
    const newId = id ?? `demo-${Date.now()}`
    if (data.isDefault) list.forEach((t) => t.purpose === data.purpose && t.id !== newId && (t.isDefault = false))
    const at = { updatedAt: new Date(), updatedBy: actorName }
    const at0 = list.findIndex((t) => t.id === newId)
    if (at0 >= 0) list[at0] = { ...list[at0], ...data, ...at }
    else list.push({ id: newId, ...data, ...at })
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
  if (usingSeedData) return []
  const snap = await getDocs(query(collection(db, COLLECTION, id, "versions"), orderBy("updatedAt", "desc"), limit(50)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Brings back name, subject, headline and body; purpose, status and default stay as they are now.
export async function restoreVersion(id, version, actorName, current) {
  const { name, subject, headline, body } = version
  return saveTemplate(id, { ...pick(current), name, subject, headline, body }, actorName, AUDIT_ACTIONS.restoreEmailTemplate)
}

export async function seedDefaultsIfEmpty(actorName) {
  if (usingSeedData) return
  if (!(await getDocs(query(collection(db, COLLECTION), limit(1)))).empty) return
  for (const d of DEFAULT_TEMPLATES) await saveTemplate(null, d, actorName)
}

export async function sendPatientEmail({ mode, templateId, intakeId }) {
  if (usingSeedData) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { sentAt: new Date().toISOString(), to: "demo@example.com" }
  }
  const call = httpsCallable(getFunctions(app, "us-central1"), "sendPatientEmail")
  return (await call({ mode, templateId, intakeId })).data
}
