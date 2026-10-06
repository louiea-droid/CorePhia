# Portal Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff post short dated updates to a patient from the chart (directly, or pre-filled from a note they just signed), optionally emailing "you have a new update"; the patient reads them on `/account`.

**Architecture:** New subcollection `patients/{chartId}/updates`, guarded by `firestore.rules` (clinical staff write as themselves; the linked patient reads only live ones). One store file (`updateStore.js`) with the usual demo branch; the chart gets an Updates card and a Post dialog owned by `PatientChart`; the note editor's sign confirmation gains a "share" checkbox. The patient side is one query in `patientAuth.js` and a section in `Account.jsx`.

**Tech Stack:** React 19, Tailwind v4, Firebase Firestore modular SDK v12, EmailJS REST (no SDK), `@firebase/rules-unit-testing` + `node --test`, plain `node:assert` self-checks, Playwright in the session scratchpad for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-05-portal-updates-design.md`

## Global Constraints

- Updates are PHI. The email never carries the update's text: only "You have a new update from CorePhia" and a portal link.
- Patient-facing copy: "CorePhia" (capital P), no em dashes, plain words.
- No new dependencies.
- Admin colours via admin tokens (`text-accent-text` for blue text, works in dark mode); `/account` uses site tokens. Hover = colour only, never movement.
- Every store function has a `usingSeedData` branch using `getDemoStore()` / `demoId()` from `chartStore.js`.
- Reuse: `sendEmail` (gains a template id argument), `retryOnce` from `src/lib/inviteMath.js`, `Modal`, `ConfirmDialog`, `noteUi` classes (`inputClass`, `labelClass`, `formatStamp`, `formatDay`), `ROLE_LABELS`.
- Body: 1–2000 characters after trimming. Data shape exactly `{ body, author: { uid, name, role }, createdAt, email: 'none'|'sent'|'failed', fromNoteId: string|null, removed: false | { by: { uid, name }, at } }`.
- Env var: `VITE_EMAILJS_UPDATE_TEMPLATE_ID`. Email params: `to_email`, `subject` = "You have a new update from CorePhia", `portal_link` = `${window.location.origin}/account`.
- Per CLAUDE.md, load the skills each task needs before starting it (UI: `frontend-design`, `ui-ux-pro-max`, `ui-design-system`; React: `react-best-practices`, `senior-frontend`; copy: `humanizer`; browser: `playwright-cli`/`webapp-testing`; `superpowers:verification-before-completion` before calling anything done). Louie runs the dev server; don't start or stop it.

## Decisions made while planning (flag to Louie)

1. **Exercise prefill.** The spec says "exercisePlanLine, then `sections` plan text if present", but exercise notes have no plan section. This plan uses the exercise prescription's own **Notes** field (`exercisePlan.notes`) as the second part.
2. **Role shown to the patient.** Staff role labels ("Super admin", "Co-admin") mean nothing to a patient. The portal shows provider → "Provider", dietitian → "Dietitian", admin → "Provider" (Dr. Antonious), coAdmin and superAdmin → "Care team". The chart keeps the staff labels.
3. **No email on the intake:** the email box is unticked and disabled with "There's no email on this intake." The update still posts.
4. **No audit-log entries** for post or remove: the update itself records who posted and who removed it, and when.
5. **Patient list is sorted in the browser**, not by Firestore, so no composite index is needed (`removed == false` + `orderBy createdAt` would require one). Fine for the tens of updates a patient will have.

## Review Focus

1. **A prefill longer than 2000 characters** (a long plan section): the dialog opens with it, the counter shows over the limit, Post update is refused with "Keep it to 2,000 characters." and the text is kept. Pinned in Task 4's browser check.
2. **The email status write failing after the email went out** (`retryOnce` gives up): the update still posted and the patient still sees it; the card shows "Not emailed". Accepted limitation, mentioned in the code comment; no test.
3. **A patient whose login isn't linked, or is linked to a different chart, querying updates**: refused by the rules. Pinned in Task 1.
4. **Whitespace-only message**: refused in the dialog ("Write a message first.") before any write. Pinned in Task 4's browser check.
5. **Sharing from a note while the chart is inactive** (re-admission pending): the checkbox is hidden, so no dialog opens; the rules would refuse the create anyway. Pinned in Task 1 (inactive chart create refused) and Task 4 (checkbox hidden on an inactive chart).

---

### Task 1: Rules for `updates`

**Files:**
- Modify: `firestore.rules` (new `match /updates/{updateId}` inside `match /patients/{chartId}`, after the invites block, before its closing brace)
- Test: `tests/firestore.rules.test.js` (new `describe("portal updates")` at the end; update the header count)

**Interfaces:**
- Produces: the document shape in Global Constraints; patient reads must query with `where("removed", "==", false)`.

- [x] **Step 1: Write the failing tests.** Append to `tests/firestore.rules.test.js`:

```js
describe("portal updates", () => {
  const newUpdate = (uid = "provider", role = "provider", overrides = {}) => ({
    body: "Your plan is ready.",
    author: { uid, name: uid, role },
    createdAt: serverTimestamp(),
    email: "none",
    fromNoteId: null,
    removed: false,
    ...overrides,
  })
  const updateRef = (db, id, chart = "chart1") => doc(db, `patients/${chart}/updates/${id}`)
  const seed = (id, overrides = {}, chart = "chart1") =>
    env.withSecurityRulesDisabled((c) =>
      setDoc(updateRef(c.firestore(), id, chart), { ...newUpdate(), createdAt: new Date(), ...overrides }),
    )
  const asPatient = (uid, email) => env.authenticatedContext(uid, { email }).firestore()
  const removal = (uid) => ({ removed: { by: { uid, name: uid }, at: serverTimestamp() } })

  test("a clinician posts an update as themselves", async () => {
    await assertSucceeds(setDoc(updateRef(as("provider"), "u1"), newUpdate()))
    await assertSucceeds(setDoc(updateRef(as("dietitian"), "u2"), newUpdate("dietitian", "dietitian", { fromNoteId: "diet1" })))
  })
  test("a new update is well formed, on an active chart, by its author", async () => {
    const db = as("provider")
    const bad = (id, overrides, chart) => assertFails(setDoc(updateRef(db, id, chart), newUpdate("provider", "provider", overrides)))
    await assertFails(setDoc(updateRef(db, "x1", "inactive1"), newUpdate()))
    await assertFails(setDoc(updateRef(db, "x2"), newUpdate("admin", "admin")))
    await bad("x3", { author: { uid: "provider", name: "provider", role: "admin" } })
    await bad("x4", { body: "" })
    await bad("x5", { body: "x".repeat(2001) })
    await bad("x6", { removed: true })
    await bad("x7", { email: "sent" })
    await bad("x8", { extra: 1 })
    await bad("x9", { createdAt: new Date("2020-01-01") })
    await bad("x10", { fromNoteId: "x".repeat(201) })
  })
  test("patients and signed-out visitors can't post", async () => {
    await assertFails(setDoc(updateRef(asPatient("patient1", "p1@x.co"), "p1"), newUpdate("patient1", "")))
    await assertFails(setDoc(updateRef(env.unauthenticatedContext().firestore(), "p2"), newUpdate()))
  })
  test("only the author records the email result, once, from none", async () => {
    await seed("e1")
    await assertFails(updateDoc(updateRef(as("admin"), "e1"), { email: "sent" }))
    await assertFails(updateDoc(updateRef(as("provider"), "e1"), { email: "sent", body: "changed" }))
    await assertFails(updateDoc(updateRef(as("provider"), "e1"), { email: "none" }))
    await assertSucceeds(updateDoc(updateRef(as("provider"), "e1"), { email: "sent" }))
    await assertFails(updateDoc(updateRef(as("provider"), "e1"), { email: "failed" }))
  })
  test("the author or co-admin and up remove it; nobody else, and never back", async () => {
    await seed("r1")
    await seed("r2")
    await seed("r3")
    await assertSucceeds(updateDoc(updateRef(as("provider"), "r1"), removal("provider")))
    await assertSucceeds(updateDoc(updateRef(as("coadmin"), "r2"), removal("coadmin")))
    await assertFails(updateDoc(updateRef(as("provider2"), "r3"), removal("provider2")))
    await assertFails(updateDoc(updateRef(as("coadmin"), "r3"), removal("provider")))
    await assertFails(updateDoc(updateRef(as("coadmin"), "r1"), { removed: false }))
    await assertFails(updateDoc(updateRef(as("coadmin"), "r3"), { ...removal("coadmin"), body: "changed" }))
    await assertFails(deleteDoc(updateRef(as("super"), "r3")))
  })
  test("a patient reads their own chart's live updates, nothing else", async () => {
    await seed("live1")
    await seed("gone1", { removed: { by: { uid: "provider", name: "provider" }, at: new Date() } })
    await seed("other1", {}, "pending1")
    const db = asPatient("patient1", "p1@x.co")
    await assertSucceeds(getDoc(updateRef(db, "live1")))
    await assertFails(getDoc(updateRef(db, "gone1")))
    await assertSucceeds(getDocs(query(collection(db, "patients/chart1/updates"), where("removed", "==", false))))
    await assertFails(getDocs(collection(db, "patients/chart1/updates")))
    await assertFails(getDoc(updateRef(db, "other1", "pending1")))
    await assertFails(getDoc(updateRef(asPatient("patient2", "p2@x.co"), "live1")))
    await assertFails(getDoc(updateRef(asPatient("stranger", "s@x.co"), "live1")))
    await assertFails(getDoc(updateRef(env.unauthenticatedContext().firestore(), "live1")))
    await assertSucceeds(getDocs(collection(as("dietitian"), "patients/chart1/updates")))
  })
})
```

- [x] **Step 2: Run them to see them fail.** `npm run test:rules`. Expected: the "posts" and "patient reads" tests FAIL (the catch-all `match /{document=**}` denies everything); the deny-only tests pass.

- [x] **Step 3: Add the rules.** In `firestore.rules`, inside `match /patients/{chartId}`, right after the invites block's closing `}`:

```
      // Portal updates (spec 2026-10-05-portal-updates-design): short dated
      // messages from staff that the patient reads in the portal. Posted by a
      // clinician as themselves; afterwards only two changes: the author
      // records whether the "new update" email went out, and the author or
      // co-admin and up removes it from the patient's view. Never edited,
      // never deleted. The linked patient reads only updates not removed, so
      // their list query must filter removed == false.
      match /updates/{updateId} {
        function isNewUpdate() {
          let data = request.resource.data;
          return data.keys().hasOnly(['body', 'author', 'createdAt', 'email', 'fromNoteId', 'removed'])
            && data.keys().hasAll(['body', 'author', 'createdAt', 'email', 'fromNoteId', 'removed'])
            && get(/databases/$(database)/documents/patients/$(chartId)).data.status == 'active'
            && data.body is string && data.body.size() > 0 && data.body.size() <= 2000
            && data.author.keys().hasOnly(['uid', 'name', 'role'])
            && data.author.uid == request.auth.uid
            && data.author.name == myName()
            && data.author.role == role()
            && data.createdAt == request.time
            && data.email == 'none'
            && (data.fromNoteId == null || (data.fromNoteId is string && data.fromNoteId.size() <= 200))
            && data.removed == false;
        }
        function isEmailResult() {
          return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['email'])
            && resource.data.email == 'none'
            && request.resource.data.email in ['sent', 'failed']
            && resource.data.author.uid == request.auth.uid;
        }
        function isRemoval() {
          let removed = request.resource.data.removed;
          return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['removed'])
            && resource.data.removed == false
            && removed is map
            && removed.keys().hasOnly(['by', 'at'])
            && removed.by.keys().hasOnly(['uid', 'name'])
            && removed.by.uid == request.auth.uid
            && removed.by.name == myName()
            && removed.at == request.time
            && (resource.data.author.uid == request.auth.uid || isStaff());
        }
        allow read: if isClinical()
          || (request.auth != null
              && resource.data.removed == false
              && get(/databases/$(database)/documents/patientAccounts/$(request.auth.uid)).data.intakeId == chartId);
        allow create: if isClinical() && isNewUpdate();
        allow update: if isClinical() && (isEmailResult() || isRemoval());
        allow delete: if false;
      }
```

- [x] **Step 4: Run the tests.** `npm run test:rules`. Expected: all pass (previous 96 plus 6 new = 102). Update the header comment in `tests/firestore.rules.test.js` to "portal updates" in the list and "All 102 passed on <today's date>".

- [x] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.js
git commit -m "Rules: portal updates (post as yourself, email result, remove, patient reads live ones)"
```

---

### Task 2: Pure parts: `updatePrefill` and `canRemoveUpdate`

**Files:**
- Modify: `src/admin/patients/chartMath.js` (move `INTENSITIES` and `exercisePlanLine` here from `noteUi.jsx`; add `updatePrefill`)
- Modify: `src/admin/patients/noteUi.jsx` (re-export the two moved names so existing imports keep working)
- Modify: `src/admin/staff/roles.js` (add `canRemoveUpdate`)
- Test: `src/admin/patients/chartMath.check.js`, `src/admin/staff/roles.check.js`

`exercisePlanLine` moves because `chartMath.check.js` runs under plain node and can't import a `.jsx` file.

**Interfaces:**
- Produces: `updatePrefill(note) → string` (`""` when nothing to share); `canRemoveUpdate(update, actor) → boolean` where `actor = { uid, role }`; `exercisePlanLine` and `INTENSITIES` still importable from `./noteUi`.

- [x] **Step 1: Write the failing checks.** In `chartMath.check.js` add `updatePrefill` to the import list, and before the final `console.log`:

```js
// Sharing a signed note pre-fills the update with the part the patient acts on.
const shared = (type, sections = {}, exercisePlan = null) => ({ type, sections, exercisePlan })
assert.equal(updatePrefill(shared("progress", { plan: " Walk daily. ", assessment: "Stable" })), "Walk daily.")
assert.equal(updatePrefill(shared("consultation", { plan: "Start the program." })), "Start the program.")
assert.equal(updatePrefill(shared(undefined, { plan: "Older note, no type" })), "Older note, no type")
assert.equal(updatePrefill(shared("dietitian", { goals: "Less sugar", mealPlan: "Oats at breakfast" })), "Less sugar\n\nOats at breakfast")
assert.equal(updatePrefill(shared("dietitian", { goals: "  ", mealPlan: "Oats" })), "Oats")
assert.equal(
  updatePrefill(shared("exercise", {}, { daysPerWeek: 4, intensity: "moderate", minutesPerSession: 30, kind: "Walking", notes: "Start slow" })),
  "4 days a week, moderate, 30 min per session, Walking\n\nStart slow",
)
assert.equal(updatePrefill(shared("exercise", { goals: "Run a 5k" }, null)), "")
assert.equal(updatePrefill(shared("progress", {})), "")
assert.equal(updatePrefill(null), "")
```

In `roles.check.js` add `canRemoveUpdate` to the import list, and before the final `console.log`:

```js
// The author or co-admin and up take an update out of the portal, once.
const posted = { author: { uid: "p1" }, removed: false }
assert.equal(canRemoveUpdate(posted, { uid: "p1", role: "provider" }), true)
assert.equal(canRemoveUpdate(posted, { uid: "d1", role: "dietitian" }), false)
assert.equal(canRemoveUpdate(posted, { uid: "p2", role: "provider" }), false)
assert.equal(canRemoveUpdate(posted, { uid: "c1", role: "coAdmin" }), true)
assert.equal(canRemoveUpdate({ ...posted, removed: { by: { uid: "p1" } } }, { uid: "p1", role: "provider" }), false)
```

- [x] **Step 2: Run to see them fail.** `npm run check`. Expected: FAIL, `updatePrefill` is not exported.

- [x] **Step 3: Implement.** In `chartMath.js`, append:

```js
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

// What "Then share an update with the patient" pre-fills from a note just
// signed: the part the patient acts on. Staff edit it before posting, so
// nothing clinical goes out unread. "" opens the dialog empty.
export function updatePrefill(note) {
  if (!note) return ""
  const sections = note.sections ?? {}
  const parts =
    note.type === "dietitian"
      ? [sections.goals, sections.mealPlan]
      : note.type === "exercise"
        ? [exercisePlanLine(note.exercisePlan), note.exercisePlan?.notes]
        : [sections.plan]
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n\n")
}
```

In `noteUi.jsx`, delete the `INTENSITIES` constant and the `exercisePlanLine` function, change the chartMath import line to `import { asDate } from "./chartMath"` (unchanged) and add below it:

```js
export { INTENSITIES, exercisePlanLine } from "./chartMath"
```

In `roles.js`, after `canEditInviteTemplate`:

```js
// Who takes a portal update out of the patient's view: its author, or
// co-admin and up, and only once. Mirrors isRemoval in firestore.rules.
export const canRemoveUpdate = (update, actor) =>
  !update.removed && (update.author?.uid === actor.uid || STAFF_ROLES.includes(actor.role))
```

- [x] **Step 4: Run the checks.** `npm run check` → every file prints "all checks passed". `npm run lint` clean.

- [x] **Step 5: Commit**

```bash
git add src/admin/patients/chartMath.js src/admin/patients/chartMath.check.js src/admin/patients/noteUi.jsx src/admin/staff/roles.js src/admin/staff/roles.check.js
git commit -m "Updates: updatePrefill from a signed note, canRemoveUpdate"
```

---

### Task 3: Email template argument and `updateStore.js`

**Files:**
- Modify: `src/admin/lib/emailjs.js`
- Modify: `.env.example` (add `VITE_EMAILJS_UPDATE_TEMPLATE_ID=` under the other EmailJS lines)
- Create: `src/admin/patients/updateStore.js`

No unit test: the store imports Firebase (same ruling as `portalStore.js`). Its behaviour is pinned by Task 1's rules tests and Task 4's browser check.

**Interfaces:**
- Consumes: `sendEmail`, `retryOnce`, `getDemoStore`, `demoId`, `PATIENTS_COLLECTION`, `db`, `usingSeedData`.
- Produces:
  - `sendEmail(params, templateId = TEMPLATE_ID)`; `emailjsConfigured` unchanged (invites); new `updateEmailConfigured: boolean`, `UPDATE_TEMPLATE_ID`.
  - `loadUpdates(chartId) → Promise<Update[]>` newest first, removed ones included.
  - `postUpdate({ chartId, to, body, fromNoteId, email }, actor) → Promise<{ update, emailed: 'none'|'sent'|'failed' }>`; throws only if the save fails.
  - `removeUpdate(chartId, updateId, actor) → Promise<void>`.
  - `actor = { uid, name, role }` (as `AdminApp` builds it).

- [x] **Step 1: emailjs.js.** Replace the constants and `sendEmail` head:

```js
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
export const UPDATE_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_UPDATE_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export const emailjsConfigured = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)
// The portal "new update" email has its own template.
export const updateEmailConfigured = Boolean(SERVICE_ID && UPDATE_TEMPLATE_ID && PUBLIC_KEY)

// Throws with EmailJS's own error text (or "Network error") so the dialog can
// show why it didn't send. templateId defaults to the invite template.
export async function sendEmail(templateParams, templateId = TEMPLATE_ID) {
  if (!SERVICE_ID || !PUBLIC_KEY || !templateId) throw new Error("Email sending isn't set up yet.")
```

and in the request body use `template_id: templateId`. Update the file's top comment: "See docs/client-portal.md for the templates it expects."

- [x] **Step 2: Create `src/admin/patients/updateStore.js`:**

```js
// Portal updates (spec: 2026-10-05-portal-updates-design): every read and
// write for patients/{chartId}/updates goes through here. firestore.rules is
// the real boundary. The "new update" email never carries the message, only
// a link to the portal. Demo mode keeps updates in memory and, without the
// EmailJS keys, pretends the email went out.
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"
import { retryOnce } from "../../lib/inviteMath"
import { db, usingSeedData } from "../lib/firebase"
import { sendEmail, UPDATE_TEMPLATE_ID, updateEmailConfigured } from "../lib/emailjs"
import { PATIENTS_COLLECTION, demoId, getDemoStore } from "./chartStore"

const UPDATES = "updates"
export const UPDATE_SUBJECT = "You have a new update from CorePhia"

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

const demoUpdates = async (chartId) => {
  const store = await getDemoStore()
  store.updates ??= new Map()
  if (!store.updates.has(chartId)) store.updates.set(chartId, [])
  return store.updates.get(chartId)
}

const emailParams = (to) => ({ to_email: to, subject: UPDATE_SUBJECT, portal_link: `${window.location.origin}/account` })

// Newest first, removed ones included (the chart shows them greyed).
export async function loadUpdates(chartId) {
  if (usingSeedData) return (await demoUpdates(chartId)).map((update) => ({ ...update }))
  const snapshot = await getDocs(query(collection(requireDb(), PATIENTS_COLLECTION, chartId, UPDATES), orderBy("createdAt", "desc")))
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

// Saves the update, then (if asked and there's an address) sends the email
// and records how it went. Throws only if the save fails: once saved, the
// patient sees it on their next login whatever the email did. If recording
// the email result fails twice, the chart says "Not emailed"; acceptable.
export async function postUpdate({ chartId, to, body, fromNoteId = null, email }, actor) {
  const update = {
    body,
    author: { uid: actor.uid, name: actor.name, role: actor.role },
    email: "none",
    fromNoteId,
    removed: false,
  }
  const wantsEmail = Boolean(email && to)

  if (usingSeedData) {
    const entry = { id: demoId(), ...update, createdAt: new Date() }
    ;(await demoUpdates(chartId)).unshift(entry)
    if (wantsEmail) {
      try {
        if (updateEmailConfigured) await sendEmail(emailParams(to), UPDATE_TEMPLATE_ID)
        entry.email = "sent"
      } catch {
        entry.email = "failed"
      }
    }
    return { update: { ...entry }, emailed: entry.email }
  }

  const ref = doc(collection(requireDb(), PATIENTS_COLLECTION, chartId, UPDATES))
  await setDoc(ref, { ...update, createdAt: serverTimestamp() })
  let emailed = "none"
  if (wantsEmail) {
    emailed = await sendEmail(emailParams(to), UPDATE_TEMPLATE_ID).then(
      () => "sent",
      () => "failed",
    )
    if (!(await retryOnce(() => updateDoc(ref, { email: emailed })))) console.error("Could not record the update email result.")
  }
  return { update: { id: ref.id, ...update, email: emailed, createdAt: new Date() }, emailed }
}

// Hides it from the patient; it stays on the chart, marked removed.
export async function removeUpdate(chartId, updateId, actor) {
  const by = { uid: actor.uid, name: actor.name }
  if (usingSeedData) {
    const entry = (await demoUpdates(chartId)).find((update) => update.id === updateId)
    if (entry) entry.removed = { by, at: new Date() }
    return
  }
  await updateDoc(doc(requireDb(), PATIENTS_COLLECTION, chartId, UPDATES, updateId), {
    removed: { by, at: serverTimestamp() },
  })
}
```

- [x] **Step 3: Verify.** `npm run lint` clean, `npm run build` succeeds (catches import mistakes), `npm run check` still passes (invites still call `sendEmail(params)` with the default template).

- [x] **Step 4: Commit**

```bash
git add src/admin/lib/emailjs.js src/admin/patients/updateStore.js .env.example
git commit -m "Updates: store (post, email result, remove) and a template id for sendEmail"
```

---

### Task 4: Chart: Updates card, Post dialog, share after signing

**Files:**
- Create: `src/admin/patients/UpdatesCard.jsx`
- Create: `src/admin/patients/PostUpdateDialog.jsx`
- Modify: `src/admin/ui/ConfirmDialog.jsx` (optional `children` rendered under the description)
- Modify: `src/admin/patients/NoteEditor.jsx` (checkbox in the sign confirmation; `onSigned(signedNote, { share })`)
- Modify: `src/admin/patients/PatientChart.jsx` (card under `PortalAccess`, owns the dialog)
- Test: `<scratchpad>/updates-check.mjs` (Playwright, not committed)

**Interfaces:**
- Consumes: `loadUpdates`, `postUpdate`, `removeUpdate` (Task 3); `updatePrefill`, `canRemoveUpdate` (Task 2); `updateEmailConfigured` (Task 3); `usingSeedData`.
- Produces:
  - `<UpdatesCard chartId notes actor canPost version emailFailed onPost />`: `onPost()` asks the chart to open the dialog empty; `version` (number) reloads the list when it changes; `emailFailed` shows the warning line.
  - `<PostUpdateDialog chartId to initialBody fromNoteId actor onClose onPosted />`: `onPosted({ emailed })`.
  - `NoteEditor`'s `onSigned(signedNote, { share: boolean })`, where `signedNote = { ...note, ...fields, status: "signed" }`.
  - `ConfirmDialog` accepts `children`.

- [x] **Step 1: Write the browser check first.** `<scratchpad>/updates-check.mjs`, Playwright against Louie's dev server (port from `npm run dev` output, usually 5173). Force demo mode the way `invite-check` did: `page.route("**/src/admin/lib/firebase.js*", ...)` fetches the real response with `route.fetch()`, replaces `export const usingSeedData = import.meta.env.DEV && !isConfigured` with `export const usingSeedData = true`, and fulfils it. For the email-failure case also route `**/src/admin/lib/emailjs.js*` to a stub:

```js
const failingEmail = `
export const UPDATE_TEMPLATE_ID = "t"
export const emailjsConfigured = true
export const updateEmailConfigured = true
export async function sendEmail() { throw new Error("Bad template") }
`
```

Open the first seeded active chart from `/admin/patients` (one fresh context per case, per CLAUDE.md). Cases:
1. Card shows "No updates yet. Updates you post here show in the patient's portal."
2. **Post an update** → dialog "Post an update"; email box ticked; the fixed note text present. Post with only spaces → "Write a message first.", nothing added.
3. Type "Line one\nLine two", **Post update** → dialog closes; card shows the message on two lines, "{demo name} ({role label})", and "Email sent".
4. Failure stub: post → card shows "Email not sent" and "Update posted, but the email didn't send."
5. **Remove** → confirm dialog with the spec text → **Remove** → update greyed with "Removed by {name} on {date}"; no Remove button on it now.
6. Post 6 updates → 5 shown and "Show all (6)"; clicking shows 6.
7. Over the limit: `fill` the textarea with 2001 characters (it has no `maxLength`, on purpose) → counter "2001 / 2000" and Post update refused with "Keep it to 2,000 characters.", text kept.
8. Share after signing: **New progress note**, fill the Plan section with "Walk 20 minutes a day.", fill whatever `signProblem` requires (visit date is preset), **Sign note** → tick "Then share an update with the patient" → **Sign note** → Post dialog opens with "Walk 20 minutes a day."; post it → card shows "Shared from the {date} progress note".
9. An inactive seeded chart (if the seed has one; otherwise decline a patient in Applicants first): no **Post an update** button, and the sign confirmation (if a draft can be opened) has no share checkbox.
10. Dark theme (toggle the theme switch) screenshot of the card and dialog; 390 px wide: no horizontal scroll (`document.documentElement.scrollWidth <= 390`). Read the screenshots.

Run it now: expected FAIL (no Updates card).

- [x] **Step 2: `ConfirmDialog` children.** Add `children` to the props and render it right after the description:

```jsx
          {description && <p className="mt-2 text-sm text-ink-950/60">{description}</p>}
          {children}
```

- [x] **Step 3: `PostUpdateDialog.jsx`:**

```jsx
import { useState } from "react"
import { updateEmailConfigured } from "../lib/emailjs"
import { usingSeedData } from "../lib/firebase"
import Modal from "../ui/Modal"
import { inputClass, labelClass } from "./noteUi"
import { postUpdate } from "./updateStore"

const MAX = 2000

// Post a portal update (spec: 2026-10-05-portal-updates-design). Opened empty
// from the Updates card, or pre-filled from a note just signed.
export default function PostUpdateDialog({ chartId, to, initialBody = "", fromNoteId = null, actor, onClose, onPosted }) {
  const emailReady = updateEmailConfigured || usingSeedData
  const canEmail = emailReady && Boolean(to)
  const [body, setBody] = useState(initialBody)
  const [email, setEmail] = useState(canEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return setError("Write a message first.")
    if (text.length > MAX) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      const { emailed } = await postUpdate({ chartId, to, body: text, fromNoteId, email: email && canEmail }, actor)
      onPosted({ emailed })
    } catch (cause) {
      setError(cause?.code === "permission-denied" ? "Your role can't post updates on this chart." : "Couldn't post the update. Try again.")
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Post an update"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-sm text-brand-dark">
              {error}
            </p>
          )}
          <button
            type="submit"
            form="post-update"
            disabled={busy}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post update"}
          </button>
        </>
      }
    >
      <form id="post-update" onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={labelClass}>Message</span>
          <textarea
            value={body}
            rows={7}
            onChange={(event) => setBody(event.target.value)}
            className={`${inputClass} resize-y leading-relaxed`}
          />
          {body.length > MAX - 200 && (
            <span className={`mt-1 block text-right text-xs ${body.length > MAX ? "text-brand-dark" : "text-ink-950/55"}`}>
              {body.length} / {MAX}
            </span>
          )}
        </label>
        <label className={`flex items-start gap-2 text-sm ${canEmail ? "cursor-pointer text-ink-950/80" : "text-ink-950/50"}`}>
          <input
            type="checkbox"
            checked={email && canEmail}
            disabled={!canEmail}
            onChange={(event) => setEmail(event.target.checked)}
            className="mt-0.5 size-4 accent-accent-dark"
          />
          <span>
            Email the patient that there's a new update
            {!emailReady && <span className="block text-xs">Email sending isn't set up yet.</span>}
            {emailReady && !to && <span className="block text-xs">There's no email on this intake.</span>}
          </span>
        </label>
        <p className="text-xs text-ink-950/55">The patient sees your name and role. The email doesn't include the message.</p>
      </form>
    </Modal>
  )
}
```

(No `maxLength` on the textarea on purpose: a long prefill must stay visible and editable, not be cut off silently.)

- [x] **Step 4: `UpdatesCard.jsx`:**

```jsx
import { useCallback, useEffect, useState } from "react"
import { canRemoveUpdate, ROLE_LABELS } from "../staff/roles"
import ConfirmDialog from "../ui/ConfirmDialog"
import { NOTE_TYPE_LABELS, formatDay, formatStamp } from "./noteUi"
import { loadUpdates, removeUpdate } from "./updateStore"

const SHOWN = 5
const EMAIL_WORDS = { sent: "Email sent", failed: "Email not sent", none: "Not emailed" }

// The chart's "Updates" card: what the patient sees in their portal, newest
// first. Posting is the chart's job (it also opens the dialog after a
// signing); this card lists, reloads on `version`, and removes.
export default function UpdatesCard({ chartId, notes, actor, canPost, version, emailFailed, onPost }) {
  const [updates, setUpdates] = useState(null)
  const [failed, setFailed] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [removeError, setRemoveError] = useState(null)

  const reload = useCallback(() => {
    loadUpdates(chartId).then(
      (next) => {
        setUpdates(next)
        setFailed(false)
      },
      (cause) => {
        console.error("Could not load updates:", cause.code ?? cause.message)
        setFailed(true)
      },
    )
  }, [chartId])

  useEffect(reload, [reload, version])

  const confirmRemove = async () => {
    setBusy(true)
    try {
      await removeUpdate(chartId, removing.id, actor)
      setRemoveError(null)
      reload()
    } catch {
      setRemoveError("Couldn't remove the update. Try again.")
    }
    setBusy(false)
    setRemoving(null)
  }

  const sourceNote = (id) => notes?.find((note) => note.id === id)
  const shown = showAll ? updates : updates?.slice(0, SHOWN)

  return (
    <section className="rounded-2xl border border-ink-950/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-950">Updates</h2>
        {canPost && (
          <button
            type="button"
            onClick={onPost}
            className="cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-paper-50 transition-colors duration-200 hover:bg-brand-dark"
          >
            Post an update
          </button>
        )}
      </div>

      {emailFailed && (
        <p role="status" className="mt-3 text-sm text-brand-dark">
          Update posted, but the email didn't send.
        </p>
      )}
      {removeError && (
        <p role="alert" className="mt-3 text-sm text-brand-dark">
          {removeError}
        </p>
      )}

      <div className="mt-3 text-sm">
        {failed ? (
          <p className="text-brand-dark">Couldn't load the updates.</p>
        ) : !updates ? (
          <p className="text-ink-950/50">Loading…</p>
        ) : updates.length === 0 ? (
          <p className="text-ink-950/55">No updates yet. Updates you post here show in the patient's portal.</p>
        ) : (
          <ol className="divide-y divide-ink-950/10">
            {shown.map((update) => {
              const note = update.fromNoteId && sourceNote(update.fromNoteId)
              return (
                <li key={update.id} className={`py-3 first:pt-0 last:pb-0 ${update.removed ? "opacity-55" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-xs text-ink-950/55">
                      {formatStamp(update.createdAt)} · {update.author?.name} ({ROLE_LABELS[update.author?.role] ?? update.author?.role})
                    </p>
                    {canRemoveUpdate(update, actor) && (
                      <button
                        type="button"
                        onClick={() => setRemoving(update)}
                        className="cursor-pointer text-xs font-semibold text-ink-950/60 transition-colors duration-200 hover:text-brand-dark"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-line wrap-break-word text-ink-950">{update.body}</p>
                  <p className="mt-1 text-xs text-ink-950/50">
                    {[
                      update.removed
                        ? `Removed by ${update.removed.by?.name} on ${formatDay(update.removed.at)}`
                        : EMAIL_WORDS[update.email] ?? EMAIL_WORDS.none,
                      note && `Shared from the ${formatDay(note.visitDate)} ${NOTE_TYPE_LABELS[note.type]?.toLowerCase() ?? "note"}`,
                    ]
                      .filter(Boolean)
                      .join(". ")}
                  </p>
                </li>
              )
            })}
          </ol>
        )}
        {updates?.length > SHOWN && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-3 cursor-pointer text-xs font-semibold text-accent-text hover:underline"
          >
            Show all ({updates.length})
          </button>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this update?"
        description="The patient won't see it any more. It stays on the chart as removed."
        confirmLabel={busy ? "Removing…" : "Remove"}
        confirmDisabled={busy}
        onConfirm={confirmRemove}
        onCancel={() => !busy && setRemoving(null)}
      />
    </section>
  )
}
```

Note: `formatDay` takes a Firestore Timestamp via `asDate`, so `formatDay(update.removed.at)` works for both Timestamps and Dates. `NOTE_TYPE_LABELS.progress` is "Progress note", lowercased → "Shared from the Oct 5, 2026 progress note".

- [x] **Step 5: NoteEditor.** Add state `const [share, setShare] = useState(false)`. In `sign`, replace `onSigned()` with:

```js
      onSigned({ ...note, ...latest.current, status: "signed" }, { share })
```

Give the sign `ConfirmDialog` a child (only when the chart is active):

```jsx
      <ConfirmDialog
        open={confirm === "sign"}
        title="Sign this note?"
        description="Signing locks the note. Any change after this is added as a dated addendum."
        confirmLabel={busy ? "Signing…" : "Sign note"}
        confirmDisabled={busy}
        onConfirm={sign}
        onCancel={() => setConfirm(null)}
      >
        {chart.status === "active" && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink-950/80">
            <input type="checkbox" checked={share} onChange={(event) => setShare(event.target.checked)} className="size-4 accent-accent-dark" />
            Then share an update with the patient
          </label>
        )}
      </ConfirmDialog>
```

- [x] **Step 6: PatientChart.** Imports: `updatePrefill` from `./chartMath`, `PostUpdateDialog`, `UpdatesCard`. State:

```js
  const [posting, setPosting] = useState(null) // null | { body, fromNoteId }
  const [updatesVersion, setUpdatesVersion] = useState(0)
  const [updateEmailFailed, setUpdateEmailFailed] = useState(false)
```

Replace `onSigned={afterEditor}` with:

```jsx
          onSigned={async (signed, { share }) => {
            await afterEditor()
            if (share) setPosting({ body: updatePrefill(signed), fromNoteId: signed.id })
          }}
```

Under `<PortalAccess …/>`:

```jsx
          <UpdatesCard
            chartId={chart.id}
            notes={notes}
            actor={actor}
            canPost={chart.status === "active"}
            version={updatesVersion}
            emailFailed={updateEmailFailed}
            onPost={() => setPosting({ body: "", fromNoteId: null })}
          />
```

Next to the other dialogs at the end:

```jsx
      {posting && (
        <PostUpdateDialog
          chartId={chart.id}
          to={(demographics.email ?? "").trim().toLowerCase()}
          initialBody={posting.body}
          fromNoteId={posting.fromNoteId}
          actor={actor}
          onClose={() => setPosting(null)}
          onPosted={({ emailed }) => {
            setPosting(null)
            setUpdateEmailFailed(emailed === "failed")
            setUpdatesVersion((version) => version + 1)
          }}
        />
      )}
```

- [x] **Step 7: Run the browser check.** `node <scratchpad>/updates-check.mjs`. Expected: all cases pass. Look at each screenshot (light, dark, 390 px). `npm run lint`, `npm run build`, `npm run check` clean.

- [x] **Step 8: Commit**

```bash
git add src/admin/ui/ConfirmDialog.jsx src/admin/patients/NoteEditor.jsx src/admin/patients/PatientChart.jsx src/admin/patients/UpdatesCard.jsx src/admin/patients/PostUpdateDialog.jsx
git commit -m "Chart: Updates card, Post an update dialog, share an update after signing"
```

---

### Task 5: Patient portal: the Updates section

**Files:**
- Modify: `src/lib/patientAuth.js` (add `getMyUpdates`)
- Modify: `src/pages/Account.jsx`
- Test: `<scratchpad>/portal-updates-check.mjs` (Playwright, not committed)

**Interfaces:**
- Consumes: the rules from Task 1 (patient query must filter `removed == false`).
- Produces: `getMyUpdates(intakeId) → Promise<Array<{ id, body, author: { name, role }, createdAt }>>`, newest first.

- [x] **Step 1: Write the browser check first.** `<scratchpad>/portal-updates-check.mjs`. Route `**/src/lib/patientAuth.js*` to a stub (one fresh context per mode):

```js
const stub = (mode) => `
export const isConfigured = true
const user = { uid: "u", email: "p@x.co" }
export function watchPatientUser(cb) { queueMicrotask(() => cb(user)); return () => {} }
export async function getMyPortalLink() { return { intakeId: "i1", firstName: "Maria" } }
export async function getMyUpdates() {
  if ("${mode}" === "error") throw Object.assign(new Error("denied"), { code: "permission-denied" })
  if ("${mode}" === "empty") return []
  return [
    { id: "b", body: "Your meal plan is ready.\\nStart Monday.", author: { name: "Sam Rivera, RD", role: "dietitian" }, createdAt: new Date("2026-10-05T15:00:00") },
    { id: "a", body: "<b>not bold</b>", author: { name: "Hyacinth", role: "superAdmin" }, createdAt: new Date("2026-10-01T09:00:00") },
  ]
}
export async function signInPatient() { return user }
export async function resetPatientPassword() {}
export async function signOutPatient() {}
`
```

Cases:
- `list`: section heading "Updates"; first item "Oct 5, 2026 · From Sam Rivera, RD (Dietitian)" and the message on two lines; second item shows the literal text `<b>not bold</b>` (no `<b>` element in the DOM) and "From Hyacinth (Care team)"; the Updates card has no "Coming soon" and links to `#updates`; the other three cards still say "Coming soon"; clicking the Updates card scrolls the section into view.
- `empty`: "Updates from your care team will show up here."
- `error`: "We couldn't load your updates." and **Try again** (clicking it calls `getMyUpdates` again; the stub counts calls via `window.__calls`).
- 390 px wide: no horizontal scroll; screenshots at 1280 and 390 (scroll first, `useReveal`). Read them.

Run: expected FAIL (no section).

- [x] **Step 2: `getMyUpdates`.** In `patientAuth.js`, extend the firestore import with `collection, getDocs, query, where`, and after `getMyPortalLink`:

```js
// The patient's portal updates, newest first. The rules only let a patient
// read updates not removed, so the query must say removed == false. Sorted
// here rather than by Firestore so no composite index is needed; a patient
// has tens of updates at most.
export async function getMyUpdates(intakeId) {
  if (!db) return []
  const snap = await getDocs(query(collection(db, "patients", intakeId, "updates"), where("removed", "==", false)))
  const millis = (value) => value?.toMillis?.() ?? 0
  return snap.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
}
```

- [x] **Step 3: Account.jsx.** Import `getMyUpdates`. Add after the class constants (`cardClass` … `inlineLink`, since it uses `secondaryButton`) and before `export default function Account`:

```jsx
// How staff roles read to a patient (planning decision, flagged to Louie):
// the admin is Dr. Antonious, so "Provider"; co-admins and super admins
// aren't necessarily clinicians, so "Care team".
const AUTHOR_ROLES = { provider: "Provider", dietitian: "Dietitian", admin: "Provider", coAdmin: "Care team", superAdmin: "Care team" }

const updateDay = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""
}

function PortalUpdates({ intakeId }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null) // { attempt, updates } | { attempt, failed }

  useEffect(() => {
    let live = true
    getMyUpdates(intakeId).then(
      (updates) => live && setResult({ attempt, updates }),
      (cause) => {
        console.error("Could not load updates:", cause.code ?? cause.message)
        if (live) setResult({ attempt, failed: true })
      },
    )
    return () => {
      live = false
    }
  }, [intakeId, attempt])

  const current = result?.attempt === attempt ? result : null

  return (
    <section id="updates" className="mt-10 scroll-mt-24 border-t border-ink-950/10 pt-8">
      <h2 className="font-serif text-2xl text-ink-950">Updates</h2>
      {!current ? (
        <p className="mt-4 text-sm text-ink-950/60">Loading your updates…</p>
      ) : current.failed ? (
        <div className="mt-4">
          <p className="text-ink-950/70">We couldn't load your updates.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`mt-4 ${secondaryButton}`}>
            Try again
          </button>
        </div>
      ) : current.updates.length === 0 ? (
        <p className="mt-4 text-ink-950/70">Updates from your care team will show up here.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {current.updates.map((update) => (
            <li key={update.id} className="rounded-2xl bg-paper-100 p-5">
              <p className="text-sm text-ink-950/60">
                {updateDay(update.createdAt)} · From {update.author?.name} ({AUTHOR_ROLES[update.author?.role] ?? "Care team"})
              </p>
              <p className="mt-2 whitespace-pre-line wrap-break-word leading-relaxed text-ink-950">{update.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
```

In the linked card list, make the Updates card a link (the others unchanged):

```jsx
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {sections.map(({ Icon, title, line }) => {
              const live = title === "Updates"
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="size-6 text-accent-dark" aria-hidden="true" />
                    {!live && (
                      <span className="rounded-full bg-paper-50 px-2.5 py-0.5 text-xs font-medium text-ink-950/70">Coming soon</span>
                    )}
                  </div>
                  <h2 className="mt-4 font-serif text-xl text-ink-950">{title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-950/70">{line}</p>
                </>
              )
              return (
                <li key={title}>
                  {live ? (
                    <a href="#updates" className="block h-full rounded-2xl bg-paper-100 p-5 transition-colors duration-200 ease-out-smooth hover:bg-paper-200">
                      {inner}
                    </a>
                  ) : (
                    <div className="h-full rounded-2xl bg-paper-100 p-5">{inner}</div>
                  )}
                </li>
              )
            })}
          </ul>

          <PortalUpdates intakeId={link.intakeId} />
```

Change the Updates card's `line` to "Messages from your care team about your plan." and the intro under the welcome heading from "Here's what's on the way." to "Your updates are below. More is on the way." Run both strings through `humanizer`.

- [x] **Step 4: Run the check.** `node <scratchpad>/portal-updates-check.mjs` → all pass; read the screenshots. Also re-run the previous `portal-check.mjs` cases if still in the scratchpad (stub needs `getMyUpdates` added) to be sure the other states didn't change. `npm run lint`, `npm run build` clean.

- [x] **Step 5: Commit**

```bash
git add src/lib/patientAuth.js src/pages/Account.jsx
git commit -m "Portal: Updates section on /account"
```

---

### Task 6: Docs and wrap-up

**Files:**
- Modify: `docs/client-portal.md` (EmailJS setup: the second template; "Where we left off": Updates built, what's next)

- [x] **Step 1: EmailJS setup.** Add a step after step 2 in "EmailJS setup (once)":

```markdown
2b. A second template for portal updates: To Email `{{to_email}}`, From Name `CorePhia`,
   Reply To `info@corephia.com`, Subject `{{subject}}`, body "Your CorePhia care team
   posted an update. Log in to your portal to read it." and a button **Open your portal**
   linking `{{portal_link}}`, then "CorePhia Health · Tampa, Florida". It never carries
   the update's text. Copy its id into `VITE_EMAILJS_UPDATE_TEMPLATE_ID`. Without it the
   Post dialog says "Email sending isn't set up yet." and still posts.
```

- [x] **Step 2: "Where we left off".** Replace the "Next: build Updates" paragraph with what was built (chart card, dialog, share after signing, `/account` section), the planning decisions listed at the top of this plan for Louie to confirm, and: "Deploy the rules (`firebase deploy --only firestore:rules`) before posting on the live project; set up the update template." Keep the other open items as they are (setup/reset final review, invite-check, parked Portal active card, test data).

- [x] **Step 3: Verify everything.** Load `superpowers:verification-before-completion`, then run and report the actual output of: `npm run test:rules`, `npm run check`, `npm run lint`, `npm run build`, both Playwright scripts.

- [x] **Step 4: Commit**

```bash
git add docs/client-portal.md
git commit -m "Docs: portal updates email template and where we left off"
```
