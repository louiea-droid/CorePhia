// Staff to-dos: every read and write goes through here. firestore.rules is the
// real boundary (the todos block). Demo mode uses chartStore's in-memory store.
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { db, usingSeedData } from "../lib/firebase"
import { demoId, getDemoStore } from "./chartStore"

export const TODOS_COLLECTION = "todos"

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}
const content = ({ text, intakeId, patientName, due, visibility }) => ({
  text: text.trim(),
  intakeId: intakeId ?? "",
  patientName: patientName ?? "",
  due: due ?? "",
  visibility: visibility === "everyone" ? "everyone" : "me",
})

// Two queries, because the rules allow exactly these: my own items, and
// everyone's shared ones. Merged by id (my shared items come back twice).
export async function loadTodos(uid) {
  if (usingSeedData) {
    return (await getDemoStore()).todos.filter((todo) => todo.visibility === "everyone" || todo.ownerUid === uid).map((todo) => ({ ...todo }))
  }
  const todos = collection(requireDb(), TODOS_COLLECTION)
  const [mine, shared] = await Promise.all([
    getDocs(query(todos, where("ownerUid", "==", uid))),
    getDocs(query(todos, where("visibility", "==", "everyone"))),
  ])
  const byId = new Map([...mine.docs, ...shared.docs].map((entry) => [entry.id, { id: entry.id, ...entry.data() }]))
  return [...byId.values()]
}

export async function addTodo(fields, actor) {
  const base = { ...content(fields), ownerUid: actor.uid, ownerName: actor.name, done: null }
  if (usingSeedData) {
    const todo = { id: demoId(), ...base, createdAt: new Date(), updatedAt: new Date() }
    ;(await getDemoStore()).todos.push(todo)
    return { ...todo }
  }
  const ref = await addDoc(collection(requireDb(), TODOS_COLLECTION), { ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return { id: ref.id, ...base, createdAt: new Date(), updatedAt: new Date() }
}

export async function editTodo(todo, fields) {
  const next = content(fields)
  if (usingSeedData) {
    Object.assign((await getDemoStore()).todos.find((entry) => entry.id === todo.id), next, { updatedAt: new Date() })
  } else {
    await updateDoc(doc(requireDb(), TODOS_COLLECTION, todo.id), { ...next, updatedAt: serverTimestamp() })
  }
  return { ...todo, ...next, updatedAt: new Date() }
}

// Ticking records who and when; Undo clears it. Nothing is deleted.
export async function setTodoDone(todo, isDone, actor) {
  const done = isDone ? { uid: actor.uid, name: actor.name } : null
  if (usingSeedData) {
    Object.assign((await getDemoStore()).todos.find((entry) => entry.id === todo.id), { done: done && { ...done, at: new Date() }, updatedAt: new Date() })
  } else {
    await updateDoc(doc(requireDb(), TODOS_COLLECTION, todo.id), { done: done && { ...done, at: serverTimestamp() }, updatedAt: serverTimestamp() })
  }
  return { ...todo, done: done && { ...done, at: new Date() }, updatedAt: new Date() }
}
