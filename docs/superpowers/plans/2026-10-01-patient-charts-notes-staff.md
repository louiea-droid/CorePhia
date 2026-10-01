# Patient charts, clinical notes and staff roles: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admitted applicants get a chart in the admin, where provider/admin/superAdmin write,
sign and amend consultation and progress notes with structured prescriptions; admins grant a
new `provider` role from a Staff page.

**Architecture:** Firestore `patients/{intakeId}` charts with `notes` and `amendments`
subcollections; every access rule in `firestore.rules`. All reads and writes go through
`src/admin/firebase.js` (and an in-memory demo store when `usingSeedData`). New admin pages
follow the existing Applicants patterns (PageHeader, table, skeleton, portal modals).

**Tech Stack:** React 19, react-router 7, Tailwind 4, Firebase JS SDK 12 (Auth, Firestore),
oxlint. Rules tests: `@firebase/rules-unit-testing` + Firestore emulator (needs Java 21+).

**Spec:** `docs/superpowers/specs/2026-10-01-patient-charts-notes-staff-design.md`

**Execution:** Native (Louie said "start building", 2026-10-01). No commits unless Louie asks.

## Global Constraints

- Signed notes: never updated or deleted by anyone; only addenda. Charts never deleted.
- Timestamps that prove when (`admittedAt`, `createdAt`, `signedAt`, amendment `at`) are
  `serverTimestamp()` and checked `== request.time` in rules.
- `isClinical()` = provider|admin|superAdmin; `isStaff()` = admin|superAdmin (unchanged).
- An admin grants or removes only `provider`; nobody writes their own `user/{uid}`.
- Admin UI uses only existing design tokens; text on accent fills uses `text-oncolor`;
  `.dark` must keep working (colours `.dark` redefines are avoided on solid fills).
- No em dashes in UI copy. Brand spelled "CorePhia".
- Demo mode (`usingSeedData`) must never be reachable in a production build.

## Review Focus

1. **Two tabs, same draft:** an author edits a draft in two places; last write wins, signing
   from one tab must not resurrect stale text. Sign reads the editor's current state and
   writes it in the same update.
2. **Admit → decline → admit:** chart must flip active/inactive/active, never duplicate, never
   lose notes. Test in Task 5.
3. **Applicant with no height/weight on the intake:** BMI and weight-change show nothing,
   not `NaN`. Test in Task 3 (`bmi()`).
4. **Prescription renewed twice, then stopped:** current list shows one entry, gone after the
   stop. Test in Task 3.
5. **A provider signs in:** no Messages subscription error, no Analytics/Staff links, Activity
   unreachable by URL. Check in Task 2.

---

### Task 1: Move the sign-up record to `patientAccounts`

**Files:** Modify `src/lib/patientAuth.js` (`recordNewPatient`), `firestore.rules`
(`match /patients/{uid}` → `match /patientAccounts/{uid}`, comment updated).

- [ ] `setDoc(doc(db, "patientAccounts", user.uid), …)`; update the two comments naming
  `patients/{uid}`.
- [ ] Rename the rules block; keep its conditions byte-for-byte.
- [ ] `npm run build` passes.

### Task 2: Provider role in the client

**Files:** Create `src/admin/roles.js`. Modify `firebase.js` (`getAdminRole`), `Sidebar.jsx`,
`AdminApp.jsx`, `Activity.jsx` (labels).

**Produces:**
```js
// roles.js
export const ROLE_LABELS = { superAdmin: "Super admin", admin: "Admin", provider: "Provider" }
export const CLINICAL_ROLES = ["provider", "admin", "superAdmin"]
export const isClinicalRole = (role) => CLINICAL_ROLES.includes(role)
export const isStaffRole = (role) => role === "admin" || role === "superAdmin"
// Which roles may open each admin page. Sidebar and AdminApp both read this.
export const PAGE_ROLES = {
  dashboard: CLINICAL_ROLES, applicants: CLINICAL_ROLES, patients: CLINICAL_ROLES,
  messages: ["admin", "superAdmin"], analytics: ["admin", "superAdmin"],
  staff: ["admin", "superAdmin"], activity: ["superAdmin"],
}
export const canOpen = (page, role) => PAGE_ROLES[page]?.includes(role) ?? false
```
- [ ] `getAdminRole` accepts `provider`.
- [ ] Sidebar `NAV_ITEMS` get `page` keys; filter with `canOpen`. `useContactMessages` only
  subscribes when `canOpen("messages", role)` (add an `enabled` argument to the hook).
- [ ] AdminApp routes: wrap each page in `<Guard page="…" role={role}>`, which renders a small
  "Your role can't open this page" card when `!canOpen`.
- [ ] Activity labels for every `AUDIT_ACTIONS` key, including the existing
  `updateIntakeStatus` and the new ones from Task 4.
- [ ] Build passes; Review Focus 5 checked by reading the code paths.

### Task 3: Pure helpers: prescriptions, BMI, age (with self-check)

**Files:** Create `src/admin/chartMath.js`, `src/admin/chartMath.check.js`; add npm script
`"check": "node src/admin/chartMath.check.js"`.

**Produces:**
```js
export function currentPrescriptions(notes)
// notes: [{ status, signedAt (Date|ms|ISO), prescriptions: [{ id, action, medication,
//   instructions, startDate, renewalDue, stopReason, renewsId }] }]
// returns [{ id, medication, instructions, startDate, renewalDue }] — signed notes only,
// oldest first; "renew" replaces renewalDue (and instructions if given) of the chain it renews;
// "stop" removes the chain. Chains: renewsId may point at a start or at a renew.
export function bmi(heightFeet, heightInches, weightLb) // number with 1 decimal, or null
export function ageFrom(dateOfBirth, now = new Date()) // whole years, or null
```
- [ ] Write `chartMath.check.js` with asserts: start only; start→renew; start→renew→renew;
  renew→stop (stop pointing at the renew removes the chain); draft notes ignored; out-of-order
  input sorted by signedAt; `bmi("", "", 200) === null`; `bmi("5","10",220) === 31.6`;
  `ageFrom("")===null`; birthday-not-yet-this-year case.
- [ ] Run `npm run check`: fails (module missing).
- [ ] Implement; run until it passes.

### Task 4: Data layer and demo store

**Files:** Modify `src/admin/firebase.js`. Create `src/admin/seedCharts.js`.

**Produces (all async unless noted):**
```js
export const PATIENTS_COLLECTION = "patients"
AUDIT_ACTIONS += { viewChart: "view_patient_chart", signNote: "sign_note",
  addAmendment: "add_note_amendment", addStaff: "add_staff", changeStaffRole: "change_staff_role" }
setApplicantStatus(record, status, actor)   // batch: intake status + chart create/activate/deactivate
loadCharts()                                // [{ id, ...chart }]
loadChart(chartId)                          // { id, ...chart } | null
loadNotes(chartId, uid)                     // signed + my drafts, newest visitDate first
createDraftNote(chartId, type, actor, prefill) // → note
saveDraftNote(chartId, noteId, fields)      // fields: visitDate, sections, vitals, prescriptions, nextFollowUp
discardDraftNote(chartId, noteId)
signNote(chartId, noteId, fields, actor)    // batch: note signed + chart.lastNote
loadAmendments(chartId, noteId)
addAmendment(chartId, noteId, text, actor)
loadStaff()                                 // [{ uid, name, email, role, addedAt }]
addStaff({ name, email, role }, actor)      // second app instance → user doc → reset email
setStaffRole(uid, role)
// actor = { uid, name, role }
```
- [ ] Demo store: when `usingSeedData`, every function above reads/writes an in-memory object
  seeded by `seedCharts.js` (charts for seed records with status admitted; one signed
  consultation, one signed progress note with an addendum, prescriptions with one renewal due
  within 7 days). `seedRecords.js`: set `status: "admitted"` on the first 6 records.
- [ ] Build passes.

### Task 5: Admission creates the chart

**Files:** Modify `src/admin/Applicants.jsx` (`updateStatus`), `useIntakeRecords.js`
(expose `setLocalStatus`).

- [ ] `updateStatus` calls `setApplicantStatus(record, status, actor)` then updates local state
  and audits as today. `actor` comes from AdminApp (pass `user`, `displayName` down).
- [ ] Review Focus 2: in demo mode, admit → decline → admit one record; `loadCharts()` shows
  one chart, status active, notes intact.

### Task 6: Patients list

**Files:** Create `src/admin/Patients.jsx`. Modify `AdminApp.jsx` (route `/admin/patients`,
remove redirect), `Sidebar.jsx` (Patients item under Applicants), `Skeleton.jsx` if needed.

- [ ] Columns Name, Age (`ageFrom`), Admitted, Last note; search; Active/Inactive toggle;
  pagination as Applicants; whole-row click → `/admin/patients/:id`. Empty state: "No patients
  yet. Admitting an applicant starts their chart."

### Task 7: Chart page

**Files:** Create `src/admin/PatientChart.jsx`. Route `/admin/patients/:chartId`.

- [ ] Loads chart, intake record, notes. Header; Summary (from intake); Current prescriptions
  (`currentPrescriptions`); notes timeline; "View full intake" opens `ApplicantModal` with
  `canReview={false}`; audit `viewChart` once per open (ref guard like ApplicantModal).
- [ ] Phone: stacked, notes first. Not found → "This chart doesn't exist" with a link back.

### Task 8: Note editor, signing, addenda

**Files:** Create `src/admin/NoteEditor.jsx`, `src/admin/NoteView.jsx`.

- [ ] Editor (portal dialog, full height on phone): fields by type per spec; pertinent history
  prefilled for consultation; vitals with live BMI and change vs last signed weight; prescription
  rows (add, remove while draft) and Renew/Stop on current ones; next follow-up.
- [ ] Autosave 1.5 s after the last change and on close; status line "Saved" / "Saving…" /
  "Not saved, will retry". Discard (confirm). Sign (confirm) → `signNote` with current fields.
- [ ] NoteView: read-only signed note, addenda list, "Add addendum" box → `addAmendment`.
- [ ] Errors stay in place; permission errors read "Your role can't do this."

### Task 9: Staff page

**Files:** Create `src/admin/Staff.jsx`. Route `/admin/staff`, sidebar item (staff roles).

- [ ] List; Add staff form (role picker: provider only for admin); per-row role change and
  Remove access (confirm); own row read-only. `auth/email-already-in-use` message per spec.

### Task 10: Rules and rules tests

**Files:** Modify `firestore.rules`. Create `tests/firestore.rules.test.js`; add dev dependency
`@firebase/rules-unit-testing`; script
`"test:rules": "firebase emulators:exec --only firestore \"node --test tests/\""`.

- [ ] Rules per spec section "Rules" (isClinical, intakeRecords, patients, notes, amendments,
  user, patientAccounts).
- [ ] Tests (node:test + rules-unit-testing): provider creates note, can't read messages,
  can't write user docs; admin grants provider, can't grant admin, can't edit own role;
  signed note update/delete denied for author and superAdmin; amendment with client time
  denied; chart create without admitted intake denied; draft unreadable by another clinician;
  sign with someone else's `signedBy` denied.
- [ ] Can't run here (no Java). Document in the test file header.

### Task 11: Docs and verification

- [ ] CLAUDE.md: roles, collections, rules-deploy note.
- [ ] `npm run lint`, `npm run build`, `npm run check`.
- [ ] Browser pass (needs deployed rules or a demo server; ask Louie): admit → chart → consult
  with prescription → sign → addendum → progress note renews → current prescriptions; Staff
  add provider; phone width; dark mode.
