# To-do: staff-added items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff add their own to-dos (private or shared, optional patient and due date) on the To-do page, tick them off into a Done section, above the unchanged automatic list.

**Architecture:** A new `todos` Firestore collection with rules, a store with a demo branch (same pattern as `calendar/appointmentStore.js`), a pure grouping helper checked under node, and two components rendered above the automatic list in `patients/Todo.jsx`. The booking dialog's patient search moves into a shared `PatientPicker` used by both.

**Tech Stack:** React 19, Tailwind v4, Firebase JS SDK 12, node:assert self-checks, `@firebase/rules-unit-testing` (emulator; Java 21 is installed at `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`).

**Spec:** `docs/superpowers/specs/2026-10-02-todo-added-items-design.md`

## Global Constraints

- No new dependencies. Admin tokens only; dark mode; hover = colour only.
- The automatic To-do list (renewals, follow-ups, first consultations) is unchanged and stays below the new cards.
- Nothing is ever deleted: Done items older than 30 days are hidden, not removed.
- Do not edit `CLAUDE.md`. Don't touch Louie's dev server (:5173); browser checks use a separate demo server on :5180 (Firebase env blanked), stopped afterwards.
- Leave Louie's uncommitted `src/admin/layout/Sidebar.jsx` title edit out of every commit.
- Rules tests run with `PATH="<jdk>/bin:$PATH" JAVA_HOME="<jdk>" npm run test:rules`.

## Review Focus

1. **Two people tick the same shared item at once.** Expected: the last tick wins, with that person's name; no error. Covered: rules allow any reader to set `done` as themselves (Task 2 test "anyone can tick a shared item").
2. **A due date in the past entered when adding.** Expected: lands in Overdue straight away. Covered: Task 1 check "past due is overdue".
3. **A done item that was ticked 31 days ago.** Expected: hidden from Done, still stored. Covered: Task 1 check "done older than 30 days hidden".
4. **Text that's only spaces.** Expected: Add stays disabled; the rules refuse an empty string anyway. Covered: Task 4 (`text.trim()` gate) and Task 2 test "empty text refused".
5. **A private item of someone else.** Expected: never listed, never tickable. Covered: Task 2 tests "private items stay private" and "can't tick someone else's private item".

---

### Task 1: Grouping helper

**Files:** Create `src/admin/patients/todoMath.js`, `src/admin/patients/todoMath.check.js`; modify `package.json` (`check`).

**Interfaces:** Produces `groupTodos(todos, today, now = new Date()) → { overdue, today, week, later, undated, done }` (arrays of todo objects; open groups sorted by due then created; undated oldest first; done newest-ticked first, last 30 days only).

- [ ] **Step 1: failing check** — `src/admin/patients/todoMath.check.js`:

```js
// Self-check for todoMath.js: `npm run check`.
import assert from "node:assert/strict"
import { groupTodos } from "./todoMath.js"

const now = new Date("2026-10-02T15:00:00Z")
const item = (id, extra = {}) => ({ id, due: "", done: null, createdAt: new Date("2026-09-01T00:00:00Z"), ...extra })
const ids = (list) => list.map((todo) => todo.id)

const groups = groupTodos(
  [
    item("past", { due: "2026-09-28" }),
    item("today", { due: "2026-10-02" }),
    item("soon", { due: "2026-10-05" }),
    item("edge", { due: "2026-10-09" }),
    item("later", { due: "2026-10-10" }),
    item("undated-new", { createdAt: new Date("2026-09-20T00:00:00Z") }),
    item("undated-old", { createdAt: new Date("2026-09-10T00:00:00Z") }),
    item("done-recent", { done: { uid: "u", name: "U", at: new Date("2026-10-01T10:00:00Z") } }),
    item("done-older", { done: { uid: "u", name: "U", at: new Date("2026-09-20T10:00:00Z") } }),
    item("done-stale", { done: { uid: "u", name: "U", at: new Date("2026-08-31T10:00:00Z") } }),
  ],
  "2026-10-02",
  now,
)
// Past due is overdue; today; within 7 days; beyond 7 days.
assert.deepEqual(ids(groups.overdue), ["past"])
assert.deepEqual(ids(groups.today), ["today"])
assert.deepEqual(ids(groups.week), ["soon", "edge"])
assert.deepEqual(ids(groups.later), ["later"])
// No date: oldest first.
assert.deepEqual(ids(groups.undated), ["undated-old", "undated-new"])
// Done: newest first, older than 30 days hidden.
assert.deepEqual(ids(groups.done), ["done-recent", "done-older"])
// A done item never also shows as open, whatever its due date.
assert.equal(groupTodos([item("x", { due: "2026-09-01", done: { at: now } })], "2026-10-02", now).overdue.length, 0)

console.log("todoMath: all checks passed")
```

`package.json` `check`: append ` && node src/admin/patients/todoMath.check.js`.

- [ ] **Step 2:** `npm run check` → FAIL (module not found).

- [ ] **Step 3: implement** — `src/admin/patients/todoMath.js`:

```js
// Groups the to-dos staff add, for the To-do page. Pure, so todoMath.check.js
// runs it under plain node.
import { asDate, daysFrom } from "./chartMath.js"

// Done items older than this are hidden from the page (never deleted).
const DONE_DAYS = 30
const millis = (value) => asDate(value)?.getTime() ?? 0

export function groupTodos(todos, today, now = new Date()) {
  const groups = { overdue: [], today: [], week: [], later: [], undated: [], done: [] }
  const cutoff = now.getTime() - DONE_DAYS * 86_400_000
  for (const todo of todos) {
    if (todo.done) {
      if (millis(todo.done.at) >= cutoff) groups.done.push(todo)
      continue
    }
    if (!todo.due) {
      groups.undated.push(todo)
      continue
    }
    const days = daysFrom(today, todo.due)
    const group = days < 0 ? groups.overdue : days === 0 ? groups.today : days <= 7 ? groups.week : groups.later
    group.push(todo)
  }
  const byDue = (a, b) => a.due.localeCompare(b.due) || millis(a.createdAt) - millis(b.createdAt)
  for (const key of ["overdue", "today", "week", "later"]) groups[key].sort(byDue)
  groups.undated.sort((a, b) => millis(a.createdAt) - millis(b.createdAt))
  groups.done.sort((a, b) => millis(b.done.at) - millis(a.done.at))
  return groups
}
```

- [ ] **Step 4:** `npm run check` → all pass.
- [ ] **Step 5:** commit `package.json src/admin/patients/todoMath.js src/admin/patients/todoMath.check.js` — "To-do: grouping for staff-added items".

---

### Task 2: Firestore rules for `todos`

**Files:** Modify `firestore.rules` (before the final `match /{document=**}`), `tests/firestore.rules.test.js`.

- [ ] **Step 1: failing tests** — append to `tests/firestore.rules.test.js`:

```js
describe("todos", () => {
  const todo = (uid, overrides = {}) => ({
    text: "Call the pharmacy",
    intakeId: "",
    patientName: "",
    due: "",
    visibility: "me",
    ownerUid: uid,
    ownerName: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    done: null,
    ...overrides,
  })
  const seed = (id, data) =>
    env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "todos", id), { ...data, createdAt: new Date(), updatedAt: new Date() }))
  const tick = (uid) => ({ done: { uid, name: uid, at: serverTimestamp() }, updatedAt: serverTimestamp() })

  test("anyone clinical adds a to-do as themselves", async () => {
    await assertSucceeds(setDoc(doc(as("provider"), "todos", "t1"), todo("provider")))
    await assertSucceeds(setDoc(doc(as("dietitian"), "todos", "t2"), todo("dietitian", { visibility: "everyone", due: "2026-10-09" })))
  })
  test("a to-do can't claim someone else, a past time, or come pre-ticked", async () => {
    const db = as("provider")
    await assertFails(setDoc(doc(db, "todos", "t1"), todo("admin")))
    await assertFails(setDoc(doc(db, "todos", "t2"), todo("provider", { createdAt: new Date("2020-01-01") })))
    await assertFails(setDoc(doc(db, "todos", "t3"), todo("provider", { done: { uid: "provider", name: "provider", at: serverTimestamp() } })))
  })
  test("empty text, a bad date or visibility, and extra fields are refused", async () => {
    const db = as("provider")
    await assertFails(setDoc(doc(db, "todos", "t1"), todo("provider", { text: "" })))
    await assertFails(setDoc(doc(db, "todos", "t2"), todo("provider", { due: "next week" })))
    await assertFails(setDoc(doc(db, "todos", "t3"), todo("provider", { visibility: "team" })))
    await assertFails(setDoc(doc(db, "todos", "t4"), todo("provider", { extra: 1 })))
  })
  test("someone with no role can't add or read", async () => {
    await seed("shared", todo("provider", { visibility: "everyone" }))
    await assertFails(setDoc(doc(as("nobody"), "todos", "t1"), todo("nobody")))
    await assertFails(getDoc(doc(as("nobody"), "todos", "shared")))
  })
  test("private items stay private; shared items are readable by any clinician", async () => {
    await seed("private", todo("provider"))
    await seed("shared", todo("provider", { visibility: "everyone" }))
    await assertSucceeds(getDoc(doc(as("provider"), "todos", "private")))
    await assertFails(getDoc(doc(as("provider2"), "todos", "private")))
    await assertSucceeds(getDoc(doc(as("dietitian"), "todos", "shared")))
    await assertSucceeds(getDocs(query(collection(as("provider2"), "todos"), where("visibility", "==", "everyone"))))
    await assertSucceeds(getDocs(query(collection(as("provider2"), "todos"), where("ownerUid", "==", "provider2"))))
  })
  test("only the author edits the text", async () => {
    await seed("shared", todo("provider", { visibility: "everyone" }))
    await assertSucceeds(updateDoc(doc(as("provider"), "todos", "shared"), { text: "Call them back", updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as("provider2"), "todos", "shared"), { text: "Changed", updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as("provider"), "todos", "shared"), { ownerUid: "provider2", updatedAt: serverTimestamp() }))
  })
  test("anyone can tick a shared item, only as themselves, and Undo it", async () => {
    await seed("shared", todo("provider", { visibility: "everyone" }))
    await assertFails(updateDoc(doc(as("provider2"), "todos", "shared"), { done: { uid: "admin", name: "admin", at: serverTimestamp() }, updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(as("provider2"), "todos", "shared"), tick("provider2")))
    await assertSucceeds(updateDoc(doc(as("dietitian"), "todos", "shared"), { done: null, updatedAt: serverTimestamp() }))
  })
  test("can't tick someone else's private item", async () => {
    await seed("private", todo("provider"))
    await assertFails(updateDoc(doc(as("provider2"), "todos", "private"), tick("provider2")))
  })
  test("to-dos are never deleted", async () => {
    await seed("private", todo("provider"))
    await assertFails(deleteDoc(doc(as("provider"), "todos", "private")))
    await assertFails(deleteDoc(doc(as("super"), "todos", "private")))
  })
})
```

- [ ] **Step 2:** run the rules tests → the new ones FAIL (default deny), the existing 66 pass.

- [ ] **Step 3: rules** — add before `match /{document=**}`:

```
    // --- Staff to-dos ----------------------------------------------------------
    // Added on the To-do page (Louie, 2026-10-02). "me" items are only ever
    // readable by their author; "everyone" items by any clinician. Only the
    // author edits the content; anyone who can see an item ticks it, as
    // themselves, or un-ticks it. Never deleted. Items may name a patient: PHI,
    // same BAA requirement as intakeRecords.
    function isTodoContent(data) {
      return data.text is string && data.text.size() > 0 && data.text.size() <= 500
        && data.intakeId is string && data.intakeId.size() <= 200
        && data.patientName is string && data.patientName.size() <= 200
        && data.due is string && (data.due == '' || data.due.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
        && data.visibility in ['me', 'everyone'];
    }

    match /todos/{todoId} {
      allow read: if isClinical()
        && (resource.data.visibility == 'everyone' || resource.data.ownerUid == request.auth.uid);
      allow create: if isClinical()
        && request.resource.data.keys().hasOnly([
             'text', 'intakeId', 'patientName', 'due', 'visibility',
             'ownerUid', 'ownerName', 'createdAt', 'updatedAt', 'done'
           ])
        && isTodoContent(request.resource.data)
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.ownerName == myName()
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && request.resource.data.done == null;
      allow update: if isClinical()
        && (resource.data.visibility == 'everyone' || resource.data.ownerUid == request.auth.uid)
        && request.resource.data.updatedAt == request.time
        && (
          (resource.data.ownerUid == request.auth.uid
            && request.resource.data.diff(resource.data).affectedKeys()
                 .hasOnly(['text', 'intakeId', 'patientName', 'due', 'visibility', 'updatedAt'])
            && isTodoContent(request.resource.data))
          || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['done', 'updatedAt'])
            && (request.resource.data.done == null
                || (request.resource.data.done.keys().hasOnly(['uid', 'name', 'at'])
                    && request.resource.data.done.uid == request.auth.uid
                    && request.resource.data.done.name == myName()
                    && request.resource.data.done.at == request.time)))
        );
      allow delete: if false;
    }
```

- [ ] **Step 4:** run the rules tests → all pass (66 + 9).
- [ ] **Step 5:** commit `firestore.rules tests/firestore.rules.test.js` — "Rules: staff to-dos".

---

### Task 3: Store and demo data

**Files:** Create `src/admin/patients/todoStore.js`; modify `src/admin/patients/seedCharts.js`.

**Interfaces:** Produces `loadTodos(uid) → Promise<todo[]>`, `addTodo({ text, intakeId, patientName, due, visibility }, actor) → Promise<todo>`, `editTodo(todo, fields) → Promise<todo>`, `setTodoDone(todo, isDone, actor) → Promise<todo>`. Demo store gains `todos`.

- [ ] **Step 1** — `src/admin/patients/todoStore.js`:

```js
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
```

- [ ] **Step 2: demo items** — in `seedCharts.js`, before `return { charts, ... }`:

```js
  // Staff to-dos for the To-do page: private and shared, one with a patient,
  // one overdue, one done.
  const firstChart = charts.values().next().value
  const todos = [
    { id: "demo-todo-1", text: "Call the pharmacy about the refill", intakeId: firstChart?.id ?? "", patientName: firstChart ? `${firstChart.firstName} ${firstChart.lastName}` : "", due: isoDay(now - DAY), visibility: "me", ownerUid: PROVIDER.uid, ownerName: PROVIDER.name, createdAt: new Date(now - 3 * DAY), updatedAt: new Date(now - 3 * DAY), done: null },
    { id: "demo-todo-2", text: "Order more scales for the clinic", intakeId: "", patientName: "", due: "", visibility: "everyone", ownerUid: "demo-super", ownerName: "Hyacinth team", createdAt: new Date(now - 5 * DAY), updatedAt: new Date(now - 5 * DAY), done: null },
    { id: "demo-todo-3", text: "Review this week's meal plans", intakeId: "", patientName: "", due: isoDay(now + 3 * DAY), visibility: "everyone", ownerUid: DIETITIAN.uid, ownerName: DIETITIAN.name, createdAt: new Date(now - DAY), updatedAt: new Date(now - DAY), done: null },
    { id: "demo-todo-4", text: "Confirm the new intake time slots", intakeId: "", patientName: "", due: "", visibility: "everyone", ownerUid: PROVIDER.uid, ownerName: PROVIDER.name, createdAt: new Date(now - 6 * DAY), updatedAt: new Date(now - 2 * DAY), done: { uid: "demo-provider", name: "Jordan Lee, NP", at: new Date(now - 2 * DAY) } },
  ]
```

and add `todos` to the returned object.

- [ ] **Step 3:** `npm run build` passes; commit — "To-do: store and demo items for staff to-dos".

---

### Task 4: Shared PatientPicker, Add form, Added list, page wiring

**Files:** Create `src/admin/ui/PatientPicker.jsx`, `src/admin/patients/AddTodo.jsx`, `src/admin/patients/AddedTodos.jsx`; modify `src/admin/calendar/AppointmentDialog.jsx` (use PatientPicker), `src/admin/patients/Todo.jsx`.

**Interfaces:**
- `PatientPicker({ value: { intakeId, patientName, patientKind }, onChange(value), label = "Patient or applicant", optional = false })` — search box until a patient is picked, then a chip with **Change**; loads intake records (not declined) on first focus.
- `AddTodo({ actor, onAdded(todo) })`.
- `AddedTodos({ todos, today, chartIds: Set<string>, actor, onChange(todo) })`.

- [ ] **Step 1: PatientPicker** — move the booking dialog's search/results/chip markup into `src/admin/ui/PatientPicker.jsx` unchanged in look: input (`inputClass`), results list with "No patient or applicant matches …", chip with **Change**. It owns `search` and the loaded records; `onChange({ intakeId, patientName, patientKind })` on pick, `onChange({ intakeId: "", patientName: "", patientKind: "" })` on Change. Label text is `label` plus " (optional)" when `optional`. In `AppointmentDialog.jsx`, render `<PatientPicker value={{ intakeId: form.intakeId, patientName: form.patientName, patientKind: form.patientKind }} onChange={(value) => set(value)} />` where the inline search was (only when `isNew && !prefill.intakeId`), keep the prefilled-patient chip as is, and remove the now-unused `patients`/`search`/`matches` state and the `loadIntakeRecords` effect from the dialog.

- [ ] **Step 2: AddTodo** — a card titled "Add a to-do": text input (placeholder "What needs doing?", `maxLength={500}`, Enter submits), a row with `PatientPicker` (optional) and `DatePicker` ("Due (optional)"), a **Just me / Everyone** chip group (`aria-label="Visible to"`, default Just me), and **Add** (disabled while `!text.trim()` or saving). On success: `onAdded(todo)`, reset the form, keep visibility. Errors stay in the card ("Couldn't add this. Try again."; permission → "Your role can't do this.").

- [ ] **Step 3: AddedTodos** — card titled "Added to-dos" with `groupTodos(todos, today)`; sections Overdue (title in `text-brand-dark`), Today, Next 7 days, Later, No date, then a **Done (n)** toggle (collapsed by default). Row: a real `<input type="checkbox">` (accent colour, `aria-label` = the text) → `setTodoDone(todo, !todo.done, actor)` then `onChange`; text (line-through and muted when done); patient: `Link` to `/admin/patients/{intakeId}` when `chartIds.has(intakeId)`, else plain name; due via `formatDay`; "Just me" or "Everyone"; "Added by {ownerName}" on shared items not mine; done rows "Done by {name}, {formatDay}" + **Undo**. Author's open items get **Edit**: the row turns into text + DatePicker + visibility chips + Save/Cancel → `editTodo`. Empty state: "Nothing added yet. Add a to-do above."

- [ ] **Step 4: Todo.jsx** — load `loadTodos(actor.uid)` beside the existing loads (its own state, so a failure shows "Couldn't load added to-dos" without hiding the automatic list); collect `chartIds` from `perChart`; render `<AddTodo>` then `<AddedTodos>` under the PageHeader (and under the dietitian switch), above the automatic groups and their empty state. `onAdded`/`onChange` update the todos state in place.

- [ ] **Step 5:** `npm run lint` (no new warnings), `npm run build`, `npm run check`; commit — "To-do: add your own to-dos, private or shared".

---

### Task 5: Verification

- [ ] `npm run check`, lint, build, rules tests (all pass).
- [ ] Demo server on :5180; Playwright at 1280×800 and 375×760, light and dark: add a private item with a patient and a past due date → shows in Overdue with the patient link; add a shared undated item; tick → moves to Done with "Done by …", Undo → back; Edit own item; as `?demoRole=dietitian` the shared items show, the admin's private one doesn't, and the automatic list is unchanged below; the booking dialog's patient search still works (existing dialog suite); no sideways scroll; no page errors. Stop the :5180 server.
