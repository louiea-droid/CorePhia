# Patient charts, clinical notes and staff roles: design

Date: 2026-10-01. Status: **awaiting review** (Louie).

Source: Dr. Antonious's back-office requests in the 2026-09-29 meeting
(`docs/MEETING TRANSCRIPTION.docx` ¶29–38, summarised in `docs/client-portal.md`). Per Louie,
Elation is set aside: the admin becomes the system for these.

## Scope

This round builds three connected pieces, plus one prerequisite:

0. **Prerequisite:** move the public login's sign-up record from `patients/{uid}` to
   `patientAccounts/{uid}`, freeing `patients` for charts.
1. **Patients list and chart page.**
2. **Clinical notes:** consultation and progress notes, draft → sign → amend, structured
   prescriptions.
3. **Staff page:** a `provider` role that admins can grant.

**Already done** (2026-10-01): the old "Patients" page is renamed **Applicants**
(`/admin/applicants`, `Applicants.jsx`, `ApplicantsTable.jsx`, `ApplicantModal.jsx`,
`ApplicantListModal.jsx`). `/admin/patients` temporarily forwards there; this work takes it over.

**Out of scope, in planned order afterwards:** dietitian and exercise notes and roles (#3 in the
roadmap), calendar (#4), to-do and renewal alerts (#5), new-intake notification email (#6), the
client portal (`docs/client-portal.md`). Telemedicine is not built; use a HIPAA-ready video
service linked from the calendar later.

## Constraints

- **HIPAA.** Charts and notes are PHI. Real patient data needs a signed Google Cloud BAA for the
  project first (CLAUDE.md blocker 1). Everything here is built and shown in demo mode until then.
- **Medical-record integrity.** Signed notes are never edited or deleted, by anyone. Changes are
  addenda. Charts are never deleted, only marked inactive. Enforced in `firestore.rules`.
- **The admin's existing patterns apply:** role lookup from `user/{uid}`, the append-only
  `auditLog`, two-factor sign-in, the idle timeout, `usingSeedData` demo mode, the admin's
  design tokens (light and `.dark`).

---

## Roles

| Role | Who | New? |
|---|---|---|
| `superAdmin` | Hyacinth | existing |
| `admin` | Dr. Antonious | existing |
| `provider` | providers Dr. Antonious adds | **new** |

**Permissions:**

| Capability | provider | admin | superAdmin |
|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ |
| Applicants: view, admit, decline | ✓ | ✓ | ✓ |
| Patients and charts: view | ✓ | ✓ | ✓ |
| Write and sign notes, add addenda | ✓ | ✓ | ✓ |
| Messages, Analytics | | ✓ | ✓ |
| Staff page | | ✓ (grant/remove `provider` only) | ✓ (any role) |
| Activity log, delete intake records and messages | | | ✓ |

Two rule helpers replace today's single `isStaff()`:

- `isClinical()`: `provider`, `admin` or `superAdmin`. Gates intake records, charts and notes.
- `isStaff()`: `admin` or `superAdmin`, unchanged. Gates messages, site events and the staff list.

`getAdminRole()` in `admin/firebase.js` accepts `provider` as a valid role. The sidebar's
`NAV_ITEMS` gain a per-item list of allowed roles, replacing the `superAdminOnly` flag.

---

## Data model

### `patients/{chartId}` (one chart per admitted applicant)

`chartId` is the intake record's id, so the link is the id itself and a second chart for the
same intake can't exist.

```
intakeRecordId   string   same as the doc id
firstName        string   copied from the intake at admission, for the list
lastName         string   (the intake is write-once, so the copy cannot drift)
dateOfBirth      string
sexAssignedAtBirth string
status           "active" | "inactive"
admittedAt       timestamp   request.time at creation
admittedBy       { uid, name, role }
updatedAt        timestamp
lastNote         { type, signedAt } | null   updated on each signing, for the list column
```

### `patients/{chartId}/notes/{noteId}`

```
type             "consultation" | "progress"
status           "draft" | "signed"
authorUid, authorName, authorRole
createdAt, updatedAt   timestamps
visitDate        string (YYYY-MM-DD)
sections         { chiefConcern, hpi, intervalHistory, pertinentHistory, assessment, plan }
                 all strings, any may be empty; which ones show depends on type
vitals           { weightLb, systolic, diastolic, heartRate }   numbers or null
prescriptions    [ { id, action, medication, instructions, startDate, renewalDue,
                     stopReason, renewsId } ]
                 action: "start" | "renew" | "stop"; renewsId points at the entry renewed/stopped
nextFollowUp     string (YYYY-MM-DD) | ""
signedAt         timestamp | null
signedBy         { uid, name, role } | null
```

### `patients/{chartId}/notes/{noteId}/amendments/{amendmentId}`

```
text             string
authorUid, authorName, authorRole
at               timestamp (request.time)
```

A subcollection, not an array on the note, because a server timestamp can't be written inside
an array, and each addendum needs a time the client can't forge.

### `user/{uid}` (staff roles, extended)

```
role       "provider" | "admin" | "superAdmin" | ""   ("" = access removed)
name, email
addedBy    { uid, name }
addedAt    timestamp
```

Existing role docs (role only) keep working; the extra fields are optional.

### `patientAccounts/{uid}` (moved from `patients/{uid}`)

Same shape and rule as today's `patients/{uid}` (`email`, `createdAt`), written by
`lib/patientAuth.js` on sign-up. After this ships, Louie deletes the old `patients/{uid}`
documents in the Firebase console (only sign-up emails).

---

## 1. Patients list and chart page

**Sidebar:** **Patients** (people icon, `PatientsIcon`) at `/admin/patients`, below Applicants.
The temporary redirect is removed.

**Admission creates the chart.** In `ApplicantModal`, setting status to **admitted** writes, in
one batch, the intake's status and (if it doesn't exist) the chart. Setting status back to
pending or declined sets the chart to `inactive`; re-admitting sets it `active` again. Charts
are never deleted. The rules check, via `getAfter`, that a chart is only created for an intake
whose status is `admitted` in the same batch.

**Patients list (`Patients.jsx`):**

- Active charts by default; a toggle shows inactive.
- Search by name.
- Columns: **Name**, **Age**, **Admitted**, **Last note** (type and date). Columns for next
  appointment and renewal due arrive with the calendar and to-do work.
- Reuses the `ApplicantsTable` look (fixed columns, whole-row click, pagination, skeleton).

**Chart page (`/admin/patients/:chartId`, `PatientChart.jsx`):**

- **Header:** name, age, sex, phone, email, "Admitted {date} by {name}", status badge if inactive.
- **Left column, Summary from the intake:** goal, current weight, height and BMI, conditions,
  medications, allergies, surgeries, family history, lifestyle. **View full intake** opens the
  existing `ApplicantModal` read-only.
- **Left column, Current prescriptions:** derived from signed notes (see Prescriptions).
- **Right column, Notes timeline:** newest first. Each entry shows type, visit date, status
  (Draft, or "Signed by {name} ({role})"), first line of the plan, and an addenda count.
  **New note** offers Consultation or Progress.
- **Phone:** columns stack, notes first.
- **Audit:** opening a chart writes `view_patient_chart`.

## 2. Clinical notes

**Editor** (`NoteEditor.jsx`, opens over the chart): fields by type.

| Field | Consultation | Progress |
|---|---|---|
| Visit date (defaults to today) | ✓ | ✓ |
| Reason for visit / chief concern | ✓ | |
| HPI | ✓ | |
| Interval history | | ✓ |
| Pertinent history, prefilled from the intake, editable | ✓ | |
| Vitals: weight, blood pressure, heart rate (optional); BMI auto from intake height; progress shows change since last signed note | ✓ | ✓ |
| Assessment | ✓ | ✓ |
| Plan | ✓ | ✓ |
| Prescriptions | ✓ | ✓ |
| Next follow-up date | ✓ | ✓ |

**Lifecycle:**

1. **Draft:** created on **New note**; autosaves (debounced, about 1.5 s after typing stops,
   plus on close). Visible and editable only by its author. **Discard draft** deletes it.
2. **Sign:** confirmation ("Signing locks this note. Changes after this are addenda.") then the
   note is written with `status: "signed"`, `signedAt: request.time`, `signedBy` = the signer.
   The chart's `lastNote` updates in the same batch.
3. **Addendum:** on a signed note, **Add addendum** opens a text box. Saved addenda show under the
   note, each with author, role and time.

**Prescriptions:**

- **Add prescription** row: medication, dose and instructions, start date (defaults to visit
  date), renewal due (quick picks 30/60/90 days, or a date).
- **Current prescriptions** (chart summary and inside the editor) are computed from signed notes:
  each `start` is current until a later signed `stop` points at it; a `renew` replaces the
  renewal due date of what it renews. Pure function `currentPrescriptions(notes)` in
  `admin/prescriptions.js`.
- In the editor, each current prescription has **Renew** (adds a `renew` entry, new due date)
  and **Stop** (adds a `stop` entry, optional reason).

**Audit:** `sign_note`, `add_note_amendment`.

## 3. Staff page

**`/admin/staff`, `Staff.jsx`**, for admin and superAdmin.

- **List:** name, email, role, date added, from `user/*` (readable by `isStaff()`).
- **Add staff:** name, email, role (an admin's picker offers only Provider). Steps:
  1. Create the Auth account through a **second Firebase app instance** (`initializeApp(config,
     "staff-invite")`) with a random 32-character password, so the signed-in admin is not
     signed out.
  2. Write `user/{newUid}` with the primary (admin's) session.
  3. Send the password-reset email as the "set your password" invite; sign out and delete the
     second app instance.
  - If the email already has an account (`auth/email-already-in-use`, including a patient login),
    show: "This email already has an account. Ask Hyacinth to assign the role." The uid can't be
    looked up from the browser.
- **Change role / Remove access:** per row. Removing sets `role: ""`. Nobody can change their own
  role. Accounts are never deleted, so signed notes keep resolving to a name.
- **Audit:** `add_staff`, `change_staff_role`.

---

## Rules (`firestore.rules`)

Summary of the additions; the plan writes them in full.

- `role()` unchanged; `isStaff()` unchanged; add `isClinical()`.
- `intakeRecords`: `read` and status `update` move from `isStaff()` to `isClinical()`.
  `delete` stays superAdmin.
- `patients/{chartId}`:
  - `read`: `isClinical()`.
  - `create`: `isClinical()`, id equals an intake whose `getAfter` status is `admitted`, fields
    limited to the model, `admittedAt == request.time`, `admittedBy.uid == request.auth.uid`.
  - `update`: `isClinical()`, only `status`, `updatedAt`, `lastNote` change.
  - `delete`: never.
- `notes/{noteId}`:
  - `read`: `isClinical()` and (`status == "signed"` or author is me). List queries split into
    "signed" and "my drafts" so they satisfy the rule.
  - `create`: `isClinical()`, `status == "draft"`, author fields = me and my role,
    `createdAt == request.time`.
  - `update`: existing doc is a draft, author is me, author fields unchanged; signing allowed only
    with `signedAt == request.time` and `signedBy.uid == request.auth.uid`. No update once signed.
  - `delete`: draft, author is me.
- `amendments/{id}`: `create` by `isClinical()`, author = me, `at == request.time`, parent note
  signed. No update or delete.
- `user/{uid}`:
  - `read`: own doc, or `isStaff()`.
  - `write`: never own doc. superAdmin: any role. admin: only when the existing role is absent,
    `""` or `provider`, and the new role is `provider` or `""`.
- `auditLog`: unchanged rule; new action names allowed.
- `patientAccounts/{uid}`: today's `patients/{uid}` rule, moved.

## Demo mode

`usingSeedData` gains seed charts for the seed records with status `admitted`, each with a signed
consultation, a signed progress note with one addendum, and prescriptions (one due for renewal).
In demo mode, writes (new notes, signing, addenda, staff) apply to in-memory state for the
session, so the whole flow can be tried, and are lost on reload. Production builds can't reach
this branch (as today).

## Error handling

- Every write shows a clear failure in place ("Couldn't sign this note. Nothing was changed. Try
  again.") and leaves the editor open with its content.
- Autosave failure shows "Not saved" next to the draft status and retries on the next change.
- A note opened by a non-author while it's a draft can't happen (rules), so no UI for it.
- Permission errors from the rules show "Your role can't do this", not a raw code.

## Testing

- **`currentPrescriptions()`:** a small assert-based self-check (start, renew, stop, stop of a
  renewal, unsigned notes ignored), runnable with `node`.
- **Rules:** the Firebase emulator with `@firebase/rules-unit-testing` (new **dev** dependency)
  covering: provider can create notes but not staff; admin can grant only `provider`; nobody
  edits a signed note; addendum time can't be forged; chart create requires an admitted intake;
  drafts invisible to non-authors. *Decision for review: add this dev dependency, or test the
  rules by hand in the emulator.*
- **UI:** Playwright run in demo mode: admit → chart appears → write consultation with a
  prescription → sign → addendum → progress note renews it → current prescriptions correct;
  plus a phone-width pass.

## Files

New: `admin/Patients.jsx`, `admin/PatientChart.jsx`, `admin/NoteEditor.jsx`,
`admin/prescriptions.js`, `admin/Staff.jsx`, `admin/seedCharts.js`.
Changed: `admin/firebase.js`, `admin/AdminApp.jsx`, `admin/Sidebar.jsx`,
`admin/ApplicantModal.jsx`, `admin/Activity.jsx` (action labels), `lib/patientAuth.js`,
`firestore.rules`, `CLAUDE.md` (roles and collections).
