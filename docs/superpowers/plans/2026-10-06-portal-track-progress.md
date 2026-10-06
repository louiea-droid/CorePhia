# Portal Track Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patients see their weight over time (visit weights from signed notes plus weights they log at home) and their visit blood pressure and heart rate on `/account`; staff see the same on the chart.

**Architecture:** One subcollection `patients/{chartId}/progress`: visit entries written in the note-signing batch (rules check they match the note), home entries written by the linked patient, and a `baseline` doc copied from the intake. Pure arithmetic in `src/lib/progressMath.js`, one shared SVG `WeightChart`, a staff `ProgressCard` and a portal `PortalProgress` box.

**Tech Stack:** React 19, Tailwind v4, Firebase Firestore modular SDK v12, `@firebase/rules-unit-testing` + `node --test`, plain `node:assert` self-checks, Playwright in the session scratchpad.

**Spec:** `docs/superpowers/specs/2026-10-06-portal-track-progress-design.md`

## Global Constraints

- Progress entries are PHI (BAA note as for charts). No emails or alerts in this feature.
- Patient copy: "CorePhia", no em dashes, plain words, neutral about weight change. Nothing about medication.
- No new dependencies; the chart is plain SVG.
- Admin tokens and dark mode on the chart page (`text-accent-text` for blue text); site tokens on `/account`. Hover = colour only.
- Staff store functions have a `usingSeedData` branch (`getDemoStore()`, `demoId()`).
- Weight 50–800 lbs. Home date: today or up to 30 days back (rules allow a day's slack each way).
- Data shapes exactly as the spec's Data section. Visit id `visit-{noteId}`; baseline id `baseline`.
- Per CLAUDE.md, load the skills each task needs before it (UI: `frontend-design`, `ui-design-system`, `ui-ux-pro-max`; React: `react-best-practices`, `senior-frontend`; chart: `dataviz`; copy: `humanizer`; browser: `playwright-cli`; `superpowers:verification-before-completion` before calling it done). Louie runs the dev server.

## Review Focus

1. **A patient on a time zone behind UTC logging "today" late in the evening**: accepted (the rules' one-day slack). Pinned in Task 1 (date = yesterday UTC accepted).
2. **Intake with a goal range but no goal weight, or no height**: summary leaves out to-goal and BMI, never shows "NaN" or "0 lbs to goal". Pinned in Task 2 checks.
3. **A note signed with only blood pressure (no weight)**: visit entry written, chart skips it in the weight line, visit list shows BP. Pinned in Task 2 (`series` ignores null weights) and Task 4 browser check.
4. **Deleting the only home entry**: the portal box falls back to visits or the empty state without a broken chart. Pinned in Task 5 browser check.
5. **Two entries on the same date** (visit and home): both points drawn, stable order by `createdAt`, no overlapping labels breaking layout. Pinned in Task 2 (`series` order) and Task 4 screenshot.

---

### Task 1: Rules for `progress`

**Files:**
- Modify: `firestore.rules` (new `match /progress/{entryId}` inside `match /patients/{chartId}`, after the updates block)
- Test: `tests/firestore.rules.test.js` (new `describe("portal progress")`; header count)

**Interfaces:**
- Produces: the shapes in the spec; patient queries must filter `removed == false`; visit entries only inside the signing batch.

- [x] **Step 1: Write the failing tests.** Append:

```js
describe("portal progress", () => {
  const ref = (db, id, chart = "chart1") => doc(db, `patients/${chart}/progress/${id}`)
  const asPatient = (uid, email) => env.authenticatedContext(uid, { email }).firestore()
  const day = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
  const home = (overrides = {}) => ({ source: "home", date: day(0), weightLb: 182.5, createdAt: serverTimestamp(), removed: false, ...overrides })
  const seed = (id, data, chart = "chart1") => env.withSecurityRulesDisabled((c) => setDoc(ref(c.firestore(), id, chart), data))
  const vitals = { weightLb: 190, systolic: 120, diastolic: 80, heartRate: null }
  const visit = (overrides = {}) => ({ source: "visit", date: "2026-10-01", ...vitals, noteId: "draft1", createdAt: serverTimestamp(), removed: false, ...overrides })
  const signBatch = (db, entry, noteVitals = vitals) => {
    const batch = writeBatch(db)
    batch.update(doc(db, "patients/chart1/notes/draft1"), {
      vitals: noteVitals,
      status: "signed",
      signedAt: serverTimestamp(),
      signedBy: { uid: "provider", name: "provider", role: "provider" },
      updatedAt: serverTimestamp(),
    })
    batch.set(ref(db, "visit-draft1"), entry)
    return batch.commit()
  }

  test("a visit entry is written with the signature, matching the note", async () => {
    await assertSucceeds(signBatch(as("provider"), visit()))
  })
  test("a visit entry that doesn't match the note, or isn't signed with it, is refused", async () => {
    await assertFails(signBatch(as("provider"), visit({ weightLb: 150 })))
    await assertFails(signBatch(as("provider"), visit({ date: "2026-09-01" })))
    await assertFails(setDoc(ref(as("provider"), "visit-draft1"), visit()))
    await assertFails(setDoc(ref(as("provider"), "visit-other"), visit()))
    await assertFails(setDoc(ref(asPatient("patient1", "p1@x.co"), "visit-draft1"), visit()))
  })
  test("the linked patient logs a home weigh-in", async () => {
    await assertSucceeds(setDoc(ref(asPatient("patient1", "p1@x.co"), "h1"), home()))
    await assertSucceeds(setDoc(ref(asPatient("patient1", "p1@x.co"), "h2"), home({ date: day(-1) })))
    await assertSucceeds(setDoc(ref(asPatient("patient1", "p1@x.co"), "h3"), home({ date: day(-30), weightLb: 50 })))
  })
  test("home weigh-ins are checked: chart, range, date, shape, who", async () => {
    const db = asPatient("patient1", "p1@x.co")
    await assertFails(setDoc(ref(db, "x1", "pending1"), home()))
    await assertFails(setDoc(ref(db, "x2"), home({ weightLb: 49 })))
    await assertFails(setDoc(ref(db, "x3"), home({ weightLb: 801 })))
    await assertFails(setDoc(ref(db, "x4"), home({ weightLb: "180" })))
    await assertFails(setDoc(ref(db, "x5"), home({ date: day(-33) })))
    await assertFails(setDoc(ref(db, "x6"), home({ date: day(3) })))
    await assertFails(setDoc(ref(db, "x7"), home({ date: "10/06/2026" })))
    await assertFails(setDoc(ref(db, "x8"), home({ extra: 1 })))
    await assertFails(setDoc(ref(db, "x9"), home({ removed: true })))
    await assertFails(setDoc(ref(as("provider"), "x10"), home()))
    await assertFails(setDoc(ref(asPatient("stranger", "s@x.co"), "x11"), home()))
  })
  test("a patient deletes their own weigh-in once, and nothing else", async () => {
    await seed("h1", { ...home(), createdAt: new Date() })
    await seed("v1", { ...visit(), createdAt: new Date() })
    const db = asPatient("patient1", "p1@x.co")
    await assertFails(updateDoc(ref(db, "h1"), { removed: serverTimestamp(), weightLb: 100 }))
    await assertSucceeds(updateDoc(ref(db, "h1"), { removed: serverTimestamp() }))
    await assertFails(updateDoc(ref(db, "h1"), { removed: serverTimestamp() }))
    await assertFails(updateDoc(ref(db, "v1"), { removed: serverTimestamp() }))
    await assertFails(deleteDoc(ref(db, "v1")))
    await assertFails(updateDoc(ref(as("admin"), "v1"), { weightLb: 1 }))
  })
  test("the baseline matches the intake and never changes", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "intakeRecords", "chart1"), {
        status: "admitted",
        demographics: { email: "Pat@X.co " },
        vitals: { heightFeet: "5", heightInches: "10", currentWeightLb: "210", goalWeightLb: "" },
      }),
    )
    const baseline = { source: "baseline", heightFeet: "5", heightInches: "10", currentWeightLb: "210", goalWeightLb: "", removed: false }
    await assertFails(setDoc(ref(as("provider"), "baseline"), { ...baseline, currentWeightLb: "200" }))
    await assertFails(setDoc(ref(asPatient("patient1", "p1@x.co"), "baseline"), baseline))
    await assertSucceeds(setDoc(ref(as("dietitian"), "baseline"), baseline))
    await assertFails(updateDoc(ref(as("admin"), "baseline"), { goalWeightLb: "180" }))
  })
  test("a patient reads their own live entries; staff read everything", async () => {
    await seed("live", { ...home(), createdAt: new Date() })
    await seed("gone", { ...home(), createdAt: new Date(), removed: new Date() })
    await seed("other", { ...home(), createdAt: new Date() }, "pending1")
    const db = asPatient("patient1", "p1@x.co")
    await assertSucceeds(getDoc(ref(db, "live")))
    await assertFails(getDoc(ref(db, "gone")))
    await assertSucceeds(getDocs(query(collection(db, "patients/chart1/progress"), where("removed", "==", false))))
    await assertFails(getDocs(collection(db, "patients/chart1/progress")))
    await assertFails(getDoc(ref(db, "other", "pending1")))
    await assertFails(getDoc(ref(env.unauthenticatedContext().firestore(), "live")))
    await assertSucceeds(getDocs(collection(as("dietitian"), "patients/chart1/progress")))
  })
})
```

- [x] **Step 2: Run, see the allow-cases fail.** `npm run test:rules` (output to a log, read the summary). Expected: the "written with the signature", "logs a home weigh-in", "deletes", "baseline" and "reads" tests FAIL; the pure-deny test passes.

- [x] **Step 3: Add the rules.** After the `updates` block, still inside `match /patients/{chartId}`:

```
      // Track progress (spec 2026-10-06-portal-track-progress-design). Visit
      // entries are written in the note-signing batch and must carry exactly
      // the signed note's date and vitals. Home entries are the linked
      // patient's own weigh-ins, which they can mark removed (never erase).
      // The baseline is the intake's height and weights, copied as-is by
      // staff. The patient reads what isn't removed, so their query must
      // filter removed == false.
      match /progress/{entryId} {
        function isLinkedPatient() {
          return request.auth != null
            && get(/databases/$(database)/documents/patientAccounts/$(request.auth.uid)).data.intakeId == chartId;
        }
        function isRecentDay(day) {
          let parts = day.split('-');
          let at = timestamp.date(int(parts[0]), int(parts[1]), int(parts[2]));
          return day.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
            && at <= request.time + duration.value(1, 'd')
            && at >= request.time - duration.value(31, 'd');
        }
        function isVisitEntry() {
          let data = request.resource.data;
          let note = getAfter(/databases/$(database)/documents/patients/$(chartId)/notes/$(data.noteId)).data;
          return data.keys().hasOnly(['source', 'date', 'weightLb', 'systolic', 'diastolic', 'heartRate', 'noteId', 'createdAt', 'removed'])
            && data.keys().hasAll(['source', 'date', 'weightLb', 'systolic', 'diastolic', 'heartRate', 'noteId', 'createdAt', 'removed'])
            && data.source == 'visit'
            && data.noteId is string
            && entryId == 'visit-' + data.noteId
            && note.status == 'signed'
            && data.date == note.visitDate
            && data.weightLb == note.vitals.get('weightLb', null)
            && data.systolic == note.vitals.get('systolic', null)
            && data.diastolic == note.vitals.get('diastolic', null)
            && data.heartRate == note.vitals.get('heartRate', null)
            && data.createdAt == request.time
            && data.removed == false;
        }
        function isHomeEntry() {
          let data = request.resource.data;
          return data.keys().hasOnly(['source', 'date', 'weightLb', 'createdAt', 'removed'])
            && data.keys().hasAll(['source', 'date', 'weightLb', 'createdAt', 'removed'])
            && data.source == 'home'
            && data.weightLb is number && data.weightLb >= 50 && data.weightLb <= 800
            && data.date is string && isRecentDay(data.date)
            && data.createdAt == request.time
            && data.removed == false;
        }
        function isBaseline() {
          let data = request.resource.data;
          let intake = get(/databases/$(database)/documents/intakeRecords/$(chartId)).data.get('vitals', {});
          return entryId == 'baseline'
            && data.keys().hasOnly(['source', 'heightFeet', 'heightInches', 'currentWeightLb', 'goalWeightLb', 'removed'])
            && data.keys().hasAll(['source', 'heightFeet', 'heightInches', 'currentWeightLb', 'goalWeightLb', 'removed'])
            && data.source == 'baseline'
            && data.heightFeet == intake.get('heightFeet', '')
            && data.heightInches == intake.get('heightInches', '')
            && data.currentWeightLb == intake.get('currentWeightLb', '')
            && data.goalWeightLb == intake.get('goalWeightLb', '')
            && data.removed == false;
        }
        function isRemoval() {
          return resource.data.source == 'home'
            && resource.data.removed == false
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['removed'])
            && request.resource.data.removed == request.time;
        }
        allow read: if isClinical() || (resource.data.removed == false && isLinkedPatient());
        allow create: if (isClinical() && (isVisitEntry() || isBaseline())) || (isLinkedPatient() && isHomeEntry());
        allow update: if isLinkedPatient() && isRemoval();
        allow delete: if false;
      }
```

- [x] **Step 4: Run.** `npm run test:rules`. Expected: all pass (109 = 102 + 7). Update the header comment in `tests/firestore.rules.test.js`: list "portal progress", "All 109 passed on <today>".

- [x] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.js
git commit -m "Rules: portal progress (visit entries with the signature, home weigh-ins, baseline)"
```

---

### Task 2: `progressMath`

**Files:**
- Create: `src/lib/progressMath.js`, `src/lib/progressMath.check.js`
- Modify: `package.json` (`check` script: append `&& node src/lib/progressMath.check.js`)

**Interfaces:**
- Produces:
  - `toNumbers(baseline) → { startWeightLb, goalWeightLb, heightIn }` (numbers or null)
  - `series(entries) → [{ id, date, weightLb, source }]` live visit/home entries with a weight, by date then `createdAt`
  - `summary(entries, baseline) → { latestLb, startLb, goalLb, changeLb, toGoalLb, bmi }` (numbers or null, one decimal)
  - `visitEntryFor(note) → { source: "visit", date, weightLb, systolic, diastolic, heartRate, noteId, removed: false } | null` (`note` needs `id`, `visitDate`, `vitals`)
  - `withinDays(date, today, days) → boolean` for the log form (YYYY-MM-DD strings)

- [x] **Step 1: Write the failing checks** in `src/lib/progressMath.check.js`:

```js
// Self-check for progressMath.js: `npm run check`. Plain node:assert.
import assert from "node:assert/strict"
import { series, summary, toNumbers, visitEntryFor, withinDays } from "./progressMath.js"

const at = (iso) => ({ toMillis: () => new Date(iso).getTime() })
const home = (id, date, weightLb, extra = {}) => ({ id, source: "home", date, weightLb, createdAt: at(`${date}T12:00:00Z`), removed: false, ...extra })
const visit = (id, date, weightLb, extra = {}) => ({ id, source: "visit", date, weightLb, systolic: 120, diastolic: 80, heartRate: 70, createdAt: at(`${date}T09:00:00Z`), removed: false, ...extra })
const baseline = (overrides = {}) => ({ source: "baseline", heightFeet: "5", heightInches: "10", currentWeightLb: "210", goalWeightLb: "180", removed: false, ...overrides })

// The intake's strings become numbers; blanks become null.
assert.deepEqual(toNumbers(baseline()), { startWeightLb: 210, goalWeightLb: 180, heightIn: 70 })
assert.deepEqual(toNumbers(baseline({ goalWeightLb: "", heightFeet: "" })), { startWeightLb: 210, goalWeightLb: null, heightIn: null })
assert.deepEqual(toNumbers(baseline({ heightInches: "" })).heightIn, 60)
assert.deepEqual(toNumbers(null), { startWeightLb: null, goalWeightLb: null, heightIn: null })

// Series: live weights only, by date then time logged; baseline, removed and weightless entries skipped.
const entries = [
  home("h2", "2026-10-05", 201),
  visit("v1", "2026-10-01", 205),
  visit("v2", "2026-10-05", 202),
  home("gone", "2026-10-03", 150, { removed: at("2026-10-04T00:00:00Z") }),
  visit("bp", "2026-10-04", null),
  baseline(),
]
assert.deepEqual(series(entries).map((point) => point.id), ["v1", "v2", "h2"])

// Summary from the baseline start weight.
assert.deepEqual(summary(entries, baseline()), { latestLb: 201, startLb: 210, goalLb: 180, changeLb: -9, toGoalLb: 21, bmi: 28.8 })
// No baseline: start is the earliest weight; no goal or BMI.
assert.deepEqual(summary(entries, null), { latestLb: 201, startLb: 205, goalLb: null, changeLb: -4, toGoalLb: null, bmi: null })
// At or under the goal: 0 to go.
assert.equal(summary([home("h", "2026-10-05", 175)], baseline()).toGoalLb, 0)
// Nothing logged: only the baseline numbers.
assert.deepEqual(summary([], baseline()), { latestLb: null, startLb: 210, goalLb: 180, changeLb: null, toGoalLb: null, bmi: null })

// Visit entry from a note: its date and four numbers, or null with none.
assert.deepEqual(visitEntryFor({ id: "n1", visitDate: "2026-10-05", vitals: { weightLb: 200, systolic: 118, diastolic: null, heartRate: undefined } }), {
  source: "visit",
  date: "2026-10-05",
  weightLb: 200,
  systolic: 118,
  diastolic: null,
  heartRate: null,
  noteId: "n1",
  removed: false,
})
assert.equal(visitEntryFor({ id: "n2", visitDate: "2026-10-05", vitals: { weightLb: null } }), null)
assert.equal(visitEntryFor({ id: "n3", visitDate: "2026-10-05" }), null)

// The log form's date window.
assert.equal(withinDays("2026-10-06", "2026-10-06", 30), true)
assert.equal(withinDays("2026-09-06", "2026-10-06", 30), true)
assert.equal(withinDays("2026-09-05", "2026-10-06", 30), false)
assert.equal(withinDays("2026-10-07", "2026-10-06", 30), false)
assert.equal(withinDays("", "2026-10-06", 30), false)

console.log("progressMath: all checks passed")
```

Append ` && node src/lib/progressMath.check.js` to the `check` script in `package.json`.

- [x] **Step 2: Run.** `npm run check`. Expected: FAIL, cannot find `./progressMath.js`.

- [x] **Step 3: Implement** `src/lib/progressMath.js`:

```js
// Track progress arithmetic, shared by the admin chart and the patient
// portal. No React or Firebase, so progressMath.check.js runs under plain node.

// The intake stores numbers as text; "" or junk becomes null.
const num = (value) => {
  if (value === "" || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value ? new Date(value).getTime() : 0)
const round1 = (n) => Math.round(n * 10) / 10

export function toNumbers(baseline) {
  if (!baseline) return { startWeightLb: null, goalWeightLb: null, heightIn: null }
  const feet = num(baseline.heightFeet)
  return {
    startWeightLb: num(baseline.currentWeightLb),
    goalWeightLb: num(baseline.goalWeightLb),
    heightIn: feet ? feet * 12 + (num(baseline.heightInches) ?? 0) : null,
  }
}

// The weights to draw: visit and home entries not removed and with a weight,
// oldest first; same day, in the order they were recorded.
export function series(entries) {
  return entries
    .filter((entry) => (entry.source === "visit" || entry.source === "home") && !entry.removed && entry.weightLb != null)
    .sort((a, b) => a.date.localeCompare(b.date) || millis(a.createdAt) - millis(b.createdAt))
    .map(({ id, date, weightLb, source }) => ({ id, date, weightLb, source }))
}

// The headline numbers. Start is the intake weight, else the first weight on
// record. Anything that can't be worked out is null.
export function summary(entries, baseline) {
  const points = series(entries)
  const { startWeightLb, goalWeightLb, heightIn } = toNumbers(baseline)
  const latestLb = points.at(-1)?.weightLb ?? null
  const startLb = startWeightLb ?? points[0]?.weightLb ?? null
  return {
    latestLb,
    startLb,
    goalLb: goalWeightLb,
    changeLb: latestLb != null && startLb != null ? round1(latestLb - startLb) : null,
    toGoalLb: latestLb != null && goalWeightLb != null ? round1(Math.max(0, latestLb - goalWeightLb)) : null,
    bmi: latestLb != null && heightIn ? round1((703 * latestLb) / heightIn ** 2) : null,
  }
}

// The progress entry a signed note produces (firestore.rules checks it
// matches), or null when the note recorded none of the four numbers.
export function visitEntryFor(note) {
  const vitals = note?.vitals ?? {}
  const numbers = {
    weightLb: vitals.weightLb ?? null,
    systolic: vitals.systolic ?? null,
    diastolic: vitals.diastolic ?? null,
    heartRate: vitals.heartRate ?? null,
  }
  if (Object.values(numbers).every((value) => value == null)) return null
  return { source: "visit", date: note.visitDate, ...numbers, noteId: note.id, removed: false }
}

// Is YYYY-MM-DD `date` between `days` before `today` and `today`?
export function withinDays(date, today, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return false
  const utc = (iso) => Date.UTC(...iso.split("-").map((part, index) => Number(part) - (index === 1 ? 1 : 0)))
  const diff = Math.round((utc(today) - utc(date)) / 86_400_000)
  return diff >= 0 && diff <= days
}
```

- [x] **Step 4: Run.** `npm run check` → every file prints "all checks passed".

- [x] **Step 5: Commit**

```bash
git add src/lib/progressMath.js src/lib/progressMath.check.js package.json
git commit -m "Progress: progressMath (series, summary, visit entry, date window)"
```

---

### Task 3: Staff store and the signing batch

**Files:**
- Create: `src/admin/patients/progressStore.js`
- Modify: `src/admin/patients/chartStore.js` (`signNote`: add the visit entry to the batch and the demo branch)

No unit test (imports Firebase). Pinned by Task 1's batch test (same document shape) and Task 4's browser check.

**Interfaces:**
- Consumes: `visitEntryFor` (Task 2).
- Produces:
  - `loadProgress(chartId) → Promise<{ entries: Entry[], baseline: Baseline | null }>` (staff: everything, removed included)
  - `ensureBaseline(chartId, intake) → Promise<void>` (writes `baseline` from `intake.vitals` once; no-op if it exists or there's no intake)
  - Demo store key `store.progress: Map<chartId, Entry[]>`; first read for a chart fills it from that chart's signed notes via `visitEntryFor`.

- [x] **Step 1: Create `progressStore.js`:**

```js
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
```

- [x] **Step 2: `signNote`.** In `chartStore.js` add `import { visitEntryFor } from "../../lib/progressMath"`. In the demo branch, after the `Object.assign(store.charts.get(chartId), …)` line:

```js
    const entry = visitEntryFor({ ...fields, id: noteId })
    if (entry) {
      const { demoProgress } = await import("./progressStore")
      const list = await demoProgress(chartId)
      // A first read just now already built it from the signed notes.
      if (!list.some((existing) => existing.id === `visit-${noteId}`)) list.push({ id: `visit-${noteId}`, ...entry, createdAt: signedAt })
    }
```

(Dynamic import: `progressStore` imports `chartStore`, so a static import back would be circular.)

In the live branch, before `await batch.commit()`:

```js
  // The patient's progress gets this visit's numbers in the same commit, so a
  // signed note and its entry can't disagree (firestore.rules checks they match).
  const entry = visitEntryFor({ ...fields, id: noteId })
  if (entry) batch.set(doc(database, PATIENTS_COLLECTION, chartId, "progress", `visit-${noteId}`), { ...entry, createdAt: serverTimestamp() })
```

- [x] **Step 3: Verify.** `npm run lint` (no new errors), `npm run build` succeeds, `npm run check` passes.

- [x] **Step 4: Commit**

```bash
git add src/admin/patients/progressStore.js src/admin/patients/chartStore.js
git commit -m "Progress: staff store, baseline from the intake, visit entry in the signing batch"
```

---

### Task 4: `WeightChart` and the chart's Progress card

**Files:**
- Create: `src/components/WeightChart.jsx`, `src/admin/patients/ProgressCard.jsx`
- Modify: `src/admin/patients/PatientChart.jsx` (mount the card under `UpdatesCard`), `src/admin/patients/NoteEditor.jsx` (sign confirmation line)
- Test: `<scratchpad>/progress-chart-check.mjs`

Load `dataviz` before the chart.

**Interfaces:**
- Consumes: `series`, `summary`, `visitEntryFor` (Task 2); `loadProgress`, `ensureBaseline` (Task 3).
- Produces: `<WeightChart points goalLb />` where `points` is `series(...)` output and `goalLb` a number or null. Renders nothing for no points.

- [x] **Step 1: Browser check first.** `<scratchpad>/progress-chart-check.mjs`, same harness as `updates-check.mjs` (route `firebase.js` to force `usingSeedData = true`; open the first admitted seed chart with an email; `ctx.addInitScript` for the dark theme). Card locator: `page.getByRole("region", { name: "Progress" })`. Cases:
  1. Seeded chart: card shows "Starting weight", "Latest weight", "Lost so far" (or "Change"), an `svg` with at least 2 `circle` elements, the key text "Visit" and "Logged at home".
  2. "Show all entries" lists visit rows with "BP" and a "From the … " source line.
  3. Inject a home entry and a removed home entry into the demo store (same `performance.getEntriesByType` trick as `updates-check.mjs` case 9, importing `progressStore.js` and pushing to `await demoProgress(id)`), reload the chart client-side → hollow point present, and the list shows "Logged at home" and "Deleted by patient on".
  4. New progress note with weight 199 → sign confirmation shows "The weight, blood pressure and heart rate also go to the patient's progress."; after signing, "Latest weight" reads 199 lbs.
  5. New progress note with only BP 118/76 (no weight) → the line shows; after signing, "Latest weight" is unchanged and "Show all entries" lists "BP 118/76" with no weight.
  5b. New progress note with no vitals → the sign confirmation has no such line.
  6. A chart whose demo progress is emptied → "No weights yet. Weights from signed notes and the patient's own weigh-ins show here."
  7. Screenshots light, dark, 390 px (no horizontal scroll). Read them.

Run: expected FAIL (no card).

- [x] **Step 2: `WeightChart.jsx`:**

```jsx
import { useState } from "react"

const W = 600
const H = 220
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }
const utc = (iso) => Date.UTC(...iso.split("-").map((part, index) => Number(part) - (index === 1 ? 1 : 0)))
const label = (iso) => new Date(utc(iso)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
const longLabel = (iso) => new Date(utc(iso)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
const SOURCE = { visit: "Visit", home: "Logged at home" }

// Weight over time for the chart page and the patient portal. Visit points
// solid, home points hollow, goal dashed. Colours are theme tokens, so it
// follows the admin's dark mode and the site's palette. Each point is
// focusable; the line under the chart reads out the focused (or latest) one.
export default function WeightChart({ points, goalLb = null }) {
  const [active, setActive] = useState(null)
  if (!points.length) return null

  const weights = points.map((point) => point.weightLb).concat(goalLb ?? [])
  const low = Math.floor(Math.min(...weights) - 5)
  const high = Math.ceil(Math.max(...weights) + 5)
  const first = utc(points[0].date)
  const span = Math.max(utc(points.at(-1).date) - first, 1)
  const x = (iso) => (points.length === 1 ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((utc(iso) - first) / span) * (W - PAD.left - PAD.right))
  const y = (lb) => PAD.top + ((high - lb) / (high - low)) * (H - PAD.top - PAD.bottom)
  const ticks = [high, Math.round((high + low) / 2), low]
  const shown = points[active ?? points.length - 1]

  return (
    <figure className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weight over time">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-ink-950/10" />
            <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-ink-950/50 text-[11px]">
              {tick}
            </text>
          </g>
        ))}
        {goalLb != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(goalLb)} y2={y(goalLb)} strokeDasharray="6 5" className="stroke-ink-950/45" />
            <text x={W - PAD.right} y={y(goalLb) - 6} textAnchor="end" className="fill-ink-950/60 text-[11px]">
              Goal {goalLb} lbs
            </text>
          </g>
        )}
        {points.length > 1 && (
          <polyline
            points={points.map((point) => `${x(point.date)},${y(point.weightLb)}`).join(" ")}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            className="stroke-accent-dark"
          />
        )}
        {points.map((point, index) => (
          <circle
            key={point.id}
            cx={x(point.date)}
            cy={y(point.weightLb)}
            r={index === active ? 7 : 5}
            strokeWidth="2"
            tabIndex={0}
            aria-label={`${longLabel(point.date)}, ${point.weightLb} lbs, ${SOURCE[point.source]}`}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            className={`cursor-pointer stroke-accent-dark outline-none ${point.source === "home" ? "fill-white" : "fill-accent-dark"}`}
          />
        ))}
        <text x={PAD.left} y={H - 8} className="fill-ink-950/50 text-[11px]">
          {label(points[0].date)}
        </text>
        {points.length > 1 && (
          <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-ink-950/50 text-[11px]">
            {label(points.at(-1).date)}
          </text>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-950/60">
        <span aria-live="polite">
          {longLabel(shown.date)}: {shown.weightLb} lbs, {SOURCE[shown.source].toLowerCase()}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-accent-dark" aria-hidden="true" />
            Visit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-accent-dark" aria-hidden="true" />
            Logged at home
          </span>
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Weights</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <td>{longLabel(point.date)}</td>
              <td>{point.weightLb} lbs</td>
              <td>{SOURCE[point.source]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
```

- [x] **Step 3: `ProgressCard.jsx`:**

```jsx
import { useEffect, useState } from "react"
import WeightChart from "../../components/WeightChart"
import { series, summary } from "../../lib/progressMath"
import { NOTE_TYPE_LABELS, formatDay } from "./noteUi"
import { ensureBaseline, loadProgress } from "./progressStore"

const lbs = (n) => `${n} lbs`

// The chart's Track progress card: what the patient sees in their portal,
// plus deleted home entries, greyed. Reloads when `version` changes (a note
// was signed). Writes the baseline from the intake the first time.
export default function ProgressCard({ chartId, intake, notes, version }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let live = true
    ensureBaseline(chartId, intake)
      .catch((cause) => console.error("Could not save the progress baseline:", cause.code ?? cause.message))
      .then(() => loadProgress(chartId))
      .then(
        (next) => {
          if (!live) return
          setData(next)
          setFailed(false)
        },
        (cause) => {
          console.error("Could not load progress:", cause.code ?? cause.message)
          if (live) setFailed(true)
        },
      )
    return () => {
      live = false
    }
  }, [chartId, intake, version])

  const points = data ? series(data.entries) : []
  const numbers = data ? summary(data.entries, data.baseline) : null
  const listed = data ? [...data.entries].sort((a, b) => b.date.localeCompare(a.date)) : []
  const noteOf = (id) => notes?.find((note) => note.id === id)
  const stats = numbers
    ? [
        ["Starting weight", numbers.startLb != null && lbs(numbers.startLb)],
        ["Latest weight", numbers.latestLb != null && lbs(numbers.latestLb)],
        ["Change", numbers.changeLb != null && `${numbers.changeLb > 0 ? "+" : ""}${lbs(numbers.changeLb)}`],
        ["To goal", numbers.toGoalLb != null && lbs(numbers.toGoalLb)],
        ["BMI", numbers.bmi],
      ].filter(([, value]) => value != null && value !== false)
    : []

  return (
    <section aria-labelledby="progress-heading" className="rounded-2xl border border-ink-950/10 bg-white p-5">
      <h2 id="progress-heading" className="text-sm font-semibold text-ink-950">
        Progress
      </h2>
      <div className="mt-3 text-sm">
        {failed ? (
          <p className="text-brand-dark">Couldn't load progress.</p>
        ) : !data ? (
          <p className="text-ink-950/50">Loading…</p>
        ) : !listed.length ? (
          <p className="text-ink-950/55">No weights yet. Weights from signed notes and the patient's own weigh-ins show here.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {stats.map(([term, value]) => (
                <div key={term}>
                  <dt className="text-xs text-ink-950/55">{term}</dt>
                  <dd className="font-semibold text-ink-950">{value}</dd>
                </div>
              ))}
            </dl>
            <WeightChart points={points} goalLb={numbers.goalLb} />
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((open) => !open)}
              className="mt-3 cursor-pointer text-xs font-semibold text-accent-text hover:underline"
            >
              {showAll ? "Hide entries" : "Show all entries"}
            </button>
            {showAll && (
              <ol className="mt-2 divide-y divide-ink-950/10">
                {listed.map((entry) => {
                  const note = entry.source === "visit" && noteOf(entry.noteId)
                  return (
                    <li key={entry.id} className={`py-2 ${entry.removed ? "opacity-55" : ""}`}>
                      <p className="text-ink-950">
                        <span className="font-medium">{formatDay(entry.date)}</span>
                        {": "}
                        {[
                          entry.weightLb != null && lbs(entry.weightLb),
                          entry.systolic != null && entry.diastolic != null && `BP ${entry.systolic}/${entry.diastolic}`,
                          entry.heartRate != null && `HR ${entry.heartRate}`,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="text-xs text-ink-950/55">
                        {entry.source === "home"
                          ? entry.removed
                            ? `Logged at home. Deleted by patient on ${formatDay(entry.removed)}`
                            : "Logged at home"
                          : note
                            ? `From the ${formatDay(note.visitDate)} ${NOTE_TYPE_LABELS[note.type]?.toLowerCase() ?? "note"}`
                            : "From a visit"}
                      </p>
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  )
}
```

- [x] **Step 4: PatientChart.** Import `ProgressCard`; under the `<UpdatesCard … />`:

```jsx
          <ProgressCard key={`progress-${chart.id}`} chartId={chart.id} intake={intake} notes={notes} version={signedNotes.length} />
```

- [x] **Step 5: NoteEditor.** Import `visitEntryFor` from `../../lib/progressMath`. Inside the sign `ConfirmDialog` children, before the share label:

```jsx
        {visitEntryFor({ ...fields, id: note.id }) && (
          <p className="mt-3 text-sm text-ink-950/60">The weight, blood pressure and heart rate also go to the patient's progress.</p>
        )}
```

- [x] **Step 6: Run the browser check** → all pass; read the screenshots. `npm run lint`, `npm run build`, `npm run check`.

- [x] **Step 7: Commit**

```bash
git add src/components/WeightChart.jsx src/admin/patients/ProgressCard.jsx src/admin/patients/PatientChart.jsx src/admin/patients/NoteEditor.jsx
git commit -m "Chart: Progress card with the weight chart; signing says the numbers go to the portal"
```

---

### Task 5: Portal Track progress box

**Files:**
- Modify: `src/portal/lib/patientAuth.js` (`getMyProgress`, `logWeight`, `deleteWeighIn`)
- Create: `src/portal/progress/PortalProgress.jsx`, `src/portal/progress/LogWeightForm.jsx`
- Modify: `src/portal/PortalHome.jsx` (mount above Updates; drop Track progress from `COMING_SOON`)
- Test: `<scratchpad>/portal-progress-check.mjs`; update `<scratchpad>/portal-updates-check.mjs` (coming-soon now two items; stub gains the three functions)

**Interfaces:**
- Consumes: `series`, `summary`, `withinDays` (Task 2); `WeightChart` (Task 4).
- Produces:
  - `getMyProgress(intakeId) → Promise<{ entries, baseline }>` (live only)
  - `logWeight(intakeId, { date, weightLb }) → Promise<void>`
  - `deleteWeighIn(intakeId, entryId) → Promise<void>`

- [x] **Step 1: Browser check first.** `<scratchpad>/portal-progress-check.mjs`, same stub approach as `portal-updates-check.mjs` (route `**/src/portal/lib/patientAuth.js*`). The stub keeps an in-page array so log and delete really change what `getMyProgress` returns:

```js
const stub = (mode) => `
export const isConfigured = true
const user = { uid: "u", email: "p@x.co" }
const today = new Date().toLocaleDateString("en-CA")
let entries = "${mode}" === "empty" ? [] : [
  { id: "visit-n1", source: "visit", date: "2026-09-01", weightLb: 210, systolic: 132, diastolic: 84, heartRate: 76, removed: false },
  { id: "visit-n2", source: "visit", date: "2026-09-29", weightLb: 202, systolic: 124, diastolic: 80, heartRate: 72, removed: false },
  { id: "h1", source: "home", date: "2026-10-03", weightLb: 199.5, removed: false },
]
const baseline = { source: "baseline", heightFeet: "5", heightInches: "10", currentWeightLb: "214", goalWeightLb: "180", removed: false }
window.__logged = []
export function watchPatientUser(cb) { queueMicrotask(() => cb(user)); return () => {} }
export async function getMyPortalLink() { return { intakeId: "i1", firstName: "Maria" } }
export async function getMyUpdates() { return [] }
export async function getMyProgress() {
  if ("${mode}" === "error") throw Object.assign(new Error("denied"), { code: "permission-denied" })
  return { entries: entries.filter((e) => !e.removed).map((e) => ({ ...e })), baseline: "${mode}" === "empty" ? null : baseline }
}
export async function logWeight(intakeId, { date, weightLb }) {
  if ("${mode}" === "saveFails") throw new Error("offline")
  window.__logged.push({ date, weightLb })
  entries.push({ id: "new" + entries.length, source: "home", date, weightLb, removed: false })
}
export async function deleteWeighIn(intakeId, id) { entries = entries.map((e) => (e.id === id ? { ...e, removed: true } : e)) }
export async function signInPatient() { return user }
export async function resetPatientPassword() {}
export async function signOutPatient() {}
`
```

Region locator: `page.getByRole("region", { name: "Track progress" })`. Cases:
1. `list`: region is above the Updates region; text has "199.5 lbs", "Down 14.5 lbs since you started", "19.5 lbs to your goal"; chart `svg` with 3 circles; "From your visits" lists "BP 124/80" and "HR 72"; "Your weigh-ins" lists one entry with Delete; "Coming to your portal" has 2 items and no "Track progress".
2. Log: **Log your weight** → fill 198 → **Save** → `window.__logged` has `{ date: today, weightLb: 198 }`; text shows "198 lbs" and "Down 16 lbs since you started".
3. Out of range: fill 1850 → Save → "Check the number. Weights between 50 and 800 lbs can be saved."; nothing logged; value kept.
4. Date limits: the date input's `max` is today and `min` is 30 days back.
5. `saveFails`: Save → "Couldn't save your weigh-in. Try again."; value kept.
6. Delete: click Delete → confirm text "Delete this weigh-in? Your care team will still see that it was deleted." → confirm → "Your weigh-ins" section gone (no home entries), chart still drawn from visits.
7. `empty`: "Your weight from each visit will show here. You can also log your own weigh-ins."; Log your weight still offered.
8. `error`: "We couldn't load your progress." and Try again.
9. 390 px: no horizontal scroll; screenshots at 1280 and 390, read them.

Run: expected FAIL.

- [x] **Step 2: `patientAuth.js`.** Extend the firestore import with `addDoc, updateDoc`. After `getMyUpdates`:

```js
// The patient's progress: visit and home entries plus the intake baseline,
// only what isn't removed (the rules refuse any query that could return a
// removed entry).
export async function getMyProgress(intakeId) {
  if (!db) return { entries: [], baseline: null }
  const snap = await getDocs(query(collection(db, "patients", intakeId, "progress"), where("removed", "==", false)))
  const all = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
  return { entries: all.filter((entry) => entry.source !== "baseline"), baseline: all.find((entry) => entry.source === "baseline") ?? null }
}

export async function logWeight(intakeId, { date, weightLb }) {
  await addDoc(collection(db, "patients", intakeId, "progress"), {
    source: "home",
    date,
    weightLb,
    createdAt: serverTimestamp(),
    removed: false,
  })
}

// Hidden from the patient; staff still see it, marked deleted.
export async function deleteWeighIn(intakeId, entryId) {
  await updateDoc(doc(db, "patients", intakeId, "progress", entryId), { removed: serverTimestamp() })
}
```

- [x] **Step 3: `LogWeightForm.jsx`:**

```jsx
import { useState } from "react"
import { withinDays } from "../../lib/progressMath"
import { logWeight } from "../lib/patientAuth"

const isoDay = (date) => date.toLocaleDateString("en-CA")
const field =
  "w-full rounded-xl border border-ink-950/15 bg-white px-3 py-2.5 text-ink-950 outline-none transition-colors duration-200 focus:border-ink-950/45"

export default function LogWeightForm({ intakeId, onSaved, onCancel }) {
  const today = isoDay(new Date())
  const earliest = isoDay(new Date(Date.now() - 30 * 86_400_000))
  const [weight, setWeight] = useState("")
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const weightLb = Number(weight)
    if (!weight || !Number.isFinite(weightLb) || weightLb < 50 || weightLb > 800) {
      return setError("Check the number. Weights between 50 and 800 lbs can be saved.")
    }
    if (!withinDays(date, today, 30)) return setError("Pick a date in the last 30 days.")
    setBusy(true)
    setError(null)
    try {
      await logWeight(intakeId, { date, weightLb: Math.round(weightLb * 10) / 10 })
      onSaved()
    } catch {
      setError("Couldn't save your weigh-in. Try again.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 rounded-2xl bg-paper-100 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-950/75">Weight (lbs)</span>
          <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-950/75">Date</span>
          <input type="date" value={date} min={earliest} max={today} onChange={(event) => setDate(event.target.value)} className={field} />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-dark">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold text-ink-950/70 transition-colors duration-200 hover:bg-paper-200"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

(No `min`/`max` on the weight input, so an out-of-range number reaches our message instead of the browser's.)

- [x] **Step 4: `PortalProgress.jsx`:**

```jsx
import { useEffect, useState } from "react"
import WeightChart from "../../components/WeightChart"
import { series, summary } from "../../lib/progressMath"
import { deleteWeighIn, getMyProgress } from "../lib/patientAuth"
import LogWeightForm from "./LogWeightForm"

const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

function changeLine(changeLb) {
  if (changeLb == null) return null
  if (changeLb === 0) return "Same as when you started"
  return `${changeLb < 0 ? "Down" : "Up"} ${Math.abs(changeLb)} lbs since you started`
}

// The portal's Track progress box: visit weights and the patient's own
// weigh-ins on one chart, visit BP and heart rate, and logging a weigh-in.
export default function PortalProgress({ intakeId }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null) // { attempt, data } | { attempt, failed }
  const [logging, setLogging] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    let live = true
    getMyProgress(intakeId).then(
      (data) => live && setResult({ attempt, data }),
      (cause) => {
        console.error("Could not load progress:", cause.code ?? cause.message)
        if (live) setResult({ attempt, failed: true })
      },
    )
    return () => {
      live = false
    }
  }, [intakeId, attempt])

  const current = result?.attempt === attempt ? result : null
  const reload = () => setAttempt((n) => n + 1)
  const entries = current?.data?.entries ?? []
  const points = series(entries)
  const numbers = current?.data ? summary(entries, current.data.baseline) : null
  const visits = entries.filter((entry) => entry.source === "visit").sort((a, b) => b.date.localeCompare(a.date))
  const weighIns = entries.filter((entry) => entry.source === "home").sort((a, b) => b.date.localeCompare(a.date))

  const confirmDelete = async () => {
    try {
      await deleteWeighIn(intakeId, deleting.id)
      setDeleteError(null)
      setDeleting(null)
      reload()
    } catch {
      setDeleteError("Couldn't delete that weigh-in. Try again.")
      setDeleting(null)
    }
  }

  return (
    <section id="progress" aria-labelledby="progress-heading" className="scroll-mt-24 rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="progress-heading" className="font-serif text-2xl text-ink-950">
          Track progress
        </h2>
        {current?.data && !logging && (
          <button
            type="button"
            onClick={() => setLogging(true)}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
          >
            Log your weight
          </button>
        )}
      </div>

      {logging && (
        <LogWeightForm
          intakeId={intakeId}
          onCancel={() => setLogging(false)}
          onSaved={() => {
            setLogging(false)
            reload()
          }}
        />
      )}

      {!current ? (
        <p className="mt-6 text-sm text-ink-950/60">Loading your progress…</p>
      ) : current.failed ? (
        <div className="mt-6">
          <p className="text-ink-950/75">We couldn't load your progress.</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 cursor-pointer rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
          >
            Try again
          </button>
        </div>
      ) : !entries.length ? (
        <p className="mt-6 max-w-prose text-ink-950/70">Your weight from each visit will show here. You can also log your own weigh-ins.</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            {numbers.latestLb != null && <p className="font-serif text-4xl text-ink-950">{numbers.latestLb} lbs</p>}
            <div className="space-y-0.5 text-sm text-ink-950/70">
              {changeLine(numbers.changeLb) && <p>{changeLine(numbers.changeLb)}</p>}
              {numbers.toGoalLb != null && (
                <p>{numbers.toGoalLb === 0 ? "You've reached your goal weight" : `${numbers.toGoalLb} lbs to your goal`}</p>
              )}
            </div>
          </div>
          <WeightChart points={points} goalLb={numbers.goalLb} />

          {visits.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-ink-950">From your visits</h3>
              <ul className="mt-2 divide-y divide-ink-950/10 text-sm">
                {visits.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap justify-between gap-x-4 py-2.5">
                    <span className="text-ink-950/70">{dayLabel(entry.date)}</span>
                    <span className="text-ink-950">
                      {[
                        entry.weightLb != null && `${entry.weightLb} lbs`,
                        entry.systolic != null && entry.diastolic != null && `BP ${entry.systolic}/${entry.diastolic}`,
                        entry.heartRate != null && `HR ${entry.heartRate}`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {weighIns.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-ink-950">Your weigh-ins</h3>
              {deleteError && (
                <p role="alert" className="mt-2 text-sm text-brand-dark">
                  {deleteError}
                </p>
              )}
              <ul className="mt-2 divide-y divide-ink-950/10 text-sm">
                {weighIns.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 py-2.5">
                    <span className="text-ink-950/70">{dayLabel(entry.date)}</span>
                    <span className="flex items-center gap-4">
                      <span className="text-ink-950">{entry.weightLb} lbs</span>
                      <button
                        type="button"
                        onClick={() => setDeleting(entry)}
                        className="cursor-pointer text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:text-brand-dark"
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {deleting && (
        <div role="alertdialog" aria-modal="true" aria-label="Delete this weigh-in?" className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <p className="font-serif text-xl text-ink-950">Delete this weigh-in?</p>
            <p className="mt-2 text-sm text-ink-950/70">Your care team will still see that it was deleted.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-ink-950/70 transition-colors duration-200 hover:bg-paper-100"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={confirmDelete}
                className="cursor-pointer rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-ink-900"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [x] **Step 5: PortalHome.** Import `PortalProgress`; remove the Track progress row from `COMING_SOON` (and `TrendingUpIcon` from the icons import if unused); replace the main column's `<PortalUpdates intakeId={link.intakeId} />` with:

```jsx
            <div className="space-y-6">
              <PortalProgress intakeId={link.intakeId} />
              <PortalUpdates intakeId={link.intakeId} />
            </div>
```

- [x] **Step 6: Run both portal checks** (`portal-progress-check.mjs` all pass; `portal-updates-check.mjs` after updating its stub with `getMyProgress`/`logWeight`/`deleteWeighIn` and the coming-soon count to 2). Read the screenshots. Run `humanizer` over the new strings. `npm run lint`, `npm run build`.

- [x] **Step 7: Commit**

```bash
git add src/portal
git commit -m "Portal: Track progress box (chart, visit BP and heart rate, log and delete weigh-ins)"
```

---

### Task 6: Docs and verification

**Files:**
- Modify: `docs/client-portal.md` ("Where we left off": Track progress built; rules must be redeployed)

- [x] **Step 1:** In "Where we left off", add a paragraph: Track progress is built (spec and plan paths), what it does in two sentences, and that the rules must be deployed before it works live. Mark Track progress done in "The four sections" table's notes column if it has one, otherwise leave the table.
- [x] **Step 2:** Load `superpowers:verification-before-completion`. Run and report: `npm run test:rules`, `npm run check`, `npm run lint`, `npm run build`, `progress-chart-check.mjs`, `portal-progress-check.mjs`, `portal-updates-check.mjs`, `updates-check.mjs`.
- [x] **Step 3: Commit**

```bash
git add docs/client-portal.md docs/superpowers/plans/2026-10-06-portal-track-progress.md
git commit -m "Docs: Track progress built; where we left off"
```
