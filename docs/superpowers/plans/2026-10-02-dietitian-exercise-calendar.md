# Dietitian role, dietitian and exercise notes, Calendar: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Dietitian staff role, dietitian and exercise note types on patient charts, per-discipline follow-ups on To-do, and a Calendar of appointments with a who-did-what history.

**Architecture:** Same shape as the existing admin: pure helpers in `chartMath.js` / new `calendarMath.js` (checked by `npm run check` under plain node), Firestore reads and writes in `chartStore.js` / new `appointmentStore.js` (each with an in-memory demo branch), React pages under `src/admin/`, and `firestore.rules` as the real boundary. Note types are data (`NOTE_TYPES`, `SECTION_FIELDS` in `noteUi.jsx`), so the existing editor and view render the new types.

**Tech Stack:** React 19, react-router-dom v7, Tailwind v4, Firebase JS SDK 12 (Auth + Firestore), node:assert self-checks, `@firebase/rules-unit-testing` + node:test for rules.

**Spec:** `docs/superpowers/specs/2026-10-02-dietitian-exercise-calendar-design.md`

## Global Constraints

- No new dependencies. Dates via `Intl` and `Date` only.
- All appointment times are Tampa time, `America/New_York`, whatever the viewer's computer is set to.
- Medication appears only in consultation and progress notes. Dietitian and exercise notes always have `prescriptions: []`, enforced in `firestore.rules`.
- Hover = colour, never movement (no translate/scale on hover).
- Admin blue *text* uses `accent-text`; solid blue fills use `accent-dark` with `text-oncolor`.
- No em dashes in visitor-facing copy; the admin follows the same habit.
- Spelling: "dietitian" (never "dietician"); brand "CorePhia".
- Do not edit `CLAUDE.md` (Louie edits it only on request).
- Do not start, stop or restart the dev server; ask Louie for the port for browser checks.
- Rules tests need Java 21+, which this machine lacks: write them, don't expect to run them.
- Deviation from the spec, deliberate: "Waiting for a first consultation" now means no signed **medical** note (a dietitian note doesn't make the consultation happen). The spec said "unchanged"; flag it to Louie at the Phase 1 hand-off.

## Review Focus

1. **A role that loses access mid-draft.** A dietitian whose role is removed (or changed to provider) still has a draft open. Expected: sign and autosave are refused by the rules and the editor shows its existing stale/permission error, nothing crashes. Covered by `canWriteType(resource.data.type)` on note update (Task 6 test "a provider can't sign a dietitian draft").
2. **Number inputs that aren't whole numbers.** Typing `3.5` days or `45.7` minutes in the exercise plan. Expected: stored as whole numbers (rules check `is int`), so a sign never fails on a decimal. Covered in Task 3 (`intOrNull` rounding) and Task 6 test (`daysPerWeek: 9` and a double refused).
3. **The week that contains the DST change (Nov 1, 2026).** Expected: the week view and range queries cover the right 7 days, no appointment drops off or shows twice, times show in Tampa time. Covered in Task 8 checks (`weekRange` across Nov 1, `fromTampa` both sides).
4. **A follow-up near the edge of the visible week.** An appointment booked 2 days after a follow-up date that falls on Sunday sits in next week's range. Expected: no false "Follow-up due" marker. Covered in Task 12 (appointments loaded with ±3 day padding) and Task 8 check on `matchingAppointment` at the ±3 edge.
5. **Two people editing the same appointment.** One cancels while another has the dialog open and then moves it. Expected: the move is refused (status no longer scheduled), the dialog shows "This appointment changed somewhere else. Close it to see the latest." Covered in Task 10 test "a cancelled appointment can't be moved" and Task 11 error text.

---

# Phase 1: Dietitian role, dietitian and exercise notes, To-do per discipline

### Task 1: Dietitian role in the client

**Files:**
- Modify: `src/admin/roles.js`
- Create: `src/admin/roles.check.js`
- Modify: `package.json` (`check` script)
- Modify: `src/admin/noteUi.jsx` (drop `ROLE_NAMES`, use `ROLE_LABELS`)
- Modify: `src/admin/NoteView.jsx:10,175` (`ROLE_NAMES` → `ROLE_LABELS`)
- Modify: `src/admin/chartStore.js` (`VISIBLE_TO_ADMIN`)
- Modify: `src/admin/Applicants.jsx:52` (`canReview`)
- Modify: `src/admin/AdminApp.jsx` (demo role switch)
- Modify: `src/admin/seedCharts.js` (demo dietitian staff member)

**Interfaces:**
- Produces: `ROLE_LABELS.dietitian = "Dietitian"`; `CLINICAL_ROLES` includes `"dietitian"`; `canWriteNote(type, role) → boolean`; `canAdmit(role) → boolean`; `canAmend(noteType, role) → boolean`; `PAGE_ROLES.calendar`; `grantableRoles` and `canManageMember` know `dietitian`.

- [ ] **Step 1: Write the failing check** — create `src/admin/roles.check.js`:

```js
// Self-check for roles.js: `npm run check`. Plain node:assert, like
// chartMath.check.js.
import assert from "node:assert/strict"
import { canAdmit, canAmend, canManageMember, canOpen, canWriteNote, grantableRoles, isClinicalRole } from "./roles.js"

// The dietitian is clinical: opens charts, To-do, Calendar; not Messages or Staff.
assert.equal(isClinicalRole("dietitian"), true)
for (const page of ["dashboard", "applicants", "patients", "todo", "calendar", "security"]) assert.equal(canOpen(page, "dietitian"), true, page)
for (const page of ["messages", "analytics", "staff", "activity"]) assert.equal(canOpen(page, "dietitian"), false, page)

// Who writes which note type.
assert.equal(canWriteNote("dietitian", "dietitian"), true)
assert.equal(canWriteNote("dietitian", "admin"), true)
for (const role of ["provider", "coAdmin", "superAdmin"]) assert.equal(canWriteNote("dietitian", role), false, role)
for (const type of ["consultation", "progress", "exercise"]) {
  assert.equal(canWriteNote(type, "dietitian"), false, type)
  for (const role of ["provider", "coAdmin", "admin", "superAdmin"]) assert.equal(canWriteNote(type, role), true, `${type} ${role}`)
}
assert.equal(canWriteNote("unknown", "admin"), false)

// Admitting and declining: everyone clinical except the dietitian.
assert.equal(canAdmit("dietitian"), false)
assert.equal(canAdmit("provider"), true)
assert.equal(canAdmit(null), false)

// Addenda: a dietitian only on dietitian notes; others on anything.
assert.equal(canAmend("dietitian", "dietitian"), true)
assert.equal(canAmend("progress", "dietitian"), false)
assert.equal(canAmend("dietitian", "provider"), true)
assert.equal(canAmend("progress", ""), false)

// Granting: admin and co-admin can hand out dietitian; and manage dietitians.
assert.ok(grantableRoles("admin").includes("dietitian"))
assert.ok(grantableRoles("coAdmin").includes("dietitian"))
assert.ok(grantableRoles("superAdmin").includes("dietitian"))
assert.equal(canManageMember({ uid: "a", role: "coAdmin" }, { uid: "d", role: "dietitian" }), true)
assert.equal(canManageMember({ uid: "a", role: "admin" }, { uid: "d", role: "dietitian" }), true)
assert.equal(canManageMember({ uid: "d", role: "dietitian" }, { uid: "p", role: "provider" }), false)

console.log("roles: all checks passed")
```

- [ ] **Step 2: Wire it into `npm run check` and watch it fail**

In `package.json` change the script to:

```json
"check": "node src/admin/chartMath.check.js && node src/admin/roles.check.js",
```

Run: `npm run check`
Expected: chartMath passes, then roles fails (`canAdmit` is not exported / assertion error).

- [ ] **Step 3: Implement** — replace the body of `src/admin/roles.js` from `export const ROLE_LABELS` through `canManageMember` with:

```js
export const ROLE_LABELS = {
  superAdmin: "Super admin",
  admin: "Admin",
  coAdmin: "Co-admin",
  provider: "Provider",
  dietitian: "Dietitian",
}

export const CLINICAL_ROLES = ["dietitian", "provider", "coAdmin", "admin", "superAdmin"]
const STAFF_ROLES = ["coAdmin", "admin", "superAdmin"]
// Everyone clinical except the dietitian: admits applicants, writes medical
// and exercise notes. Exercise notes are theirs until an exercise role exists
// (Louie, 2026-10-02).
const PRESCRIBERS = ["provider", "coAdmin", "admin", "superAdmin"]

export const isClinicalRole = (role) => CLINICAL_ROLES.includes(role)

const PAGE_ROLES = {
  dashboard: CLINICAL_ROLES,
  applicants: CLINICAL_ROLES,
  patients: CLINICAL_ROLES,
  todo: CLINICAL_ROLES,
  calendar: CLINICAL_ROLES,
  messages: STAFF_ROLES,
  analytics: STAFF_ROLES,
  staff: STAFF_ROLES,
  activity: ["superAdmin"],
  security: CLINICAL_ROLES,
}

export const canOpen = (page, role) => PAGE_ROLES[page]?.includes(role) ?? false

// Which note types a role may write and sign. Mirrors canWriteType in
// firestore.rules. The admin (Dr. Antonious) also writes dietitian notes.
const NOTE_WRITERS = {
  consultation: PRESCRIBERS,
  progress: PRESCRIBERS,
  exercise: PRESCRIBERS,
  dietitian: ["dietitian", "admin"],
}

export const canWriteNote = (type, role) => NOTE_WRITERS[type]?.includes(role) ?? false
export const canAdmit = (role) => PRESCRIBERS.includes(role)
// A dietitian adds addenda only to dietitian notes, so they can't add text
// to a medical record. Everyone else clinical: any signed note.
export const canAmend = (noteType, role) => isClinicalRole(role) && (role !== "dietitian" || noteType === "dietitian")

// The roles a signed-in person may hand out on the Staff page. Only a super
// admin grants admin or super admin.
export const grantableRoles = (role) =>
  role === "superAdmin"
    ? ["provider", "dietitian", "coAdmin", "admin", "superAdmin"]
    : role === "admin" || role === "coAdmin"
      ? ["provider", "dietitian", "coAdmin"]
      : []

// Whose current role a person may change or delete (never their own):
// super admin, anyone; admin, providers, dietitians, co-admins and no-access
// accounts; co-admin, providers, dietitians and no-access accounts only.
// Mirrors canActOn.
const ACTS_ON = { admin: ["", "provider", "dietitian", "coAdmin"], coAdmin: ["", "provider", "dietitian"] }

export const canManageMember = (viewer, member) =>
  member.uid !== viewer.uid &&
  (viewer.role === "superAdmin" || (ACTS_ON[viewer.role]?.includes(member.role ?? "") ?? false))
```

- [ ] **Step 4: Run** `npm run check` — Expected: `chartMath: all checks passed` then `roles: all checks passed`.

- [ ] **Step 5: One role-label list.** In `src/admin/noteUi.jsx` delete the `ROLE_NAMES` line, add `import { ROLE_LABELS } from "./roles"` beside the `chartMath` import, and change `signerLine` to use `ROLE_LABELS[signedBy.role]`. In `src/admin/NoteView.jsx` replace `ROLE_NAMES` in the import list with nothing, add `import { ROLE_LABELS } from "./roles"`, and on the addendum author line use `ROLE_LABELS[amendment.authorRole] ?? amendment.authorRole`.

- [ ] **Step 6: Staff list query.** In `src/admin/chartStore.js` change:

```js
const VISIBLE_TO_ADMIN = ["", "provider", "dietitian", "coAdmin", "admin"]
```

- [ ] **Step 7: Applicants.** In `src/admin/Applicants.jsx` import `canAdmit` from `./roles` and replace line 52:

```js
  // Admitting/declining isn't destructive, so every clinical role but the
  // dietitian can do it (roles.canAdmit; firestore.rules isAdmitter).
  const canReview = canAdmit(role) && !usingSampleFallback
```

Keep the comment line above it that this replaces (line 50–51) removed, so the comment isn't duplicated.

- [ ] **Step 8: Demo role switch.** In `src/admin/AdminApp.jsx` add `ROLE_LABELS` to the `./roles` import (or add `import { ROLE_LABELS } from "./roles"` if `roles` isn't imported yet), add above the main component:

```js
// Demo mode only: open /admin?demoRole=dietitian (or provider, coAdmin, admin)
// to preview the admin as that role for the rest of the tab. Without it the
// demo runs as super admin, as before.
function demoRoleFromUrl() {
  try {
    const asked = new URLSearchParams(window.location.search).get("demoRole")
    if (asked) sessionStorage.setItem("corephia-demo-role", asked)
    const role = sessionStorage.getItem("corephia-demo-role")
    return ROLE_LABELS[role] ? role : "superAdmin"
  } catch {
    return "superAdmin"
  }
}
```

Next to `const [role, setRole] = useState(null)` add `const [demoRole] = useState(demoRoleFromUrl)`, and in the `usingSeedData` branch change both `role="superAdmin"` props (on `AdminChrome` and `AdminRoutes`) to `role={demoRole}`.

- [ ] **Step 9: Demo dietitian.** In `src/admin/seedCharts.js` add to the `staff` array:

```js
    { uid: "demo-dietitian", name: "Sam Rivera, RD", email: "sam@corephia.example", role: "dietitian", addedAt: new Date(now - 5 * DAY) },
```

- [ ] **Step 10: Lint, build, commit**

Run: `npm run lint` (no new warnings beyond the 4 existing), `npm run build` (passes).

```bash
git add package.json src/admin/roles.js src/admin/roles.check.js src/admin/noteUi.jsx src/admin/NoteView.jsx src/admin/chartStore.js src/admin/Applicants.jsx src/admin/AdminApp.jsx src/admin/seedCharts.js
git commit -m "Admin: dietitian role, note-writer and admit permissions"
```

---

### Task 2: Per-discipline chart math

**Files:**
- Modify: `src/admin/chartMath.js`
- Test: `src/admin/chartMath.check.js`

**Interfaces:**
- Produces: `DISCIPLINES = ["medical", "dietitian", "exercise"]`; `disciplineOf(type) → "medical" | "dietitian" | "exercise"`; `latestSignedByDiscipline(notes) → { medical?, dietitian?, exercise? }` (note objects); `currentExercisePlan(notes) → exercisePlan | null`; `nextFollowUps(notes) → [{ discipline, date }]`; `daysFrom(fromIso, toIso) → number` (now exported); `dueTasks(notes, today, windowDays)` items gain `discipline`.

- [ ] **Step 1: Write the failing checks** — in `chartMath.check.js` extend the import to
`import { ageFrom, asDate, bmi, currentExercisePlan, currentPrescriptions, daysFrom, disciplineOf, dueTasks, latestSignedByDiscipline, nextFollowUps } from "./chartMath.js"`
and append before the final `console.log`:

```js
// Disciplines: consultation and progress (and old notes with no type) are medical.
assert.equal(disciplineOf("consultation"), "medical")
assert.equal(disciplineOf("progress"), "medical")
assert.equal(disciplineOf(undefined), "medical")
assert.equal(disciplineOf("dietitian"), "dietitian")
assert.equal(disciplineOf("exercise"), "exercise")

assert.equal(daysFrom("2026-10-01", "2026-10-04"), 3)

// The latest signed note per discipline; drafts ignored.
{
  const notes = [
    visit("2026-09-01", { type: "consultation", id: "c" }),
    visit("2026-09-20", { type: "dietitian", id: "d1" }),
    visit("2026-09-25", { type: "dietitian", id: "d2" }),
    { status: "draft", type: "exercise", visitDate: "2026-09-30", id: "x" },
  ]
  const latest = latestSignedByDiscipline(notes)
  assert.equal(latest.medical.id, "c")
  assert.equal(latest.dietitian.id, "d2")
  assert.equal(latest.exercise, undefined)
}

// The exercise plan stands from the latest signed exercise note.
{
  const plan = { daysPerWeek: 4, intensity: "moderate", minutesPerSession: 30, kind: "Walking", notes: "" }
  assert.deepEqual(currentExercisePlan([visit("2026-09-01", { type: "exercise", exercisePlan: plan })]), plan)
  assert.equal(currentExercisePlan([visit("2026-09-01", { type: "progress" })]), null)
}

// One next follow-up per discipline, each from its own latest note.
assert.deepEqual(
  nextFollowUps([
    visit("2026-09-01", { type: "progress", nextFollowUp: "2026-10-03" }),
    visit("2026-09-20", { type: "dietitian", nextFollowUp: "2026-10-02" }),
    visit("2026-09-22", { type: "exercise", nextFollowUp: "" }),
  ]),
  [
    { discipline: "medical", date: "2026-10-03" },
    { discipline: "dietitian", date: "2026-10-02" },
  ],
)

// To-do: a newer dietitian note doesn't clear the medical follow-up, and each
// discipline's follow-up shows separately with its discipline.
{
  const tasks = dueTasks(
    [
      visit("2026-09-01", { type: "consultation", nextFollowUp: "2026-10-03" }),
      visit("2026-09-20", { type: "dietitian", nextFollowUp: "2026-10-02" }),
    ],
    "2026-10-01",
  )
  assert.deepEqual(
    tasks.map((task) => `${task.kind}:${task.discipline}:${task.days}`),
    ["followUp:medical:2", "followUp:dietitian:1"],
  )
}

// Only a dietitian note signed: the first consultation is still to happen,
// and the dietitian follow-up still shows.
assert.deepEqual(
  dueTasks([visit("2026-09-20", { type: "dietitian", nextFollowUp: "2026-10-02" })], "2026-10-01").map(
    (task) => `${task.kind}:${task.discipline}`,
  ),
  ["followUp:dietitian", "firstConsult:medical"],
)

// Renewals are medical.
assert.equal(
  dueTasks([visit("2026-09-01", { prescriptions: [start("a", "Med A", "2026-10-02")] })], "2026-10-01")[0].discipline,
  "medical",
)
```

- [ ] **Step 2: Run** `npm run check` — Expected: FAIL (`disciplineOf` not exported).

- [ ] **Step 3: Implement** — in `src/admin/chartMath.js`:

Change `const daysFrom = (from, to) => …` to `export const daysFrom = (from, to) => …` (same body).

Add after `currentPrescriptions`:

```js
export const DISCIPLINES = ["medical", "dietitian", "exercise"]

// Consultation and progress notes (and anything older with no type) are the
// medical record; dietitian and exercise notes are their own disciplines.
export const disciplineOf = (type) => (type === "dietitian" || type === "exercise" ? type : "medical")

const newestVisitFirst = (a, b) =>
  (b.visitDate ?? "").localeCompare(a.visitDate ?? "") || millis(b.signedAt) - millis(a.signedAt)
const signedNewestFirst = (notes) => notes.filter((note) => note.status === "signed").sort(newestVisitFirst)

// The latest signed note of each discipline: { medical, dietitian, exercise },
// a key missing when that discipline has no signed note yet.
export function latestSignedByDiscipline(notes) {
  const latest = {}
  for (const note of signedNewestFirst(notes)) latest[disciplineOf(note.type)] ??= note
  return latest
}

export const currentExercisePlan = (notes) => latestSignedByDiscipline(notes).exercise?.exercisePlan ?? null

// Each discipline's next follow-up, from that discipline's latest signed
// note only: a later note with no date clears an earlier one.
export function nextFollowUps(notes) {
  const latest = latestSignedByDiscipline(notes)
  return DISCIPLINES.filter((discipline) => latest[discipline]?.nextFollowUp).map((discipline) => ({
    discipline,
    date: latest[discipline].nextFollowUp,
  }))
}
```

Replace `dueTasks` with:

```js
// What the To-do page lists for one patient, as of `today` (YYYY-MM-DD):
// renewals and each discipline's follow-up due within `windowDays` (or
// overdue), and the first consultation while no medical note is signed.
// Nothing here is ticked off by hand: signing the note that renews or follows
// up is what clears an item.
export function dueTasks(notes, today, windowDays = 7) {
  const signed = signedNewestFirst(notes)
  const withinWindow = (due) => due && daysFrom(today, due) <= windowDays
  const renewals = currentPrescriptions(signed)
    .filter((prescription) => withinWindow(prescription.renewalDue))
    .map((prescription) => ({
      kind: "renewal",
      discipline: "medical",
      medication: prescription.medication,
      due: prescription.renewalDue,
      days: daysFrom(today, prescription.renewalDue),
    }))
  const followUps = nextFollowUps(signed)
    .filter((followUp) => withinWindow(followUp.date))
    .map((followUp) => ({
      kind: "followUp",
      discipline: followUp.discipline,
      due: followUp.date,
      days: daysFrom(today, followUp.date),
    }))
  const firstConsult = latestSignedByDiscipline(signed).medical
    ? []
    : [{ kind: "firstConsult", discipline: "medical", due: null, days: null }]
  return [...renewals, ...followUps, ...firstConsult]
}
```

- [ ] **Step 4: Run** `npm run check` — Expected: both files pass, including every pre-existing `dueTasks` assert.

- [ ] **Step 5: Commit**

```bash
git add src/admin/chartMath.js src/admin/chartMath.check.js
git commit -m "Admin: per-discipline follow-ups and exercise plan helpers"
```

---

### Task 3: Note types as data; editor and view render them

**Files:**
- Modify: `src/admin/noteUi.jsx`
- Modify: `src/admin/chartStore.js` (`EMPTY_SECTIONS`, `pickNoteFields`, `createDraftNote`)
- Modify: `src/admin/NoteEditor.jsx`
- Modify: `src/admin/NoteView.jsx`

**Interfaces:**
- Consumes: `canAmend(noteType, role)` (Task 1).
- Produces: `NOTE_TYPES[type] = { label, newLabel, discipline, fullVitals, prescriptions }`; `NOTE_TYPE_LABELS` (derived, unchanged shape); `SECTION_FIELDS.dietitian`, `SECTION_FIELDS.exercise`; `DISCIPLINE_LABELS`; `INTENSITIES`; `exercisePlanLine(plan) → string`; `EMPTY_EXERCISE_PLAN` from chartStore; notes of type `exercise` carry `exercisePlan`.

- [ ] **Step 1: noteUi.** In `src/admin/noteUi.jsx` replace the `NOTE_TYPE_LABELS` line and `SECTION_FIELDS` with:

```js
// Every note type, in the order "New note" offers them. Dietitian and
// exercise notes have no prescriptions (medication stays in the medical
// record, written by providers) and record weight only.
export const NOTE_TYPES = {
  consultation: { label: "Consultation", newLabel: "New consultation", discipline: "medical", fullVitals: true, prescriptions: true },
  progress: { label: "Progress note", newLabel: "New progress note", discipline: "medical", fullVitals: true, prescriptions: true },
  exercise: { label: "Exercise note", newLabel: "New exercise note", discipline: "exercise", fullVitals: false, prescriptions: false },
  dietitian: { label: "Dietitian note", newLabel: "New dietitian note", discipline: "dietitian", fullVitals: false, prescriptions: false },
}

export const NOTE_TYPE_LABELS = Object.fromEntries(Object.entries(NOTE_TYPES).map(([type, { label }]) => [type, label]))

export const DISCIPLINE_LABELS = { medical: "Medical", dietitian: "Dietitian", exercise: "Exercise" }

// Which sections each note type has, in order. Labels are the clinical terms
// Dr. Antonious used (HPI, plan), spelled out where a new provider may not
// know the shorthand.
export const SECTION_FIELDS = {
  consultation: [
    ["chiefConcern", "Reason for visit"],
    ["hpi", "History of present illness (HPI)"],
    ["pertinentHistory", "Pertinent history"],
    ["assessment", "Assessment"],
    ["plan", "Plan"],
  ],
  progress: [
    ["intervalHistory", "Interval history (since last visit)"],
    ["assessment", "Assessment"],
    ["plan", "Plan"],
  ],
  dietitian: [
    ["dietHistory", "Diet history and current eating pattern"],
    ["assessment", "Assessment"],
    ["goals", "Goals"],
    ["mealPlan", "Meal plan and recommendations"],
  ],
  exercise: [
    ["activityLevel", "Current activity level"],
    ["limitations", "Limitations and injuries"],
    ["goals", "Goals"],
  ],
}

export const INTENSITIES = [
  ["light", "Light"],
  ["moderate", "Moderate"],
  ["vigorous", "Vigorous"],
]

// "4 days a week, moderate, 30 min per session, Walking", or "" when empty.
export function exercisePlanLine(plan) {
  if (!plan) return ""
  return [
    plan.daysPerWeek != null && `${plan.daysPerWeek} ${plan.daysPerWeek === 1 ? "day" : "days"} a week`,
    INTENSITIES.find(([value]) => value === plan.intensity)?.[1].toLowerCase(),
    plan.minutesPerSession != null && `${plan.minutesPerSession} min per session`,
    plan.kind?.trim(),
  ]
    .filter(Boolean)
    .join(", ")
}
```

- [ ] **Step 2: chartStore.** In `src/admin/chartStore.js`:

```js
export const EMPTY_SECTIONS = {
  chiefConcern: "",
  hpi: "",
  intervalHistory: "",
  pertinentHistory: "",
  assessment: "",
  plan: "",
  dietHistory: "",
  goals: "",
  mealPlan: "",
  activityLevel: "",
  limitations: "",
}

// Exercise notes only. Whole numbers or null; the rules check the ranges.
export const EMPTY_EXERCISE_PLAN = { daysPerWeek: null, intensity: "", minutesPerSession: null, kind: "", notes: "" }

// The fields an author edits; everything else on a note is set by these
// functions (and checked by the rules), never by the editor. exercisePlan
// exists on exercise notes only, so it's passed through only when present.
const pickNoteFields = ({ visitDate, sections, vitals, prescriptions, nextFollowUp, exercisePlan }) => ({
  visitDate,
  sections,
  vitals,
  prescriptions,
  nextFollowUp,
  ...(exercisePlan !== undefined && { exercisePlan }),
})
```

In `createDraftNote`, inside `base` after `nextFollowUp: "",` add:

```js
    ...(type === "exercise" && { exercisePlan: { ...EMPTY_EXERCISE_PLAN } }),
```

- [ ] **Step 3: NoteEditor — config, vitals, prescriptions gate.** In `src/admin/NoteEditor.jsx`:

Change the noteUi import to
`import { INTENSITIES, NOTE_TYPES, NOTE_TYPE_LABELS, SECTION_FIELDS, inputClass, labelClass, prescriptionLine } from "./noteUi"`
and add `import Select from "../components/Select"`.

Add below `numberOrNull`:

```js
// Days and minutes are whole numbers (the rules check `is int`), so a typed
// 3.5 is rounded here rather than refused at signing.
const intOrNull = (value, max) => (value == null ? null : Math.min(max, Math.max(0, Math.round(value))))
const DAY_OPTIONS = Array.from({ length: 8 }, (_, days) => ({ value: String(days), label: String(days) }))
const INTENSITY_OPTIONS = INTENSITIES.map(([value, label]) => ({ value, label }))
```

Add a component above `signProblem`:

```jsx
function ExercisePlanFields({ plan, onChange }) {
  const set = (patch) => onChange({ ...plan, ...patch })
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink-950">Exercise prescription</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <span className={labelClass} aria-hidden="true">
            Days per week
          </span>
          <Select
            ariaLabel="Days per week"
            options={DAY_OPTIONS}
            value={plan.daysPerWeek == null ? "" : String(plan.daysPerWeek)}
            onChange={(value) => set({ daysPerWeek: value === "" ? null : Number(value) })}
            placeholder="Choose"
            triggerClassName={COMPACT_DATE}
          />
        </div>
        <div>
          <span className={labelClass} aria-hidden="true">
            Intensity
          </span>
          <Select
            ariaLabel="Intensity"
            options={INTENSITY_OPTIONS}
            value={plan.intensity}
            onChange={(intensity) => set({ intensity })}
            placeholder="Choose"
            triggerClassName={COMPACT_DATE}
          />
        </div>
        <NumberField
          label="Minutes per session"
          suffix="min"
          value={plan.minutesPerSession}
          onChange={(value) => set({ minutesPerSession: intOrNull(value, 300) })}
        />
        <label className="block sm:col-span-3">
          <span className={labelClass}>Type of exercise</span>
          <input value={plan.kind} onChange={(event) => set({ kind: event.target.value })} className={inputClass} />
        </label>
        <div className="sm:col-span-3">
          <TextArea label="Notes" value={plan.notes} onChange={(notes) => set({ notes })} rows={2} />
        </div>
      </div>
    </section>
  )
}
```

In the component body: the `useState` initialiser for `fields` gains `...(note.exercisePlan && { exercisePlan: note.exercisePlan }),`; add `const config = NOTE_TYPES[note.type]` after the `useState` lines.

Replace the Vitals `<section>` grid with:

```jsx
              <h3 className="text-sm font-semibold text-ink-950">{config.fullVitals ? "Vitals" : "Weight"}</h3>
              <div className={`mt-3 grid gap-3 ${config.fullVitals ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
                <NumberField label="Weight" suffix="lbs" value={fields.vitals.weightLb} onChange={(v) => setVital("weightLb", v)} />
                {config.fullVitals && (
                  <>
                    <NumberField label="Systolic" value={fields.vitals.systolic} onChange={(v) => setVital("systolic", v)} />
                    <NumberField label="Diastolic" value={fields.vitals.diastolic} onChange={(v) => setVital("diastolic", v)} />
                    <NumberField label="Heart rate" suffix="bpm" value={fields.vitals.heartRate} onChange={(v) => setVital("heartRate", v)} />
                  </>
                )}
              </div>
```

(the BMI / weight-change `<p>` under it stays as is).

Directly after the sections `</section>` (the `SECTION_FIELDS[note.type].map` block) add:

```jsx
            {fields.exercisePlan && (
              <ExercisePlanFields plan={fields.exercisePlan} onChange={(exercisePlan) => update({ exercisePlan })} />
            )}
```

Wrap the whole Prescriptions `<section>…</section>` in `{config.prescriptions && ( … )}`.

- [ ] **Step 4: NoteView.** In `src/admin/NoteView.jsx`: import `exercisePlanLine` from `./noteUi` and `canAmend` from `./roles`. After the sections map add:

```jsx
            {exercisePlanLine(note.exercisePlan) && (
              <section>
                <h3 className="text-xs font-semibold tracking-wide text-ink-950/50 uppercase">Exercise prescription</h3>
                <p className="mt-1.5 text-sm text-ink-950">{exercisePlanLine(note.exercisePlan)}</p>
                {note.exercisePlan.notes?.trim() && (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink-950/75">{note.exercisePlan.notes}</p>
                )}
              </section>
            )}
```

Include `!exercisePlanLine(note.exercisePlan)` in the "signed with no sections filled in" condition. Where the view renders `{adding ? ( …form… ) : ( …"Add addendum" button… )}`, change the else branch to `canAmend(note.type, actor.role) ? ( …the existing button… ) : null`.

- [ ] **Step 5: Build** — `npm run build` passes; `npm run lint` shows no new warnings.

- [ ] **Step 6: Commit**

```bash
git add src/admin/noteUi.jsx src/admin/chartStore.js src/admin/NoteEditor.jsx src/admin/NoteView.jsx
git commit -m "Admin: dietitian and exercise note types in the editor and view"
```

---

### Task 4: Chart page — new-note menu by role, filter, summary blocks, prefill, demo notes

**Files:**
- Modify: `src/admin/PatientChart.jsx`
- Modify: `src/admin/seedCharts.js`

**Interfaces:**
- Consumes: `canWriteNote` (Task 1); `disciplineOf`, `currentExercisePlan`, `nextFollowUps` (Task 2); `NOTE_TYPES`, `DISCIPLINE_LABELS`, `exercisePlanLine` (Task 3).

- [ ] **Step 1: Imports and prefill.** In `src/admin/PatientChart.jsx`:
  - chartMath import adds `currentExercisePlan, disciplineOf, nextFollowUps`.
  - noteUi import adds `DISCIPLINE_LABELS, NOTE_TYPES, exercisePlanLine`.
  - replace `import { isClinicalRole } from "./roles"` with `import { canWriteNote } from "./roles"`.

Add below `historyFromIntake`:

```js
// Diet history for a new dietitian note, from the intake's nutrition answers.
function dietFromIntake(intake) {
  const nutrition = intake?.nutrition ?? {}
  const lines = [
    ["Meals per day", nutrition.mealsPerDay],
    ["Water", nutrition.waterIntake],
    ["Estimated daily calories", nutrition.estimatedDailyCalories || nutrition.estimatedDailyCaloriesRange],
    ["Diet notes", nutrition.dietNotes],
  ]
  return lines
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n")
}

const PREFILL = {
  consultation: (intake) => ({ sections: { pertinentHistory: historyFromIntake(intake) } }),
  dietitian: (intake) => ({ sections: { dietHistory: dietFromIntake(intake) } }),
  exercise: (intake) => ({ sections: { activityLevel: intake?.socialHistory?.exerciseFrequency ?? "" } }),
}

const NOTE_FILTERS = [
  ["all", "All"],
  ["medical", "Medical"],
  ["dietitian", "Dietitian"],
  ["exercise", "Exercise"],
]
```

In `startNote` replace the `prefill` line with `const prefill = PREFILL[type]?.(intake) ?? {}`.

- [ ] **Step 2: State and derived values.** Add `const [noteFilter, setNoteFilter] = useState("all")` with the other state. After `const current = useMemo(…)` add:

```js
  const exercisePlan = useMemo(() => (notes ? currentExercisePlan(notes) : null), [notes])
  const followUps = useMemo(() => (notes ? nextFollowUps(notes) : []), [notes])
```

Replace `const canWrite = isClinicalRole(actor.role) && chart.status === "active"` with:

```js
  const writableTypes = Object.keys(NOTE_TYPES).filter((type) => canWriteNote(type, actor.role))
  const canWrite = writableTypes.length > 0 && chart.status === "active"
  const shownNotes = (notes ?? []).filter((note) => noteFilter === "all" || disciplineOf(note.type) === noteFilter)
```

- [ ] **Step 3: New-note buttons.** Replace the `["consultation", "progress"].map(…)` block with:

```jsx
                <div className="flex flex-wrap gap-1.5">
                  {writableTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={Boolean(creating)}
                      onClick={() => startNote(type)}
                      className="cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50"
                    >
                      {creating === type ? "Starting…" : NOTE_TYPES[type].newLabel}
                    </button>
                  ))}
                </div>
```

- [ ] **Step 4: Filter chips and list.** Directly inside the Notes `Card` children, before `{createError && …}`, add:

```jsx
            {notes?.length > 0 && (
              <div role="group" aria-label="Show notes" className="mb-3 flex flex-wrap gap-1.5">
                {NOTE_FILTERS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={noteFilter === value}
                    onClick={() => setNoteFilter(value)}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                      noteFilter === value ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/70 hover:bg-ink-950/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
```

Change the empty check to: `notes.length === 0 ? (…existing "No notes yet"…) : shownNotes.length === 0 ? (<p className="py-6 text-center text-sm text-ink-950/55">No {DISCIPLINE_LABELS[noteFilter].toLowerCase()} notes yet.</p>) : (…list…)` and map `shownNotes` instead of `notes` in the `<ol>`.

Drafts get their author: under the existing `note.status === "signed"` signer line add
`{note.status === "draft" && <span className="mt-0.5 block text-xs text-ink-950/50">Started by {note.authorName}</span>}`.

Replace the plan preview with:

```jsx
                      {(note.sections?.plan || note.sections?.mealPlan || exercisePlanLine(note.exercisePlan)) && (
                        <span className="mt-1 line-clamp-2 block text-sm text-ink-950/70">
                          Plan: {note.sections?.plan || note.sections?.mealPlan || exercisePlanLine(note.exercisePlan)}
                        </span>
                      )}
```

- [ ] **Step 5: Summary blocks.** After the "Current prescriptions" `Card` add:

```jsx
          <Card title="Current exercise plan">
            {exercisePlanLine(exercisePlan) ? (
              <p className="text-sm text-ink-950">{exercisePlanLine(exercisePlan)}</p>
            ) : (
              <p className="text-sm text-ink-950/55">None yet. It appears here once an exercise note is signed.</p>
            )}
          </Card>

          <Card title="Next follow-ups">
            {followUps.length === 0 ? (
              <p className="text-sm text-ink-950/55">None set.</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-ink-950">
                {followUps.map((followUp) => (
                  <li key={followUp.discipline}>
                    <span className="text-ink-950/55">{DISCIPLINE_LABELS[followUp.discipline]}:</span> {formatDay(followUp.date)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
```

- [ ] **Step 6: Demo notes.** In `src/admin/seedCharts.js` add a constant under `PROVIDER`:

```js
const DIETITIAN = { uid: "demo-dietitian", name: "Sam Rivera, RD", role: "dietitian" }
```

Inside the `forEach`, after `progress` is built, add:

```js
      const extra = []
      if (index % 2 === 0) {
        const dietAt = consultAt + 7 * DAY
        extra.push({
          ...consult,
          id: `${record.id}-n3`,
          type: "dietitian",
          authorUid: DIETITIAN.uid,
          authorName: DIETITIAN.name,
          authorRole: DIETITIAN.role,
          createdAt: new Date(dietAt),
          updatedAt: new Date(dietAt),
          visitDate: isoDay(dietAt),
          sections: {
            ...consult.sections,
            chiefConcern: "",
            hpi: "",
            pertinentHistory: "",
            plan: "",
            dietHistory: "Two meals a day, skips breakfast, snacks in the evening.",
            assessment: "Low protein early in the day, large evening intake.",
            goals: "Three meals a day, protein at breakfast.",
            mealPlan: "1,600 kcal plan, 30 g protein per meal. Swap evening snacks for a planned dinner.",
          },
          vitals: { weightLb: weight - 4, systolic: null, diastolic: null, heartRate: null },
          prescriptions: [],
          // The first chart's dietitian follow-up lands this week, for To-do.
          nextFollowUp: isoDay(now + (index === 0 ? 2 : 25) * DAY),
          signedAt: new Date(dietAt + 3600000),
          signedBy: DIETITIAN,
        })
      }
      if (index % 3 === 0) {
        const exerciseAt = consultAt + 10 * DAY
        extra.push({
          ...consult,
          id: `${record.id}-n4`,
          type: "exercise",
          createdAt: new Date(exerciseAt),
          updatedAt: new Date(exerciseAt),
          visitDate: isoDay(exerciseAt),
          sections: {
            ...consult.sections,
            chiefConcern: "",
            hpi: "",
            pertinentHistory: "",
            assessment: "",
            plan: "",
            activityLevel: "Walks the dog twice a week.",
            limitations: "Left knee pain on stairs.",
            goals: "Build to 150 minutes a week.",
          },
          exercisePlan: { daysPerWeek: 4, intensity: "moderate", minutesPerSession: 30, kind: "Brisk walking, low-impact cycling", notes: "Avoid deep squats until the knee settles." },
          vitals: { weightLb: weight - 5, systolic: null, diastolic: null, heartRate: null },
          prescriptions: [],
          nextFollowUp: isoDay(now + 12 * DAY),
          signedAt: new Date(exerciseAt + 3600000),
        })
      }
```

and change `notes.set(record.id, [consult, progress])` to `notes.set(record.id, [consult, progress, ...extra])`.

- [ ] **Step 7: Build and lint** — `npm run build`, `npm run lint` pass with no new warnings.

- [ ] **Step 8: Commit**

```bash
git add src/admin/PatientChart.jsx src/admin/seedCharts.js
git commit -m "Admin: chart shows notes by discipline, exercise plan and follow-ups"
```

---

### Task 5: To-do per discipline

**Files:**
- Modify: `src/admin/chartStore.js` (new `loadActiveChartNotes`)
- Modify: `src/admin/Todo.jsx`

**Interfaces:**
- Consumes: `dueTasks` items with `discipline` (Task 2), `DISCIPLINE_LABELS` (Task 3).
- Produces: `loadActiveChartNotes(uid) → Promise<[{ chart, notes }]>` (used again by Calendar in Task 12).

- [ ] **Step 1: Shared loader.** Add to `src/admin/chartStore.js` after `loadChart`:

```js
// Every active chart with its notes, for the pages that look across all
// patients (To-do, Calendar).
// ponytail: one notes read per chart, fine for a few hundred patients; past
// that, store the next due dates on the chart when a note is signed.
export async function loadActiveChartNotes(uid) {
  const charts = (await loadCharts()).filter((chart) => chart.status === "active")
  return Promise.all(charts.map(async (chart) => ({ chart, notes: await loadNotes(chart.id, uid) })))
}
```

- [ ] **Step 2: Todo uses it.** In `src/admin/Todo.jsx`: import `loadActiveChartNotes` (drop `loadCharts, loadNotes`) and `DISCIPLINE_LABELS` from `./noteUi`; delete the ponytail comment above the component (it moved). Replace the effect's promise chain with:

```js
    loadActiveChartNotes(actor.uid)
      .then((perChart) =>
        perChart.flatMap(({ chart, notes }) => {
          const name = `${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient"
          const admittedAt = asDate(chart.admittedAt)
          return dueTasks(notes, today).map((task, index) => ({ ...task, id: `${chart.id}-${index}`, chartId: chart.id, name, admittedAt }))
        }),
      )
      .then((all) => active && setTasks(all))
      .catch((cause) => active && setError(cause.code ?? cause.message))
```

Replace `taskLabel` with:

```js
const taskLabel = (task) =>
  task.kind === "renewal"
    ? `Renew ${task.medication || "prescription"}`
    : task.kind === "followUp"
      ? task.discipline === "medical"
        ? "Follow-up visit"
        : `${DISCIPLINE_LABELS[task.discipline]} follow-up`
      : "First consultation"
```

- [ ] **Step 3: Dietitian default.** Add state `const [showAll, setShowAll] = useState(actor.role !== "dietitian")`, and compute groups from `const visible = tasks && (showAll ? tasks : tasks.filter((task) => task.discipline === "dietitian"))` instead of `tasks`. For the dietitian only, render above the groups/empty state (inside the page, under `PageHeader`):

```jsx
      {actor.role === "dietitian" && (
        <div role="group" aria-label="Show tasks" className="mb-4 flex gap-1.5">
          {[
            [false, "Dietitian"],
            [true, "Everything"],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={showAll === value}
              onClick={() => setShowAll(value)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                showAll === value ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/70 hover:bg-ink-950/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
```

- [ ] **Step 4: Build, lint, check** — all pass.

- [ ] **Step 5: Commit**

```bash
git add src/admin/chartStore.js src/admin/Todo.jsx
git commit -m "Admin: To-do lists follow-ups per discipline"
```

---

### Task 6: Firestore rules for the dietitian and the new note types

**Files:**
- Modify: `firestore.rules`
- Test: `tests/firestore.rules.test.js`

- [ ] **Step 1: Write the failing tests.** In `tests/firestore.rules.test.js`:
  - add `dietitian: "dietitian"` to `ROLES`;
  - in `beforeEach`, after the `draft1` line, add
    `await setDoc(doc(db, "patients/chart1/notes/diet1"), { ...draft("admin", "admin", { type: "dietitian" }), status: "signed" })`;
  - update the header date line to say these tests cover dietitian notes too (2026-10-02), still unrun;
  - append:

```js
describe("dietitian and exercise notes", () => {
  const sign = (uid, role) => ({
    status: "signed",
    signedAt: serverTimestamp(),
    signedBy: { uid, name: uid, role },
    updatedAt: serverTimestamp(),
  })
  const plan = (overrides = {}) => ({ daysPerWeek: 3, intensity: "moderate", minutesPerSession: 30, kind: "Walking", notes: "", ...overrides })

  test("a dietitian can't admit or decline an applicant", async () => {
    await assertFails(updateDoc(doc(as("dietitian"), "intakeRecords", "pending1"), { status: "admitted" }))
  })
  test("a dietitian reads charts and signed notes", async () => {
    await assertSucceeds(getDoc(doc(as("dietitian"), "patients", "chart1")))
    await assertSucceeds(getDoc(doc(as("dietitian"), "patients/chart1/notes/signed1")))
  })
  test("a dietitian starts dietitian notes only", async () => {
    const db = as("dietitian")
    await assertSucceeds(setDoc(doc(db, "patients/chart1/notes/d1"), draft("dietitian", "dietitian", { type: "dietitian" })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/d2"), draft("dietitian", "dietitian", { type: "progress" })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/d3"), draft("dietitian", "dietitian", { type: "exercise", exercisePlan: plan() })))
  })
  test("the admin writes dietitian notes; a provider can't", async () => {
    await assertSucceeds(setDoc(doc(as("admin"), "patients/chart1/notes/a1"), draft("admin", "admin", { type: "dietitian" })))
    await assertFails(setDoc(doc(as("provider"), "patients/chart1/notes/p1"), draft("provider", "provider", { type: "dietitian" })))
  })
  test("a provider can't sign a dietitian draft, even their own after a role change", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "patients/chart1/notes/old"), draft("provider", "provider", { type: "dietitian" })),
    )
    await assertFails(updateDoc(doc(as("provider"), "patients/chart1/notes/old"), sign("provider", "provider")))
  })
  test("a dietitian signs their own dietitian note", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "patients/chart1/notes/mine"), draft("dietitian", "dietitian", { type: "dietitian" })),
    )
    await assertSucceeds(updateDoc(doc(as("dietitian"), "patients/chart1/notes/mine"), sign("dietitian", "dietitian")))
  })
  test("a dietitian's signing updates the chart's last note", async () => {
    await assertSucceeds(
      updateDoc(doc(as("dietitian"), "patients", "chart1"), {
        lastNote: { type: "dietitian", signedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
      }),
    )
  })
  test("a dietitian can't make a chart inactive", async () => {
    await assertFails(updateDoc(doc(as("dietitian"), "patients", "chart1"), { status: "inactive", updatedAt: serverTimestamp() }))
  })
  test("dietitian and exercise notes can't carry a prescription", async () => {
    const rx = [{ id: "r", action: "start", medication: "M", instructions: "", startDate: "", renewalDue: "", stopReason: "", renewsId: "" }]
    await assertFails(setDoc(doc(as("dietitian"), "patients/chart1/notes/r1"), draft("dietitian", "dietitian", { type: "dietitian", prescriptions: rx })))
    await assertFails(setDoc(doc(as("provider"), "patients/chart1/notes/r2"), draft("provider", "provider", { type: "exercise", exercisePlan: plan(), prescriptions: rx })))
  })
  test("an exercise plan is checked", async () => {
    const db = as("provider")
    await assertSucceeds(setDoc(doc(db, "patients/chart1/notes/e1"), draft("provider", "provider", { type: "exercise", exercisePlan: plan() })))
    await assertSucceeds(
      setDoc(doc(db, "patients/chart1/notes/e2"), draft("provider", "provider", { type: "exercise", exercisePlan: plan({ daysPerWeek: null, minutesPerSession: null, intensity: "" }) })),
    )
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e3"), draft("provider", "provider", { type: "exercise", exercisePlan: plan({ daysPerWeek: 9 }) })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e4"), draft("provider", "provider", { type: "exercise", exercisePlan: plan({ daysPerWeek: 3.5 }) })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e5"), draft("provider", "provider", { type: "exercise", exercisePlan: plan({ intensity: "extreme" }) })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e6"), draft("provider", "provider", { type: "exercise", exercisePlan: plan({ extra: 1 }) })))
    await assertFails(setDoc(doc(db, "patients/chart1/notes/e7"), draft("provider", "provider", { type: "progress", exercisePlan: plan() })))
  })
  test("a dietitian adds addenda to dietitian notes only", async () => {
    const amendment = { text: "Added detail.", authorUid: "dietitian", authorName: "dietitian", authorRole: "dietitian", at: serverTimestamp() }
    await assertSucceeds(setDoc(doc(as("dietitian"), "patients/chart1/notes/diet1/amendments/a1"), amendment))
    await assertFails(setDoc(doc(as("dietitian"), "patients/chart1/notes/signed1/amendments/a2"), amendment))
  })
  test("admins and co-admins grant and remove the dietitian role", async () => {
    await assertSucceeds(setDoc(doc(as("admin"), "user", "newdiet"), { role: "dietitian", name: "N" }))
    await assertSucceeds(updateDoc(doc(as("coadmin"), "user", "dietitian"), { role: "" }))
  })
})
```

- [ ] **Step 2: Try to run** `npm run test:rules` — Expected on this machine: fails to start the emulator (no Java). On a machine with Java: the new tests fail. Either way, continue.

- [ ] **Step 3: Rules.** In `firestore.rules`:

Replace `isClinical()` and add two helpers after it:

```
    // Everyone who works with patients: the dietitian, providers and the
    // admin tiers. Gates intake records, charts, notes and appointments.
    // isStaff() stays the gate for messages, site analytics and the staff
    // list.
    function isClinical() {
      return role() in ['dietitian', 'provider', 'coAdmin', 'admin', 'superAdmin'];
    }

    // Admits and declines applicants, and writes medical and exercise notes:
    // everyone clinical except the dietitian. Mirrors roles.canAdmit.
    function isAdmitter() {
      return role() in ['provider', 'coAdmin', 'admin', 'superAdmin'];
    }

    // Which role writes which note type. The admin (Dr. Antonious) writes
    // dietitian notes too. Exercise notes are providers' until an exercise
    // role exists. Mirrors roles.canWriteNote.
    function canWriteType(type) {
      return type == 'dietitian' ? role() in ['dietitian', 'admin'] : isAdmitter();
    }
```

In `canActOn`: admin line `previousRole in ['', 'provider', 'dietitian', 'coAdmin']`; co-admin line `previousRole in ['', 'provider', 'dietitian']`. In `isRoleChange`: `next.role in ['', 'provider', 'dietitian', 'coAdmin', 'admin', 'superAdmin']` and the last line `(role() == 'superAdmin' || next.role in ['', 'provider', 'dietitian', 'coAdmin'])`. Update the role comment block above `canActOn` to list dietitians beside providers.

`intakeRecords`: `allow update: if isAdmitter() && isStatusUpdate();`

`patients/{chartId}`: `allow create: if isAdmitter() && isNewChart(chartId);` and in `allow update` add, after the `affectedKeys().hasOnly` line:

```
        // Only an admitter moves a chart between active and inactive; the
        // dietitian's signings still update lastNote.
        && (!('status' in request.resource.data.diff(resource.data).affectedKeys()) || isAdmitter())
```

and change `lastNote.type in ['consultation', 'progress']` to `lastNote.type in ['consultation', 'progress', 'dietitian', 'exercise']`.

Add above `isNoteShape`:

```
    // An exercise prescription: whole numbers in range or null, a known
    // intensity, short text. Nothing else.
    function isExercisePlan(plan) {
      return plan is map
        && plan.keys().hasOnly(['daysPerWeek', 'intensity', 'minutesPerSession', 'kind', 'notes'])
        && (plan.get('daysPerWeek', null) == null
            || (plan.daysPerWeek is int && plan.daysPerWeek >= 0 && plan.daysPerWeek <= 7))
        && (plan.get('minutesPerSession', null) == null
            || (plan.minutesPerSession is int && plan.minutesPerSession >= 0 && plan.minutesPerSession <= 300))
        && plan.get('intensity', '') in ['', 'light', 'moderate', 'vigorous']
        && plan.get('kind', '') is string && plan.get('kind', '').size() <= 500
        && plan.get('notes', '') is string && plan.get('notes', '').size() <= 2000;
    }
```

Replace `isNoteShape` with:

```
    function isNoteShape(data) {
      return data.keys().hasOnly([
            'type', 'status', 'authorUid', 'authorName', 'authorRole', 'createdAt', 'updatedAt',
            'visitDate', 'sections', 'vitals', 'prescriptions', 'nextFollowUp', 'signedAt', 'signedBy',
            'exercisePlan'
          ])
        && data.type in ['consultation', 'progress', 'dietitian', 'exercise']
        && data.sections is map
        && data.vitals is map
        && data.prescriptions is list && data.prescriptions.size() <= 30
        // Medication lives only in the medical record.
        && (data.type in ['consultation', 'progress'] || data.prescriptions.size() == 0)
        && (!('exercisePlan' in data) || (data.type == 'exercise' && isExercisePlan(data.exercisePlan)));
    }
```

Notes `allow create`: add `&& canWriteType(request.resource.data.type)` after `isClinical()`.
Notes `allow update`: add `&& canWriteType(resource.data.type)` after `isClinical()`, and add `'exercisePlan'` to its `affectedKeys().hasOnly([...])` list.
Amendments `allow create`: add at the end

```
            // A dietitian adds addenda only to dietitian notes.
            && (role() != 'dietitian'
                || get(/databases/$(database)/documents/patients/$(chartId)/notes/$(noteId)).data.type == 'dietitian');
```

(move the existing trailing `;` accordingly).

- [ ] **Step 4: Run** `npm run test:rules` where Java exists — Expected: all tests pass, old and new. Here: note in the commit message that they're unrun. Run `npm run build` (rules aren't bundled, but confirm nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.js
git commit -m "Rules: dietitian role, dietitian and exercise notes (tests unrun: no Java)"
```

---

### Task 7: Phase 1 verification

- [ ] **Step 1:** `npm run lint` (only the 4 pre-existing warnings), `npm run build`, `npm run check` — all pass.
- [ ] **Step 2: Browser pass in demo mode.** Ask Louie for the dev server port. With Playwright from the session scratchpad, at 1280px and 375px, light and dark:
  - `/admin?demoRole=dietitian`: sidebar has no Messages, Analytics, Staff, Activity; Applicants modal shows no admit/decline buttons; a chart shows only "New dietitian note"; the diet history is prefilled; weight only, no prescriptions section; sign it; the chart's "Next follow-ups" shows the dietitian date; "Add addendum" shows on the dietitian note and not on a progress note; To-do opens on "Dietitian" and "Everything" shows the rest.
  - `/admin?demoRole=provider` (opening it resets the stored demo role): "New consultation", "New progress note", "New exercise note"; exercise note: activity level prefilled, set 3.5 days is impossible (select), 45.7 minutes rounds to 46; sign; "Current exercise plan" shows it; filter chips filter.
  - `/admin?demoRole=admin`: all four "New" buttons.
  - Scroll before screenshots (reveal animations start at opacity 0).
- [ ] **Step 3: Hand-off to Louie:** what changed, the first-consultation deviation (Global Constraints), rules tests unrun, and that CLAUDE.md's "parked" line for the dietitian's access is now stale (edit only if he asks).

---

# Phase 2: Appointments and the Calendar

### Task 8: Calendar math (Tampa time, ranges, overlaps, matching, history)

**Files:**
- Create: `src/admin/calendarMath.js`
- Create: `src/admin/calendarMath.check.js`
- Modify: `package.json` (`check` runs it)

**Interfaces:**
- Consumes: `asDate`, `daysFrom` from `chartMath.js` (Task 2).
- Produces:
  - `TIME_ZONE = "America/New_York"`
  - `tampaParts(value) → { day: "YYYY-MM-DD", time: "HH:MM", minutes: number }` (minutes since Tampa midnight)
  - `fromTampa(day, time = "00:00") → Date`
  - `addDays(day, n) → "YYYY-MM-DD"`
  - `todayInTampa(now = new Date()) → "YYYY-MM-DD"`
  - `weekDays(day) → string[7]` (Monday first); `weekRange(day) → { days, start: Date, end: Date }`
  - `monthGrid(day) → string[42]`; `monthRange(day) → { days, start, end }`
  - `overlaps(appointment, others) → appointment[]`
  - `matchingAppointment({ intakeId, discipline, date }, appointments) → appointment | null`
  - `unbookedFollowUps(followUps, appointments) → followUps[]`
  - `lanes(items: [{ id, startMin, endMin }]) → Map<id, { lane, lanes }>`
  - `changeFor(appointment, patch, reason = "") → { kind, from, to, reason } | null`

- [ ] **Step 1: Write the failing check** — `src/admin/calendarMath.check.js`:

```js
// Self-check for calendarMath.js: `npm run check`. Runs under plain node,
// which ships full ICU, so the Tampa time zone works here as in a browser.
import assert from "node:assert/strict"
import {
  addDays,
  changeFor,
  fromTampa,
  lanes,
  matchingAppointment,
  monthGrid,
  overlaps,
  tampaParts,
  todayInTampa,
  unbookedFollowUps,
  weekDays,
  weekRange,
} from "./calendarMath.js"

// Tampa wall time to an instant: EDT (-4) before Nov 1 2026, EST (-5) after.
assert.equal(fromTampa("2026-10-05", "10:00").toISOString(), "2026-10-05T14:00:00.000Z")
assert.equal(fromTampa("2026-11-02", "10:00").toISOString(), "2026-11-02T15:00:00.000Z")
assert.equal(fromTampa("2026-11-01", "00:00").toISOString(), "2026-11-01T04:00:00.000Z")

// And back, including a late evening that is already tomorrow in UTC.
assert.deepEqual(tampaParts(new Date("2026-10-05T14:00:00Z")), { day: "2026-10-05", time: "10:00", minutes: 600 })
assert.deepEqual(tampaParts("2026-10-06T02:30:00Z"), { day: "2026-10-05", time: "22:30", minutes: 1350 })
assert.equal(todayInTampa(new Date("2026-10-06T02:30:00Z")), "2026-10-05")

// Calendar days.
assert.equal(addDays("2026-10-31", 1), "2026-11-01")
assert.equal(addDays("2026-03-01", -1), "2026-02-28")

// Weeks start on Monday. Oct 1 2026 is a Thursday.
assert.deepEqual(weekDays("2026-10-01"), ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"])
assert.equal(weekDays("2026-10-04")[0], "2026-09-28")
assert.equal(weekDays("2026-10-05")[0], "2026-10-05")

// The week with the DST change runs Monday 00:00 EDT to Monday 00:00 EST:
// 7 days plus the extra hour, so nothing on Sunday Nov 1 falls outside it.
{
  const { days, start, end } = weekRange("2026-10-29")
  assert.equal(days[6], "2026-11-01")
  assert.equal(start.toISOString(), "2026-10-26T04:00:00.000Z")
  assert.equal(end.toISOString(), "2026-11-02T05:00:00.000Z")
  assert.equal(end - start, 7 * 86_400_000 + 3_600_000)
}

// Month grid: 6 weeks from the Monday on or before the 1st.
{
  const grid = monthGrid("2026-10-15")
  assert.equal(grid.length, 42)
  assert.equal(grid[0], "2026-09-28")
  assert.equal(grid[41], "2026-11-08")
}

// Overlaps: same staff member, scheduled, time ranges intersect.
{
  const at = (id, time, extra = {}) => ({ id, staffUid: "p", status: "scheduled", minutes: 30, start: fromTampa("2026-10-05", time), ...extra })
  const booking = at("new", "10:00")
  const others = [
    at("a", "10:15"),
    at("b", "10:30"),
    at("c", "09:45"),
    at("d", "10:00", { staffUid: "q" }),
    at("e", "10:00", { status: "cancelled" }),
    at("new", "10:00"),
  ]
  assert.deepEqual(overlaps(booking, others).map((a) => a.id), ["a", "c"])
}

// Matching a follow-up to a booking: same patient and discipline, within
// 3 days either side, scheduled or completed.
{
  const followUp = { intakeId: "i1", discipline: "dietitian", date: "2026-10-10" }
  const appt = (id, day, extra = {}) => ({ id, intakeId: "i1", discipline: "dietitian", status: "scheduled", start: fromTampa(day, "09:00"), ...extra })
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-13")])?.id, "a")
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-07", { status: "completed" })])?.id, "a")
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-14")]), null)
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-10", { status: "cancelled" })]), null)
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-10", { discipline: "medical" })]), null)
  assert.equal(matchingAppointment(followUp, [appt("a", "2026-10-10", { intakeId: "i2" })]), null)
  assert.deepEqual(unbookedFollowUps([followUp, { ...followUp, intakeId: "i2" }], [appt("a", "2026-10-11")]), [{ ...followUp, intakeId: "i2" }])
}

// Lanes: overlapping blocks sit side by side; a later block reuses lane 0.
{
  const placed = lanes([
    { id: "a", startMin: 600, endMin: 630 },
    { id: "b", startMin: 615, endMin: 645 },
    { id: "c", startMin: 700, endMin: 730 },
  ])
  assert.deepEqual(placed.get("a"), { lane: 0, lanes: 2 })
  assert.deepEqual(placed.get("b"), { lane: 1, lanes: 2 })
  assert.deepEqual(placed.get("c"), { lane: 0, lanes: 1 })
}

// History entries: what changed, from what, to what.
{
  const appointment = { start: fromTampa("2026-10-05", "10:00"), minutes: 30, staffUid: "p", staffName: "P", status: "scheduled", note: "" }
  const moved = changeFor(appointment, { start: fromTampa("2026-10-07", "14:00"), minutes: 30, staffUid: "p", staffName: "P", note: "" })
  assert.equal(moved.kind, "moved")
  assert.deepEqual(Object.keys(moved.from), ["start"])
  assert.equal(moved.to.start.toISOString(), "2026-10-07T18:00:00.000Z")
  assert.equal(changeFor(appointment, { start: fromTampa("2026-10-05", "10:00"), minutes: 30 }), null)
  assert.equal(changeFor(appointment, { status: "cancelled" }, "Patient called").kind, "cancelled")
  assert.equal(changeFor(appointment, { status: "cancelled" }, "Patient called").reason, "Patient called")
  assert.equal(changeFor(appointment, { status: "noShow" }).kind, "noShow")
  assert.equal(changeFor(appointment, { status: "completed" }).kind, "completed")
  assert.equal(changeFor(appointment, { note: "Bring food log" }).kind, "noteEdited")
  assert.equal(changeFor(appointment, { staffUid: "q", staffName: "Q" }).kind, "moved")
}

console.log("calendarMath: all checks passed")
```

`package.json`: `"check": "node src/admin/chartMath.check.js && node src/admin/roles.check.js && node src/admin/calendarMath.check.js",`

- [ ] **Step 2: Run** `npm run check` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/admin/calendarMath.js`:

```js
// Calendar arithmetic, all in Tampa time whatever the viewer's computer is
// set to. Pure (no React, no Firebase) so calendarMath.check.js runs it
// under plain node. Calendar days are "YYYY-MM-DD" strings throughout.
import { asDate, daysFrom } from "./chartMath.js"

export const TIME_ZONE = "America/New_York"

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

const partsOf = (date) => Object.fromEntries(PARTS.formatToParts(date).map(({ type, value }) => [type, value]))

// Tampa's offset from UTC, in minutes, at a given instant (-240 EDT, -300 EST).
function offsetMinutes(ms) {
  const p = partsOf(new Date(ms))
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000
}

export function tampaParts(value) {
  const p = partsOf(asDate(value))
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, minutes: +p.hour * 60 + +p.minute }
}

// A Tampa wall-clock time as an instant. Two passes, so a time just after a
// DST change uses the offset in force at that time, not the one before it.
export function fromTampa(day, time = "00:00") {
  const [year, month, date] = day.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const wall = Date.UTC(year, month - 1, date, hour, minute)
  const first = wall - offsetMinutes(wall) * 60000
  return new Date(wall - offsetMinutes(first) * 60000)
}

export function addDays(day, count) {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, date + count)).toISOString().slice(0, 10)
}

export const todayInTampa = (now = new Date()) => tampaParts(now).day

// 0 = Monday … 6 = Sunday.
const weekday = (day) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7

export function weekDays(day) {
  const monday = addDays(day, -weekday(day))
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function weekRange(day) {
  const days = weekDays(day)
  return { days, start: fromTampa(days[0]), end: fromTampa(addDays(days[0], 7)) }
}

export function monthGrid(day) {
  const first = `${day.slice(0, 7)}-01`
  const gridStart = addDays(first, -weekday(first))
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

export function monthRange(day) {
  const days = monthGrid(day)
  return { days, start: fromTampa(days[0]), end: fromTampa(addDays(days[41], 1)) }
}

const startMs = (appointment) => asDate(appointment.start)?.getTime() ?? 0
const endMs = (appointment) => startMs(appointment) + appointment.minutes * 60000

// Scheduled appointments of the same staff member that overlap this one.
export const overlaps = (appointment, others) =>
  others.filter(
    (other) =>
      other.id !== appointment.id &&
      other.status === "scheduled" &&
      other.staffUid === appointment.staffUid &&
      startMs(other) < endMs(appointment) &&
      startMs(appointment) < endMs(other),
  )

// A follow-up counts as booked when the same patient has a scheduled or
// completed appointment of the same discipline within 3 days of its date.
const MATCH_DAYS = 3

export const matchingAppointment = (followUp, appointments) =>
  appointments.find(
    (appointment) =>
      appointment.intakeId === followUp.intakeId &&
      appointment.discipline === followUp.discipline &&
      (appointment.status === "scheduled" || appointment.status === "completed") &&
      Math.abs(daysFrom(followUp.date, tampaParts(appointment.start).day)) <= MATCH_DAYS,
  ) ?? null

export const unbookedFollowUps = (followUps, appointments) =>
  followUps.filter((followUp) => !matchingAppointment(followUp, appointments))

// Side-by-side columns for overlapping blocks in one day of the week view.
// Each cluster of mutually overlapping blocks shares a lane count.
export function lanes(items) {
  const placed = new Map()
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  let cluster = []
  let clusterEnd = -1
  const close = () => {
    const count = Math.max(0, ...cluster.map((id) => placed.get(id).lane)) + 1
    for (const id of cluster) placed.get(id).lanes = count
    cluster = []
  }
  for (const item of sorted) {
    if (cluster.length && item.startMin >= clusterEnd) close()
    const busy = new Set(
      cluster.filter((id) => sorted.find((other) => other.id === id).endMin > item.startMin).map((id) => placed.get(id).lane),
    )
    let lane = 0
    while (busy.has(lane)) lane += 1
    placed.set(item.id, { lane, lanes: 1 })
    cluster.push(item.id)
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  if (cluster.length) close()
  return placed
}

const sameValue = (a, b) => {
  const dateA = a instanceof Date || typeof a?.toDate === "function" ? asDate(a)?.getTime() : null
  const dateB = b instanceof Date || typeof b?.toDate === "function" ? asDate(b)?.getTime() : null
  return dateA != null || dateB != null ? dateA === dateB : a === b
}

// The history entry for an edit: which fields changed, from what, to what.
// null when nothing actually changed (so no empty entries get written).
export function changeFor(appointment, patch, reason = "") {
  const keys = Object.keys(patch).filter((key) => !sameValue(appointment[key], patch[key]))
  if (!keys.length) return null
  const kind = ["cancelled", "completed", "noShow"].includes(patch.status)
    ? patch.status
    : keys.every((key) => key === "note")
      ? "noteEdited"
      : "moved"
  const pick = (source) => Object.fromEntries(keys.map((key) => [key, source[key]]))
  return { kind, from: pick(appointment), to: pick(patch), reason }
}
```

- [ ] **Step 4: Run** `npm run check` — Expected: all three pass.

- [ ] **Step 5: Commit**

```bash
git add package.json src/admin/calendarMath.js src/admin/calendarMath.check.js
git commit -m "Admin: calendar math in Tampa time, with self-check"
```

---

### Task 9: Appointment store and demo data

**Files:**
- Create: `src/admin/appointmentStore.js`
- Modify: `src/admin/chartStore.js` (export the demo store)
- Modify: `src/admin/seedCharts.js` (appointments, changes)
- Modify: `src/admin/firebase.js` (`AUDIT_ACTIONS`)
- Modify: `src/admin/Activity.jsx` (`ACTION_LABELS`)

**Interfaces:**
- Consumes: `fromTampa`, `addDays`, `todayInTampa`, `changeFor` (Task 8).
- Produces:
  - `loadAppointments(from: Date, to: Date) → Promise<appointment[]>` (sorted by start)
  - `loadAppointmentsFor(intakeId) → Promise<appointment[]>` (sorted by start)
  - `bookAppointment({ intakeId, patientName, staffUid, staffName, discipline, start: Date, minutes, note }, actor) → Promise<appointment>`
  - `changeAppointment(appointment, patch, change, actor) → Promise<appointment>` (patch ⊆ start/minutes/staffUid/staffName/status/note; `change` from `changeFor`)
  - `loadChanges(appointmentId) → Promise<change[]>` (oldest first)
  - `AUDIT_ACTIONS.bookAppointment = "book_appointment"`, `moveAppointment = "move_appointment"`, `cancelAppointment = "cancel_appointment"`, `updateAppointmentStatus = "update_appointment_status"`
  - Appointment shape (spec): `{ id, intakeId, patientName, staffUid, staffName, discipline, start, minutes, status, note, addedBy: { uid, name, role }, addedAt, updatedAt, lastChangeId? }`

- [ ] **Step 1: Export the demo store.** In `src/admin/chartStore.js` rename `async function demo()` to `export async function getDemoStore()` and `const demoId` to `export const demoId`; update every `demo()` call in the file to `getDemoStore()`.

- [ ] **Step 2: Audit actions.** In `src/admin/firebase.js` `AUDIT_ACTIONS` add:

```js
  bookAppointment: "book_appointment",
  moveAppointment: "move_appointment",
  cancelAppointment: "cancel_appointment",
  updateAppointmentStatus: "update_appointment_status",
```

In `src/admin/Activity.jsx` `ACTION_LABELS` add:

```js
  [AUDIT_ACTIONS.bookAppointment]: "Booked an appointment",
  [AUDIT_ACTIONS.moveAppointment]: "Changed an appointment",
  [AUDIT_ACTIONS.cancelAppointment]: "Cancelled an appointment",
  [AUDIT_ACTIONS.updateAppointmentStatus]: "Marked an appointment",
```

- [ ] **Step 3: Store** — `src/admin/appointmentStore.js`:

```js
// Appointments: every read and write goes through here. firestore.rules is
// the real boundary (the appointments block): who added it is fixed at
// creation, every later change is written in the same batch as a history
// entry, and nothing is ever deleted (cancel instead). Appointments hold
// patient names and visit times, so they carry the same BAA requirement as
// intake records. Demo mode runs against chartStore's in-memory store.
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore"
import { asDate } from "./chartMath"
import { demoId, getDemoStore } from "./chartStore"
import { db, usingSeedData } from "./firebase"

export const APPOINTMENTS_COLLECTION = "appointments"
const CHANGES = "changes"

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

const byStart = (a, b) => (asDate(a.start)?.getTime() ?? 0) - (asDate(b.start)?.getTime() ?? 0)
const fromSnapshot = (snapshot) => snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort(byStart)
const copy = (appointment) => ({ ...appointment, addedBy: { ...appointment.addedBy } })

// Firestore stores a JS Date as a timestamp, so `start` goes in as a Date.
export async function loadAppointments(from, to) {
  if (usingSeedData) {
    return (await getDemoStore()).appointments
      .filter((appointment) => appointment.start >= from && appointment.start < to)
      .map(copy)
      .sort(byStart)
  }
  return fromSnapshot(
    await getDocs(
      query(
        collection(requireDb(), APPOINTMENTS_COLLECTION),
        where("start", ">=", from),
        where("start", "<", to),
        orderBy("start"),
      ),
    ),
  )
}

export async function loadAppointmentsFor(intakeId) {
  if (usingSeedData) {
    return (await getDemoStore()).appointments.filter((appointment) => appointment.intakeId === intakeId).map(copy).sort(byStart)
  }
  return fromSnapshot(await getDocs(query(collection(requireDb(), APPOINTMENTS_COLLECTION), where("intakeId", "==", intakeId))))
}

export async function bookAppointment({ intakeId, patientName, staffUid, staffName, discipline, start, minutes, note }, actor) {
  const base = {
    intakeId,
    patientName,
    staffUid,
    staffName,
    discipline,
    start,
    minutes,
    note,
    status: "scheduled",
    addedBy: { uid: actor.uid, name: actor.name, role: actor.role },
  }
  if (usingSeedData) {
    const appointment = { id: demoId(), ...base, addedAt: new Date(), updatedAt: new Date() }
    ;(await getDemoStore()).appointments.push(appointment)
    return copy(appointment)
  }
  const ref = await addDoc(collection(requireDb(), APPOINTMENTS_COLLECTION), {
    ...base,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { id: ref.id, ...base, addedAt: new Date(), updatedAt: new Date() }
}

// One batch: the appointment's new values plus the history entry that
// explains them. The rules refuse an update without its entry.
export async function changeAppointment(appointment, patch, change, actor) {
  const by = { uid: actor.uid, name: actor.name, role: actor.role }
  if (usingSeedData) {
    const store = await getDemoStore()
    const stored = store.appointments.find((entry) => entry.id === appointment.id)
    if (stored.status !== "scheduled") throw Object.assign(new Error("Not scheduled"), { code: "permission-denied" })
    const entry = { id: demoId(), ...change, by, at: new Date() }
    Object.assign(stored, patch, { updatedAt: new Date(), lastChangeId: entry.id })
    store.appointmentChanges.set(appointment.id, [...(store.appointmentChanges.get(appointment.id) ?? []), entry])
    return copy(stored)
  }
  const database = requireDb()
  const appointmentRef = doc(database, APPOINTMENTS_COLLECTION, appointment.id)
  const changeRef = doc(collection(appointmentRef, CHANGES))
  const batch = writeBatch(database)
  batch.update(appointmentRef, { ...patch, updatedAt: serverTimestamp(), lastChangeId: changeRef.id })
  batch.set(changeRef, { kind: change.kind, from: change.from, to: change.to, reason: change.reason ?? "", by, at: serverTimestamp() })
  await batch.commit()
  return { ...appointment, ...patch, updatedAt: new Date(), lastChangeId: changeRef.id }
}

export async function loadChanges(appointmentId) {
  if (usingSeedData) return [...((await getDemoStore()).appointmentChanges.get(appointmentId) ?? [])]
  return (
    await getDocs(query(collection(requireDb(), APPOINTMENTS_COLLECTION, appointmentId, CHANGES), orderBy("at", "asc")))
  ).docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}
```

- [ ] **Step 4: Demo appointments.** In `src/admin/seedCharts.js` add `import { addDays, changeFor, fromTampa, todayInTampa } from "./calendarMath"` at the top. Before `const staff = [` add:

```js
  // A week of appointments across the first few charts, with one moved and
  // one cancelled so the History list has something to show. The last
  // chart's medical follow-up is left unbooked, for the calendar marker.
  const today = todayInTampa()
  const chartIds = [...charts.keys()]
  const appointments = []
  const appointmentChanges = new Map()
  const SLOTS = [
    [0, "09:00", "medical", PROVIDER],
    [0, "10:30", "dietitian", DIETITIAN],
    [1, "14:00", "exercise", PROVIDER],
    [2, "11:00", "medical", PROVIDER],
    [3, "09:30", "dietitian", DIETITIAN],
  ]
  SLOTS.forEach(([offset, time, discipline, staffMember], index) => {
    const chartId = chartIds[index % Math.max(1, chartIds.length - 1)]
    if (!chartId) return
    const chart = charts.get(chartId)
    appointments.push({
      id: `demo-appt-${index}`,
      intakeId: chartId,
      patientName: `${chart.firstName} ${chart.lastName}`.trim(),
      staffUid: staffMember.uid,
      staffName: staffMember.name,
      discipline,
      start: fromTampa(addDays(today, offset), time),
      minutes: 30,
      status: "scheduled",
      note: "",
      addedBy: { uid: "demo-super", name: "Hyacinth team", role: "superAdmin" },
      addedAt: new Date(now - 3 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    })
  })
  if (appointments[0]) {
    const before = appointments[0]
    const patch = { start: fromTampa(addDays(today, 1), "09:00") }
    const change = changeFor(before, patch)
    appointmentChanges.set(before.id, [{ id: "demo-change-0", ...change, by: PROVIDER, at: new Date(now - DAY) }])
    Object.assign(before, patch, { lastChangeId: "demo-change-0" })
  }
  if (appointments[3]) {
    const change = changeFor(appointments[3], { status: "cancelled" }, "Patient asked to move to next week")
    appointmentChanges.set(appointments[3].id, [{ id: "demo-change-1", ...change, by: PROVIDER, at: new Date(now - 2 * DAY) }])
    Object.assign(appointments[3], { status: "cancelled", lastChangeId: "demo-change-1" })
  }
```

and return `{ charts, notes, amendments, staff, appointments, appointmentChanges }`.

- [ ] **Step 5: Build, lint, check** — pass.

- [ ] **Step 6: Commit**

```bash
git add src/admin/appointmentStore.js src/admin/chartStore.js src/admin/seedCharts.js src/admin/firebase.js src/admin/Activity.jsx
git commit -m "Admin: appointment store with history, demo appointments"
```

---

### Task 10: Rules for appointments, and a staff list clinicians can read

**Files:**
- Modify: `firestore.rules`
- Test: `tests/firestore.rules.test.js`

Why the staff-list change: booking for another staff member needs their name and uid, and today only co-admins and up can read `user/{uid}`. This opens **read** of non-super-admin staff records to every clinical role (name, email, role). Writes are unchanged. Super admins stay hidden. Flag it to Louie at hand-off.

- [ ] **Step 1: Write the failing tests** — append to `tests/firestore.rules.test.js`:

```js
describe("appointments", () => {
  const booking = (uid, role, overrides = {}) => ({
    intakeId: "pending1",
    patientName: "Pat Doe",
    staffUid: "provider",
    staffName: "provider",
    discipline: "medical",
    start: new Date("2026-10-05T14:00:00Z"),
    minutes: 30,
    status: "scheduled",
    note: "",
    addedBy: { uid, name: uid, role },
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  })
  const change = (uid, role, overrides = {}) => ({
    kind: "moved",
    from: { start: new Date("2026-10-05T14:00:00Z") },
    to: { start: new Date("2026-10-07T18:00:00Z") },
    reason: "",
    by: { uid, name: uid, role },
    at: serverTimestamp(),
    ...overrides,
  })
  const seed = () =>
    env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "appointments", "ap1"), { ...booking("admin", "admin"), addedAt: new Date(), updatedAt: new Date() }),
    )
  const move = (db, uid, role, changeId, patch = { start: new Date("2026-10-07T18:00:00Z") }, entry = change(uid, role)) => {
    const batch = writeBatch(db)
    batch.update(doc(db, "appointments", "ap1"), { ...patch, updatedAt: serverTimestamp(), lastChangeId: changeId })
    batch.set(doc(db, "appointments/ap1/changes", changeId), entry)
    return batch.commit()
  }

  test("any clinician books, signed as themselves at server time", async () => {
    await assertSucceeds(setDoc(doc(as("dietitian"), "appointments", "n1"), booking("dietitian", "dietitian")))
    await assertSucceeds(setDoc(doc(as("provider"), "appointments", "n2"), booking("provider", "provider")))
  })
  test("a booking can't claim someone else added it, or a past time", async () => {
    await assertFails(setDoc(doc(as("provider"), "appointments", "n1"), booking("admin", "admin")))
    await assertFails(setDoc(doc(as("provider"), "appointments", "n2"), booking("provider", "provider", { addedAt: new Date("2020-01-01") })))
  })
  test("a booking starts scheduled, with a known discipline and length", async () => {
    const db = as("provider")
    await assertFails(setDoc(doc(db, "appointments", "n1"), booking("provider", "provider", { status: "completed" })))
    await assertFails(setDoc(doc(db, "appointments", "n2"), booking("provider", "provider", { discipline: "massage" })))
    await assertFails(setDoc(doc(db, "appointments", "n3"), booking("provider", "provider", { minutes: 20 })))
    await assertFails(setDoc(doc(db, "appointments", "n4"), booking("provider", "provider", { intakeId: "nope" })))
  })
  test("someone with no role can't read or book", async () => {
    await assertFails(getDoc(doc(as("nobody"), "appointments", "ap1")))
    await assertFails(setDoc(doc(as("nobody"), "appointments", "n1"), booking("nobody", "")))
  })
  test("a move with its history entry succeeds", async () => {
    await seed()
    await assertSucceeds(move(as("provider"), "provider", "provider", "c1"))
  })
  test("a move without a history entry fails", async () => {
    await seed()
    await assertFails(updateDoc(doc(as("provider"), "appointments", "ap1"), { start: new Date("2026-10-07T18:00:00Z"), updatedAt: serverTimestamp() }))
    await assertFails(
      updateDoc(doc(as("provider"), "appointments", "ap1"), { start: new Date("2026-10-07T18:00:00Z"), updatedAt: serverTimestamp(), lastChangeId: "ghost" }),
    )
  })
  test("a history entry can't be signed as someone else", async () => {
    await seed()
    await assertFails(move(as("provider"), "provider", "provider", "c1", undefined, change("admin", "admin")))
  })
  test("'added by' never changes", async () => {
    await seed()
    await assertFails(move(as("provider"), "provider", "provider", "c1", { addedBy: { uid: "provider", name: "provider", role: "provider" } }))
  })
  test("a cancelled appointment can't be moved", async () => {
    await seed()
    await assertSucceeds(move(as("provider"), "provider", "provider", "c1", { status: "cancelled" }, change("provider", "provider", { kind: "cancelled", from: { status: "scheduled" }, to: { status: "cancelled" } })))
    await assertFails(move(as("admin"), "admin", "admin", "c2"))
  })
  test("appointments are never deleted", async () => {
    await seed()
    await assertFails(deleteDoc(doc(as("super"), "appointments", "ap1")))
  })
  test("history: co-admins and up read it; providers and the dietitian don't; nobody edits it", async () => {
    await seed()
    await move(as("provider"), "provider", "provider", "c1")
    await assertSucceeds(getDoc(doc(as("coadmin"), "appointments/ap1/changes/c1")))
    await assertSucceeds(getDoc(doc(as("admin"), "appointments/ap1/changes/c1")))
    await assertFails(getDoc(doc(as("provider"), "appointments/ap1/changes/c1")))
    await assertFails(getDoc(doc(as("dietitian"), "appointments/ap1/changes/c1")))
    await assertFails(updateDoc(doc(as("super"), "appointments/ap1/changes/c1"), { reason: "edited" }))
    await assertFails(deleteDoc(doc(as("super"), "appointments/ap1/changes/c1")))
  })
  test("a history entry can't be written on its own", async () => {
    await seed()
    await assertFails(setDoc(doc(as("provider"), "appointments/ap1/changes/lonely"), change("provider", "provider")))
  })
  test("clinicians read the staff list, minus super admins", async () => {
    const db = as("provider")
    await assertSucceeds(getDoc(doc(db, "user", "dietitian")))
    await assertFails(getDoc(doc(db, "user", "super")))
    await assertSucceeds(getDocs(query(collection(db, "user"), where("role", "in", ["", "provider", "dietitian", "coAdmin", "admin"]))))
  })
})
```

- [ ] **Step 2: Try to run** `npm run test:rules` (no Java here; on a Java machine, Expected: new tests FAIL).

- [ ] **Step 3: Rules.** In `firestore.rules`:

`user/{uid}` read becomes:

```
      // Clinicians read the staff list (the calendar books for any of them);
      // super admins stay hidden from everyone but super admins.
      allow read: if request.auth != null
        && (request.auth.uid == uid
            || role() == 'superAdmin'
            || (isClinical() && resource.data.get('role', '') != 'superAdmin'));
```

Add before the final `match /{document=**}`:

```
    // --- Appointments --------------------------------------------------------
    // Booked by any clinician for any patient or applicant (intakeId is the
    // intake record's id, which becomes the chart id on admission). Who added
    // it is fixed at creation; every later change lands in the same batch as
    // an append-only history entry (changes/{id}) naming who made it, and
    // only co-admins and up read that history (Louie, 2026-10-02). Nothing is
    // deleted: an appointment is cancelled instead. PHI: patient names and
    // visit times, so the same BAA requirement as intakeRecords.
    function isAppointmentShape(data) {
      return data.keys().hasOnly([
            'intakeId', 'patientName', 'staffUid', 'staffName', 'discipline', 'start', 'minutes',
            'status', 'note', 'addedBy', 'addedAt', 'updatedAt', 'lastChangeId'
          ])
        && data.intakeId is string
        && exists(/databases/$(database)/documents/intakeRecords/$(data.intakeId))
        && data.patientName is string && data.patientName.size() > 0 && data.patientName.size() <= 200
        && data.staffUid is string && data.staffUid.size() > 0 && data.staffUid.size() <= 200
        && data.staffName is string && data.staffName.size() <= 200
        && data.discipline in ['medical', 'dietitian', 'exercise']
        && data.start is timestamp
        && data.minutes in [15, 30, 45, 60]
        && data.status in ['scheduled', 'completed', 'cancelled', 'noShow']
        && data.note is string && data.note.size() <= 500;
    }

    function isMe(by) {
      return by is map
        && by.keys().hasOnly(['uid', 'name', 'role'])
        && by.uid == request.auth.uid
        && by.name == myName()
        && by.role == role();
    }

    match /appointments/{appointmentId} {
      allow read: if isClinical();
      allow create: if isClinical()
        && isAppointmentShape(request.resource.data)
        && !('lastChangeId' in request.resource.data)
        && request.resource.data.status == 'scheduled'
        && isMe(request.resource.data.addedBy)
        && request.resource.data.addedAt == request.time
        && request.resource.data.updatedAt == request.time;
      // Only a scheduled appointment changes, only these fields, and only
      // with a brand-new history entry written in the same batch.
      allow update: if isClinical()
        && resource.data.status == 'scheduled'
        && isAppointmentShape(request.resource.data)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
             'start', 'minutes', 'staffUid', 'staffName', 'status', 'note', 'updatedAt', 'lastChangeId'
           ])
        && request.resource.data.updatedAt == request.time
        && request.resource.data.lastChangeId is string
        && request.resource.data.lastChangeId != resource.data.get('lastChangeId', '')
        && !exists(/databases/$(database)/documents/appointments/$(appointmentId)/changes/$(request.resource.data.lastChangeId))
        && existsAfter(/databases/$(database)/documents/appointments/$(appointmentId)/changes/$(request.resource.data.lastChangeId));
      allow delete: if false;

      match /changes/{changeId} {
        allow read: if isStaff();
        allow create: if isClinical()
          && request.resource.data.keys().hasOnly(['kind', 'from', 'to', 'reason', 'by', 'at'])
          && request.resource.data.kind in ['moved', 'cancelled', 'completed', 'noShow', 'noteEdited']
          && request.resource.data.from is map
          && request.resource.data.to is map
          && request.resource.data.reason is string && request.resource.data.reason.size() <= 500
          && isMe(request.resource.data.by)
          && request.resource.data.at == request.time
          // Only as part of the appointment update that it explains.
          && getAfter(/databases/$(database)/documents/appointments/$(appointmentId)).data.get('lastChangeId', '') == changeId;
        allow update, delete: if false;
      }
    }
```

- [ ] **Step 4: Run** `npm run test:rules` on a Java machine: all pass. Here: unrun.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.js
git commit -m "Rules: appointments with append-only history (tests unrun: no Java)"
```

---

### Task 11: Booking and editing dialog

**Files:**
- Create: `src/admin/AppointmentDialog.jsx`
- Modify: `src/admin/roles.js` (add `canSeeAppointmentHistory`)
- Modify: `src/admin/roles.check.js`

**Interfaces:**
- Consumes: appointment store (Task 9), `fromTampa`, `tampaParts`, `todayInTampa`, `overlaps`, `changeFor` (Task 8), `loadStaff` (chartStore), `loadIntakeRecords` (firebase.js), `ConfirmDialog`, `Select`, `DatePicker`, `getAdminPortalRoot`, `DISCIPLINE_LABELS`, `ROLE_LABELS`, `formatStamp`, `inputClass`, `labelClass`.
- Produces: `<AppointmentDialog appointment={appointment | null} prefill={{ intakeId?, patientName?, discipline?, day?, time? }} actor onClose onSaved={(appointment) => void} />`; `canSeeAppointmentHistory(role) → boolean`.

- [ ] **Step 1: Failing check.** Append to `src/admin/roles.check.js` (and add `canSeeAppointmentHistory` to its import):

```js
// Appointment history: co-admin, admin, super admin.
for (const role of ["coAdmin", "admin", "superAdmin"]) assert.equal(canSeeAppointmentHistory(role), true, role)
for (const role of ["provider", "dietitian", ""]) assert.equal(canSeeAppointmentHistory(role), false, role)
```

Run `npm run check` — FAIL.

- [ ] **Step 2: Implement** in `src/admin/roles.js` after `canAmend`:

```js
// Who sees an appointment's move and cancel history (Louie, 2026-10-02).
// Mirrors the changes read rule (isStaff) in firestore.rules.
export const canSeeAppointmentHistory = (role) => STAFF_ROLES.includes(role)
```

Run `npm run check` — PASS.

- [ ] **Step 3: The dialog** — `src/admin/AppointmentDialog.jsx`:

```jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import DatePicker from "../components/DatePicker"
import Select from "../components/Select"
import { bookAppointment, changeAppointment, loadAppointments, loadChanges } from "./appointmentStore"
import { addDays, changeFor, fromTampa, overlaps, tampaParts, todayInTampa } from "./calendarMath"
import { loadStaff } from "./chartStore"
import { AUDIT_ACTIONS, loadIntakeRecords, recordAuditEvent } from "./firebase"
import { CloseIcon } from "./icons"
import { DISCIPLINE_LABELS, formatStamp, inputClass, labelClass } from "./noteUi"
import { getAdminPortalRoot } from "./portalRoot"
import { ROLE_LABELS, canSeeAppointmentHistory, isClinicalRole } from "./roles"

const COMPACT = "px-3 py-2 text-sm"
const LENGTHS = [15, 30, 45, 60].map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))
const DISCIPLINE_OPTIONS = Object.entries(DISCIPLINE_LABELS).map(([value, label]) => ({ value, label }))
// 6:00 AM to 9:00 PM in 15-minute steps.
const TIMES = Array.from({ length: 61 }, (_, index) => {
  const minutes = 6 * 60 + index * 15
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
  const label = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)).toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  })
  return { value, label }
})
const STATUS_LABELS = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", noShow: "No-show" }
const STALE = "This appointment changed somewhere else. Close it to see the latest."

const whenText = (value) =>
  value
    ? new Date(value.toDate ? value.toDate() : value).toLocaleString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : ""

function historyLine(change) {
  const by = `${change.by?.name ?? "Someone"}, ${formatStamp(change.at)}`
  if (change.kind === "cancelled") return `Cancelled${change.reason ? ` (${change.reason})` : ""}, by ${by}`
  if (change.kind === "completed") return `Marked completed, by ${by}`
  if (change.kind === "noShow") return `Marked no-show, by ${by}`
  if (change.kind === "noteEdited") return `Note changed, by ${by}`
  const parts = []
  if (change.from.start || change.to.start) parts.push(`from ${whenText(change.from.start)} to ${whenText(change.to.start)}`)
  if (change.from.minutes || change.to.minutes) parts.push(`length ${change.from.minutes} to ${change.to.minutes} min`)
  if (change.from.staffName || change.to.staffName) parts.push(`${change.from.staffName} to ${change.to.staffName}`)
  return `Moved ${parts.join(", ")}, by ${by}`
}

function Field({ label, children }) {
  return (
    <div>
      <span className={labelClass} aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  )
}

// Book a new appointment, or view and change an existing one. Every change
// is written with a history entry naming who made it (appointmentStore,
// firestore.rules), so there is no free-form edit of "Added by".
export default function AppointmentDialog({ appointment, prefill = {}, actor, onClose, onSaved }) {
  const isNew = !appointment
  const editable = isNew || appointment.status === "scheduled"
  const startParts = appointment ? tampaParts(appointment.start) : null
  const [form, setForm] = useState(() => ({
    intakeId: appointment?.intakeId ?? prefill.intakeId ?? "",
    patientName: appointment?.patientName ?? prefill.patientName ?? "",
    staffUid: appointment?.staffUid ?? (isClinicalRole(actor.role) && actor.role !== "superAdmin" ? actor.uid : ""),
    staffName: appointment?.staffName ?? (isClinicalRole(actor.role) && actor.role !== "superAdmin" ? actor.name : ""),
    discipline: appointment?.discipline ?? prefill.discipline ?? (actor.role === "dietitian" ? "dietitian" : "medical"),
    day: startParts?.day ?? prefill.day ?? todayInTampa(),
    time: startParts?.time ?? prefill.time ?? "09:00",
    minutes: appointment?.minutes ?? 30,
    note: appointment?.note ?? "",
  }))
  const [staff, setStaff] = useState([])
  const [patients, setPatients] = useState(null)
  const [search, setSearch] = useState("")
  const [sameDay, setSameDay] = useState([])
  const [history, setHistory] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("")
  const closeRef = useRef(null)
  const set = (patch) => setForm((previous) => ({ ...previous, ...patch }))

  useEffect(() => {
    closeRef.current?.focus()
    loadStaff(actor.role)
      .then((members) => setStaff(members.filter((member) => isClinicalRole(member.role) && member.role !== "superAdmin")))
      .catch((cause) => console.error("Staff list failed:", cause.code ?? cause.message))
    if (isNew && !prefill.intakeId) {
      loadIntakeRecords()
        .then((records) => setPatients(records.filter((record) => record.status !== "declined")))
        .catch((cause) => console.error("Patient list failed:", cause.code ?? cause.message))
    }
    if (!isNew && canSeeAppointmentHistory(actor.role)) {
      loadChanges(appointment.id)
        .then(setHistory)
        .catch((cause) => console.error("History failed:", cause.code ?? cause.message))
    }
  }, [actor.role, appointment?.id, isNew, prefill.intakeId])

  // Same-day bookings, for the overlap warning.
  useEffect(() => {
    let active = true
    loadAppointments(fromTampa(form.day), fromTampa(addDays(form.day, 1)))
      .then((list) => active && setSameDay(list))
      .catch(() => active && setSameDay([]))
    return () => {
      active = false
    }
  }, [form.day])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [busy, onClose])

  const start = fromTampa(form.day, form.time)
  const clashes = overlaps({ id: appointment?.id, staffUid: form.staffUid, start, minutes: form.minutes }, sameDay)
  const matches = useMemo(() => {
    if (!patients || !search.trim()) return []
    const needle = search.trim().toLowerCase()
    return patients
      .filter((record) => `${record.demographics?.firstName ?? ""} ${record.demographics?.lastName ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [patients, search])
  const problem = !form.intakeId ? "Choose a patient." : !form.staffUid ? "Choose who the appointment is with." : null

  const fail = (cause, fallback) => {
    console.error("Appointment write failed:", cause.code ?? cause.message)
    setError(cause?.code === "permission-denied" ? (isNew ? "Your role can't do this." : STALE) : fallback)
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const fields = {
      start,
      minutes: Number(form.minutes),
      staffUid: form.staffUid,
      staffName: form.staffName,
      note: form.note.trim(),
    }
    try {
      if (isNew) {
        const saved = await bookAppointment(
          { ...fields, intakeId: form.intakeId, patientName: form.patientName, discipline: form.discipline },
          actor,
        )
        recordAuditEvent({ action: AUDIT_ACTIONS.bookAppointment, targetCollection: "appointments", targetId: saved.id, targetLabel: saved.patientName })
        onSaved(saved)
        return
      }
      const change = changeFor(appointment, fields)
      if (!change) {
        onClose()
        return
      }
      const saved = await changeAppointment(appointment, fields, change, actor)
      recordAuditEvent({ action: AUDIT_ACTIONS.moveAppointment, targetCollection: "appointments", targetId: saved.id, targetLabel: saved.patientName })
      onSaved(saved)
    } catch (cause) {
      fail(cause, "Couldn't save. Nothing was changed. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (status) => {
    setBusy(true)
    setError(null)
    try {
      const saved = await changeAppointment(appointment, { status }, changeFor(appointment, { status }, reason.trim()), actor)
      recordAuditEvent({
        action: status === "cancelled" ? AUDIT_ACTIONS.cancelAppointment : AUDIT_ACTIONS.updateAppointmentStatus,
        targetCollection: "appointments",
        targetId: saved.id,
        targetLabel: saved.patientName,
      })
      onSaved(saved)
    } catch (cause) {
      setCancelling(false)
      fail(cause, "Couldn't update. Nothing was changed. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const staffOptions = staff.map((member) => ({
    value: member.uid,
    label: `${member.name || member.email} (${ROLE_LABELS[member.role]})`,
  }))

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div aria-hidden="true" onClick={() => !busy && onClose()} className="absolute inset-0 bg-scrim/50" />
      <div className="flex h-full items-end justify-center sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isNew ? "Book appointment" : `Appointment for ${appointment.patientName}`}
          className="relative flex max-h-[96dvh] w-full max-w-xl flex-col rounded-t-3xl bg-paper-50 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-950/10 px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <p className="font-serif text-xl text-ink-950">{isNew ? "Book appointment" : appointment.patientName}</p>
              {!isNew && (
                <p className="mt-0.5 text-sm text-ink-950/55">
                  {DISCIPLINE_LABELS[appointment.discipline]}, {STATUS_LABELS[appointment.status]}
                </p>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="rounded-lg p-1.5 text-ink-950/50 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>

          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
            {isNew && !prefill.intakeId ? (
              <div>
                <label className="block">
                  <span className={labelClass}>Patient or applicant</span>
                  <input
                    value={form.intakeId ? form.patientName : search}
                    onChange={(event) => {
                      set({ intakeId: "", patientName: "" })
                      setSearch(event.target.value)
                    }}
                    placeholder={patients ? "Search by name" : "Loading…"}
                    className={inputClass}
                  />
                </label>
                {!form.intakeId && matches.length > 0 && (
                  <ul className="mt-1 divide-y divide-ink-950/5 rounded-lg border border-ink-950/10 bg-white">
                    {matches.map((record) => {
                      const name = `${record.demographics?.firstName ?? ""} ${record.demographics?.lastName ?? ""}`.trim()
                      return (
                        <li key={record.id}>
                          <button
                            type="button"
                            onClick={() => set({ intakeId: record.id, patientName: name })}
                            className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-ink-950 transition-colors duration-150 hover:bg-paper-100"
                          >
                            {name || "Unnamed"}{" "}
                            <span className="text-ink-950/50">{record.status === "admitted" ? "patient" : "applicant"}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ) : (
              isNew && <p className="text-sm text-ink-950">For {form.patientName}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="With">
                <Select
                  ariaLabel="With"
                  options={staffOptions}
                  value={form.staffUid}
                  onChange={(uid) => {
                    const member = staff.find((entry) => entry.uid === uid)
                    set({ staffUid: uid, staffName: member?.name || member?.email || "" })
                  }}
                  placeholder="Choose"
                  triggerClassName={COMPACT}
                />
              </Field>
              <Field label="Kind of visit">
                {isNew ? (
                  <Select
                    ariaLabel="Kind of visit"
                    options={DISCIPLINE_OPTIONS}
                    value={form.discipline}
                    onChange={(discipline) => set({ discipline })}
                    triggerClassName={COMPACT}
                  />
                ) : (
                  <p className="py-2 text-sm text-ink-950">{DISCIPLINE_LABELS[form.discipline]}</p>
                )}
              </Field>
              <Field label="Date">
                <DatePicker ariaLabel="Date" value={form.day} onChange={(day) => set({ day })} triggerClassName={COMPACT} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Time">
                  <Select ariaLabel="Time" options={TIMES} value={form.time} onChange={(time) => set({ time })} triggerClassName={COMPACT} />
                </Field>
                <Field label="Length">
                  <Select
                    ariaLabel="Length"
                    options={LENGTHS}
                    value={String(form.minutes)}
                    onChange={(minutes) => set({ minutes: Number(minutes) })}
                    triggerClassName={COMPACT}
                  />
                </Field>
              </div>
            </div>
            <p className="text-xs text-ink-950/50">Times are Tampa time.</p>

            {clashes.length > 0 && editable && (
              <p className="rounded-lg bg-paper-100 px-3 py-2 text-sm text-ink-950/75">
                {form.staffName || "This person"} already has {clashes.map((other) => `${other.patientName} at ${tampaParts(other.start).time}`).join(", ")} then.
                You can still book it.
              </p>
            )}

            <label className="block">
              <span className={labelClass}>Note (optional, no clinical details)</span>
              <input value={form.note} maxLength={500} onChange={(event) => set({ note: event.target.value })} className={inputClass} />
            </label>

            {!isNew && (
              <p className="text-xs text-ink-950/55">
                Added by {appointment.addedBy?.name} ({ROLE_LABELS[appointment.addedBy?.role] ?? appointment.addedBy?.role}),{" "}
                {formatStamp(appointment.addedAt)}
              </p>
            )}

            {history && (
              <section>
                <h3 className="text-xs font-semibold tracking-wide text-ink-950/50 uppercase">History</h3>
                {history.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-950/55">No changes since it was added.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm text-ink-950/80">
                    {history.map((change) => (
                      <li key={change.id}>{historyLine(change)}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {cancelling && (
              <label className="block">
                <span className={labelClass}>Reason for cancelling (optional). It stays on record with your name.</span>
                <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} className={inputClass} />
              </label>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-ink-950/10 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
            <div className="flex flex-wrap gap-1.5">
              {cancelling && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCancelling(false)}
                    className="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-50"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus("cancelled")}
                    className="cursor-pointer rounded-full bg-brand-dark px-4 py-2 text-sm font-semibold text-oncolor transition-colors duration-200 hover:bg-ink-950 disabled:opacity-50"
                  >
                    {busy ? "Cancelling…" : "Confirm cancel"}
                  </button>
                </>
              )}
              {!isNew && editable && !cancelling && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCancelling(true)}
                    className="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-50"
                  >
                    Cancel appointment
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus("completed")}
                    className="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-50"
                  >
                    Mark completed
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus("noShow")}
                    className="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950 disabled:opacity-50"
                  >
                    No-show
                  </button>
                </>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
              {(error || (editable && problem)) && (
                <p role={error ? "alert" : undefined} className={`text-sm ${error ? "text-brand-dark" : "text-ink-950/55"}`}>
                  {error ?? problem}
                </p>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || Boolean(problem)}
                  className="cursor-pointer rounded-full bg-ink-950 px-6 py-2.5 text-sm font-semibold text-paper-50 shadow-lg shadow-ink-950/15 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Saving…" : isNew ? "Book" : "Save changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>,
    getAdminPortalRoot(),
  )
}
```

Cancelling is confirmed inline, not with `ConfirmDialog`: that component covers the screen and takes focus, so the reason field behind it couldn't be typed into. "Cancel appointment" reveals the reason field and swaps the footer to "Keep it" / "Confirm cancel".

- [ ] **Step 4: Build and lint** — pass.

- [ ] **Step 5: Commit**

```bash
git add src/admin/AppointmentDialog.jsx src/admin/roles.js src/admin/roles.check.js
git commit -m "Admin: appointment booking dialog with added-by and history"
```

---

### Task 12: Calendar page

**Files:**
- Create: `src/admin/Calendar.jsx`
- Modify: `src/admin/icons.jsx` (`CalendarIcon`)
- Modify: `src/admin/Sidebar.jsx` (`NAV_ITEMS`)
- Modify: `src/admin/AdminApp.jsx` (route)

**Interfaces:**
- Consumes: `loadAppointments` (Task 9), `AppointmentDialog` (Task 11), `loadActiveChartNotes` (Task 5), `nextFollowUps` (Task 2), calendar math (Task 8), `loadStaff`, `DISCIPLINE_LABELS`.

- [ ] **Step 1: Icon.** In `src/admin/icons.jsx` add after `TodoIcon`:

```jsx
export function CalendarIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  )
}
```

- [ ] **Step 2: Sidebar and route.** In `src/admin/Sidebar.jsx` import `CalendarIcon` and add after the To-do item:
`{ label: "Calendar", icon: CalendarIcon, to: "/admin/calendar", page: "calendar" },`
In `src/admin/AdminApp.jsx` import `Calendar from "./Calendar"` and add after the todo route:
`<Route path="/admin/calendar" element={guard("calendar", <Calendar actor={actor} />)} />`

- [ ] **Step 3: The page** — `src/admin/Calendar.jsx`:

```jsx
import { useEffect, useMemo, useRef, useState } from "react"
import AppointmentDialog from "./AppointmentDialog"
import { loadAppointments } from "./appointmentStore"
import { addDays, fromTampa, lanes, monthRange, tampaParts, todayInTampa, unbookedFollowUps, weekRange } from "./calendarMath"
import { nextFollowUps } from "./chartMath"
import { loadActiveChartNotes, loadStaff } from "./chartStore"
import { DISCIPLINE_LABELS } from "./noteUi"
import PageHeader from "./PageHeader"
import { isClinicalRole } from "./roles"

const HOUR_PX = 48
const DAY_START_HOUR = 7
// Discipline colours from the admin tokens only, so dark mode follows.
const TONE = {
  medical: "border-l-accent-dark bg-accent-dark/10",
  dietitian: "border-l-brand bg-brand/10",
  exercise: "border-l-ink-700 bg-ink-950/[0.06]",
}
const VIEWS = [
  ["week", "Week"],
  ["month", "Month"],
  ["agenda", "Agenda"],
]

const dayLabel = (day, options) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...options })
const timeLabel = (value) =>
  new Date(value.toDate ? value.toDate() : value).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })
const isPhone = () => {
  try {
    return window.matchMedia("(max-width: 639px)").matches
  } catch {
    return false
  }
}

function Chip({ appointment, onOpen, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      className={`block w-full cursor-pointer truncate rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs text-ink-950 transition-colors duration-150 hover:bg-paper-100 ${TONE[appointment.discipline]} ${
        appointment.status === "cancelled" ? "line-through opacity-60" : ""
      }`}
    >
      {!compact && <span className="text-ink-950/60">{timeLabel(appointment.start)} </span>}
      {appointment.patientName}
    </button>
  )
}

function Marker({ followUp, onBook }) {
  return (
    <button
      type="button"
      onClick={() => onBook(followUp)}
      className="block w-full cursor-pointer truncate rounded-md border border-dashed border-ink-950/30 px-1.5 py-0.5 text-left text-xs text-ink-950/70 transition-colors duration-150 hover:border-accent-dark hover:text-ink-950"
    >
      Follow-up due: {followUp.patientName} ({DISCIPLINE_LABELS[followUp.discipline]})
    </button>
  )
}

function WeekView({ days, today, appointments, markers, onOpen, onBook, onSlot }) {
  const scrollRef = useRef(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = DAY_START_HOUR * HOUR_PX
  }, [])
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-950/10 bg-white">
      <div className="min-w-176">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-ink-950/10">
          <div />
          {days.map((day) => (
            <div key={day} className="space-y-1 border-l border-ink-950/5 px-1.5 py-2">
              <p className={`text-xs font-semibold ${day === today ? "text-accent-text" : "text-ink-950/70"}`}>
                {dayLabel(day, { weekday: "short", month: "short", day: "numeric" })}
              </p>
              {markers
                .filter((marker) => marker.date === day)
                .map((marker) => (
                  <Marker key={`${marker.intakeId}-${marker.discipline}`} followUp={marker} onBook={onBook} />
                ))}
            </div>
          ))}
        </div>
        <div ref={scrollRef} className="scrollbar-thin max-h-144 overflow-y-auto">
          <div className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_PX }}>
            <div>
              {Array.from({ length: 24 }, (_, hour) => (
                <p key={hour} className="pr-2 text-right text-[11px] text-ink-950/45" style={{ height: HOUR_PX }}>
                  {new Date(Date.UTC(2000, 0, 1, hour)).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric" })}
                </p>
              ))}
            </div>
            {days.map((day) => {
              const items = appointments
                .filter((appointment) => tampaParts(appointment.start).day === day)
                .map((appointment) => {
                  const startMin = tampaParts(appointment.start).minutes
                  return { appointment, id: appointment.id, startMin, endMin: startMin + appointment.minutes }
                })
              const placed = lanes(items)
              return (
                <div
                  key={day}
                  className="relative border-l border-ink-950/5 bg-[linear-gradient(to_bottom,transparent_47px,rgb(13_26_61/0.06)_47px)] bg-size-[100%_48px]"
                  onClick={(event) => {
                    if (event.target !== event.currentTarget) return
                    const minutes = Math.floor(((event.nativeEvent.offsetY / HOUR_PX) * 60) / 15) * 15
                    onSlot(day, `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`)
                  }}
                >
                  {items.map(({ appointment, id, startMin }) => {
                    const { lane, lanes: count } = placed.get(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpen(appointment)}
                        style={{
                          top: (startMin / 60) * HOUR_PX,
                          height: Math.max((appointment.minutes / 60) * HOUR_PX - 2, 20),
                          left: `${(lane / count) * 100}%`,
                          width: `${100 / count}%`,
                        }}
                        className={`absolute cursor-pointer overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs text-ink-950 transition-colors duration-150 hover:bg-paper-100 ${TONE[appointment.discipline]} ${
                          appointment.status === "cancelled" ? "line-through opacity-60" : ""
                        }`}
                      >
                        <span className="block font-medium">{appointment.patientName}</span>
                        <span className="block text-ink-950/60">
                          {timeLabel(appointment.start)}, {appointment.staffName}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function MonthView({ days, month, today, appointments, markers, onOpen, onBook, onDay }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-950/10 bg-white">
      <div className="grid min-w-176 grid-cols-7">
        {days.slice(0, 7).map((day) => (
          <p key={day} className="border-b border-ink-950/10 px-2 py-2 text-xs font-semibold text-ink-950/60">
            {dayLabel(day, { weekday: "short" })}
          </p>
        ))}
        {days.map((day) => {
          const items = [
            ...markers.filter((marker) => marker.date === day).map((marker) => ({ marker })),
            ...appointments.filter((appointment) => tampaParts(appointment.start).day === day).map((appointment) => ({ appointment })),
          ]
          return (
            <div key={day} className={`min-h-28 space-y-1 border-b border-l border-ink-950/5 p-1.5 ${day.slice(0, 7) === month ? "" : "bg-paper-50"}`}>
              <p className={`text-xs ${day === today ? "font-semibold text-accent-text" : "text-ink-950/55"}`}>{Number(day.slice(8))}</p>
              {items.slice(0, 3).map((item) =>
                item.marker ? (
                  <Marker key={`m-${item.marker.intakeId}-${item.marker.discipline}`} followUp={item.marker} onBook={onBook} />
                ) : (
                  <Chip key={item.appointment.id} appointment={item.appointment} onOpen={onOpen} />
                ),
              )}
              {items.length > 3 && (
                <button
                  type="button"
                  onClick={() => onDay(day)}
                  className="cursor-pointer text-xs font-medium text-accent-text hover:underline"
                >
                  +{items.length - 3} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AgendaView({ days, today, appointments, markers, onOpen, onBook }) {
  const withItems = days
    .map((day) => ({
      day,
      markers: markers.filter((marker) => marker.date === day),
      appointments: appointments.filter((appointment) => tampaParts(appointment.start).day === day),
    }))
    .filter((entry) => entry.markers.length || entry.appointments.length)
  if (!withItems.length)
    return (
      <div className="rounded-2xl border border-ink-950/10 bg-white p-8 text-center text-sm text-ink-950/60">
        Nothing booked in the next two weeks.
      </div>
    )
  return (
    <div className="space-y-3">
      {withItems.map((entry) => (
        <section key={entry.day} className="rounded-2xl border border-ink-950/10 bg-white p-4">
          <h2 className={`text-sm font-semibold ${entry.day === today ? "text-accent-text" : "text-ink-950"}`}>
            {dayLabel(entry.day, { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <div className="mt-2 space-y-1.5">
            {entry.markers.map((marker) => (
              <Marker key={`${marker.intakeId}-${marker.discipline}`} followUp={marker} onBook={onBook} />
            ))}
            {entry.appointments.map((appointment) => (
              <button
                key={appointment.id}
                type="button"
                onClick={() => onOpen(appointment)}
                className={`flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-lg border-l-4 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-paper-100 ${TONE[appointment.discipline]} ${
                  appointment.status === "cancelled" ? "line-through opacity-60" : ""
                }`}
              >
                <span className="min-w-0 truncate text-ink-950">
                  <span className="font-medium">{appointment.patientName}</span>{" "}
                  <span className="text-ink-950/60">with {appointment.staffName}</span>
                </span>
                <span className="text-xs whitespace-nowrap text-ink-950/60">
                  {timeLabel(appointment.start)}, {appointment.minutes} min
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// The practice's schedule: appointments plus each patient's follow-ups not
// booked yet (dashed), all in Tampa time. Opens on the viewer's own schedule.
export default function Calendar({ actor }) {
  const today = todayInTampa()
  const [view, setView] = useState(() => (isPhone() ? "agenda" : "week"))
  const [cursor, setCursor] = useState(today)
  const [who, setWho] = useState("mine") // "mine" | "all" | a staff uid
  const [showCancelled, setShowCancelled] = useState(false)
  const [staff, setStaff] = useState([])
  const [appointments, setAppointments] = useState(null)
  const [followUps, setFollowUps] = useState([])
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null) // { appointment } | { prefill }
  const [version, setVersion] = useState(0)

  const range = useMemo(() => {
    if (view === "month") return monthRange(cursor)
    if (view === "agenda") {
      const days = Array.from({ length: 14 }, (_, index) => addDays(cursor, index))
      return { days, start: fromTampa(days[0]), end: fromTampa(addDays(cursor, 14)) }
    }
    return weekRange(cursor)
  }, [view, cursor])

  useEffect(() => {
    loadStaff(actor.role)
      .then((members) => setStaff(members.filter((member) => isClinicalRole(member.role) && member.role !== "superAdmin")))
      .catch((cause) => console.error("Staff list failed:", cause.code ?? cause.message))
    loadActiveChartNotes(actor.uid)
      .then((perChart) =>
        setFollowUps(
          perChart.flatMap(({ chart, notes }) =>
            nextFollowUps(notes).map((followUp) => ({
              ...followUp,
              intakeId: chart.id,
              patientName: `${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient",
            })),
          ),
        ),
      )
      .catch((cause) => console.error("Follow-ups failed:", cause.code ?? cause.message))
  }, [actor.role, actor.uid, version])

  // Padded 3 days either side so a follow-up near the edge still finds the
  // appointment that books it (calendarMath.matchingAppointment).
  useEffect(() => {
    let active = true
    setAppointments(null)
    loadAppointments(fromTampa(addDays(range.days[0], -3)), new Date(range.end.getTime() + 3 * 86_400_000))
      .then((list) => active && setAppointments(list))
      .catch((cause) => active && setError(cause.code ?? cause.message))
    return () => {
      active = false
    }
  }, [range, version])

  const inRange = (day) => range.days.includes(day)
  const shown = (appointments ?? []).filter(
    (appointment) =>
      inRange(tampaParts(appointment.start).day) &&
      (showCancelled || appointment.status !== "cancelled") &&
      (who === "all" || appointment.staffUid === (who === "mine" ? actor.uid : who)),
  )
  const markers = appointments
    ? unbookedFollowUps(followUps, appointments).filter(
        (followUp) =>
          inRange(followUp.date) && (who === "all" || actor.role !== "dietitian" || followUp.discipline === "dietitian"),
      )
    : []

  const step = (direction) =>
    setCursor((day) =>
      view === "month"
        ? `${new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1 + direction, 1)).toISOString().slice(0, 7)}-01`
        : addDays(day, direction * (view === "agenda" ? 14 : 7)),
    )
  const title =
    view === "month"
      ? dayLabel(`${cursor.slice(0, 7)}-15`, { month: "long", year: "numeric" })
      : `${dayLabel(range.days[0], { month: "short", day: "numeric" })} to ${dayLabel(range.days[range.days.length - 1], { month: "short", day: "numeric", year: "numeric" })}`

  const whoOptions = [
    ["mine", "My schedule"],
    ["all", "Everyone"],
    ...staff.filter((member) => member.uid !== actor.uid).map((member) => [member.uid, member.name || member.email]),
  ]
  const open = (appointment) => setDialog({ appointment })
  const book = (followUp) =>
    setDialog({ prefill: { intakeId: followUp.intakeId, patientName: followUp.patientName, discipline: followUp.discipline, day: followUp.date } })
  const saved = () => {
    setDialog(null)
    setVersion((value) => value + 1)
  }
  const pill = (active) =>
    `cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
      active ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/70 hover:bg-ink-950/10"
    }`

  return (
    <div className="flex h-full flex-col pb-6">
      <PageHeader title="Calendar" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setCursor(today)} className={pill(false)}>
            Today
          </button>
          <button type="button" onClick={() => step(-1)} aria-label="Previous" className={pill(false)}>
            ‹
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next" className={pill(false)}>
            ›
          </button>
          <h2 className="ml-1 font-serif text-lg text-ink-950">{title}</h2>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ prefill: { day: cursor < today ? today : cursor } })}
          className="cursor-pointer rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark"
        >
          New appointment
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="View" className="flex gap-1.5">
          {VIEWS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={pill(view === value)}>
              {label}
            </button>
          ))}
        </div>
        <span className="mx-1 h-4 w-px bg-ink-950/15" aria-hidden="true" />
        <div role="group" aria-label="Whose schedule" className="flex flex-wrap gap-1.5">
          {whoOptions.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={who === value} onClick={() => setWho(value)} className={pill(who === value)}>
              {label}
            </button>
          ))}
        </div>
        <span className="mx-1 h-4 w-px bg-ink-950/15" aria-hidden="true" />
        <button type="button" aria-pressed={showCancelled} onClick={() => setShowCancelled((value) => !value)} className={pill(showCancelled)}>
          Show cancelled
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-ink-950/10 bg-white p-6 text-center">
          <h2 className="font-semibold text-ink-950">Could not load the calendar</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
        </div>
      ) : !appointments ? (
        <div className="h-96 animate-pulse rounded-2xl bg-ink-950/5" />
      ) : view === "week" ? (
        <WeekView
          days={range.days}
          today={today}
          appointments={shown}
          markers={markers}
          onOpen={open}
          onBook={book}
          onSlot={(day, time) => setDialog({ prefill: { day, time } })}
        />
      ) : view === "month" ? (
        <MonthView
          days={range.days}
          month={cursor.slice(0, 7)}
          today={today}
          appointments={shown}
          markers={markers}
          onOpen={open}
          onBook={book}
          onDay={(day) => {
            setCursor(day)
            setView("week")
          }}
        />
      ) : (
        <AgendaView days={range.days} today={today} appointments={shown} markers={markers} onOpen={open} onBook={book} />
      )}

      {dialog && (
        <AppointmentDialog
          appointment={dialog.appointment ?? null}
          prefill={dialog.prefill}
          actor={actor}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Build and lint** — pass.

- [ ] **Step 5: Commit**

```bash
git add src/admin/Calendar.jsx src/admin/icons.jsx src/admin/Sidebar.jsx src/admin/AdminApp.jsx
git commit -m "Admin: Calendar page with week, month and agenda views"
```

---

### Task 13: Booking from the chart and Applicants; To-do shows "Booked"

**Files:**
- Modify: `src/admin/PatientChart.jsx`
- Modify: `src/admin/ApplicantModal.jsx`
- Modify: `src/admin/Applicants.jsx`
- Modify: `src/admin/Todo.jsx`

**Interfaces:**
- Consumes: `loadAppointmentsFor`, `loadAppointments` (Task 9); `AppointmentDialog` (Task 11); `matchingAppointment`, `tampaParts`, `fromTampa`, `addDays`, `todayInTampa` (Task 8).

- [ ] **Step 1: Chart.** In `src/admin/PatientChart.jsx` import `AppointmentDialog`, `loadAppointmentsFor` and `DISCIPLINE_LABELS` (already imported). Add state `const [appointments, setAppointments] = useState([])`, `const [booking, setBooking] = useState(null)` (null | { appointment } | { prefill }). Add:

```js
  const loadUpcoming = () =>
    loadAppointmentsFor(chartId)
      .then((list) => setAppointments(list.filter((entry) => entry.status === "scheduled" && asDate(entry.start) >= new Date()).slice(0, 3)))
      .catch((cause) => console.error("Appointments failed:", cause.code ?? cause.message))
  useEffect(() => {
    loadUpcoming()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartId])
```

(If oxlint doesn't know that rule name, drop the disable comment; `loadUpcoming` only depends on `chartId`.)

After the "Next follow-ups" `Card` add:

```jsx
          <Card
            title="Upcoming appointments"
            action={
              <button
                type="button"
                onClick={() => setBooking({ prefill: { intakeId: chart.id, patientName: name } })}
                className="cursor-pointer text-xs font-semibold text-accent-text hover:underline"
              >
                Book appointment
              </button>
            }
          >
            {appointments.length === 0 ? (
              <p className="text-sm text-ink-950/55">Nothing booked.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {appointments.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setBooking({ appointment: entry })}
                      className="cursor-pointer text-left text-ink-950 hover:underline"
                    >
                      {asDate(entry.start).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      <span className="text-ink-950/55">
                        {" "}
                        {DISCIPLINE_LABELS[entry.discipline]}, {entry.staffName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
```

and before `<ApplicantModal …>` at the bottom:

```jsx
      {booking && (
        <AppointmentDialog
          appointment={booking.appointment ?? null}
          prefill={booking.prefill}
          actor={actor}
          onClose={() => setBooking(null)}
          onSaved={() => {
            setBooking(null)
            loadUpcoming()
          }}
        />
      )}
```

- [ ] **Step 2: Applicants modal.** In `src/admin/ApplicantModal.jsx` add two optional props, `nextVisit` (an appointment or null) and `onBook` (function or undefined). Under the "Submitted …" line in the header add:

```jsx
                {nextVisit && (
                  <p className="mt-0.5 text-sm text-ink-950/60">
                    Next visit{" "}
                    {new Date(nextVisit.start.toDate ? nextVisit.start.toDate() : nextVisit.start).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    with {nextVisit.staffName}
                  </p>
                )}
                {onBook && (
                  <button type="button" onClick={() => onBook(record)} className="mt-1 cursor-pointer text-sm font-semibold text-accent-text hover:underline">
                    Book appointment
                  </button>
                )}
```

In `src/admin/Applicants.jsx`: change the React import to `import { useEffect, useMemo, useState } from "react"`; import `AppointmentDialog`, `loadAppointmentsFor` from `./appointmentStore`, and `asDate` from `./chartMath`. Track `const [booking, setBooking] = useState(null)` and `const [nextVisit, setNextVisit] = useState(null)`. When the open record (`selectedRecord`, already passed as `record` to `ApplicantModal`) changes, load:

```js
  const selectedId = selectedRecord?.id
  useEffect(() => {
    setNextVisit(null)
    if (!selectedId) return
    let active = true
    loadAppointmentsFor(selectedId)
      .then((list) => active && setNextVisit(list.find((entry) => entry.status === "scheduled" && asDate(entry.start) >= new Date()) ?? null))
      .catch(() => active && setNextVisit(null))
    return () => {
      active = false
    }
  }, [selectedId])
```
 Pass `nextVisit={nextVisit}` and, unless `usingSampleFallback`, `onBook={(record) => setBooking({ intakeId: record.id, patientName: \`${record.demographics?.firstName ?? ""} ${record.demographics?.lastName ?? ""}\`.trim() })}`. Render:

```jsx
      {booking && (
        <AppointmentDialog
          appointment={null}
          prefill={booking}
          actor={actor}
          onClose={() => setBooking(null)}
          onSaved={(saved) => {
            setBooking(null)
            setNextVisit(saved)
          }}
        />
      )}
```

- [ ] **Step 3: To-do "Booked".** In `src/admin/Todo.jsx` import `loadAppointments` and `{ addDays, fromTampa, matchingAppointment, tampaParts, todayInTampa }`. Load appointments covering the To-do window (overdue back 30 days to 10 days ahead) beside the charts:

```js
    Promise.all([
      loadActiveChartNotes(actor.uid),
      loadAppointments(fromTampa(addDays(todayInTampa(), -33)), fromTampa(addDays(todayInTampa(), 11))).catch(() => []),
    ])
      .then(([perChart, appointments]) =>
        perChart.flatMap(({ chart, notes }) => {
          const name = `${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient"
          const admittedAt = asDate(chart.admittedAt)
          return dueTasks(notes, today).map((task, index) => ({
            ...task,
            id: `${chart.id}-${index}`,
            chartId: chart.id,
            name,
            admittedAt,
            booked:
              task.kind === "followUp"
                ? matchingAppointment({ intakeId: chart.id, discipline: task.discipline, date: task.due }, appointments)
                : null,
          }))
        }),
      )
```

(replacing the Task 5 chain; the `.then(setTasks)` / `.catch` stay). In the row's right-hand span, when `task.booked` show `Booked ${formatDay(tampaParts(task.booked.start).day)}` in `text-accent-text` instead of `whenLabel(task)`.

A follow-up stays on To-do until the note is signed (spec), so "Booked" changes the label, not whether it shows.

- [ ] **Step 4: Build, lint, check** — pass.

- [ ] **Step 5: Commit**

```bash
git add src/admin/PatientChart.jsx src/admin/ApplicantModal.jsx src/admin/Applicants.jsx src/admin/Todo.jsx
git commit -m "Admin: book from chart and Applicants; To-do shows booked follow-ups"
```

---

### Task 14: Phase 2 verification

- [ ] **Step 1:** `npm run lint` (only pre-existing warnings), `npm run build`, `npm run check` — all pass.
- [ ] **Step 2: Browser pass in demo mode** (Louie's dev server; Playwright from the scratchpad; 1280px and 375px; light and dark; scroll before screenshots):
  - `/admin?demoRole=admin`: Calendar in the sidebar; week view opens scrolled to 7am with today's column highlighted; demo appointments coloured by discipline; overlapping ones side by side; a dashed "Follow-up due" marker for an unbooked follow-up; click it → dialog prefilled (patient, discipline, date); book → marker disappears. Open the moved demo appointment → "Added by Hyacinth team…" and History "Moved from … to …, by Dr. Antonious". Move one (time change) → History grows. Cancel with a reason → hidden until "Show cancelled", then struck through and read-only. Month view: "+N more" opens that week. Agenda lists the next 14 days.
  - `/admin?demoRole=provider`: no History list in the dialog; "Added by" visible; can book for the dietitian.
  - `/admin?demoRole=dietitian`: opens on My schedule; markers only for dietitian follow-ups until Everyone.
  - Phone width: Calendar opens on Agenda; week view scrolls sideways inside its card, never the page.
  - Chart: Upcoming appointments + Book appointment; Applicants modal: Book appointment and next visit; To-do shows "Booked {date}" for a booked follow-up.
  - Cancel flow: the reason field can be typed into (see the note in Task 11).
- [ ] **Step 3: Hand-off to Louie:** the staff-list read change (Task 10), rules tests unrun (no Java), appointment notes are free text (no enforcement against clinical detail), and the BAA reminder for appointments. CLAUDE.md is untouched; offer what could be added.
