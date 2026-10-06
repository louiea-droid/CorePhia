// Track progress on the staff side: every read and write for
// patients/{chartId}/progress except the visit entries, which signNote adds
// to the signing batch. firestore.rules checks every shape.
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore"
import { visitEntryFor } from "../../lib/progressMath"
import { db, usingSeedData } from "../lib/firebase"
import { PATIENTS_COLLECTION, getDemoStore } from "./chartStore"

const PROGRESS = "progress"
const BASELINE_KEYS = ["heightFeet", "heightInches", "currentWeightLb", "goalWeightLb"]

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

// Demo: built once per chart from its signed notes, like a real chart signed
// after this feature shipped.
export async function demoProgress(chartId) {
  const store = await getDemoStore()
  store.progress ??= new Map()
  if (!store.progress.has(chartId)) {
    const notes = (store.notes.get(chartId) ?? []).filter((note) => note.status === "signed")
    store.progress.set(
      chartId,
      notes.map(visitEntryFor).filter(Boolean).map((entry) => ({ id: `visit-${entry.noteId}`, ...entry, createdAt: new Date() })),
    )
  }
  return store.progress.get(chartId)
}

const split = (all) => ({
  entries: all.filter((entry) => entry.source !== "baseline"),
  baseline: all.find((entry) => entry.source === "baseline") ?? null,
})

export async function loadProgress(chartId) {
  if (usingSeedData) return split((await demoProgress(chartId)).map((entry) => ({ ...entry })))
  const snapshot = await getDocs(collection(requireDb(), PATIENTS_COLLECTION, chartId, PROGRESS))
  return split(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))
}

// The intake's height and weights, copied as they are, once per chart.
export async function ensureBaseline(chartId, intake) {
  if (!intake) return
  const baseline = { source: "baseline", removed: false }
  for (const key of BASELINE_KEYS) baseline[key] = intake.vitals?.[key] ?? ""
  if (usingSeedData) {
    const list = await demoProgress(chartId)
    if (!list.some((entry) => entry.source === "baseline")) list.push({ id: "baseline", ...baseline })
    return
  }
  const ref = doc(requireDb(), PATIENTS_COLLECTION, chartId, PROGRESS, "baseline")
  if ((await getDoc(ref)).exists()) return
  await setDoc(ref, baseline)
}
