# Dietitian and exercise notes, Dietitian role, Calendar: design

2026-10-02. Builds on `2026-10-01-patient-charts-notes-staff-design.md` (charts, notes, roles).
Decisions are Louie's, made in conversation on 2026-10-02.

## Why

Dr. Antonious, client meeting 2026-09-29 (¶30–32): "whoever is doing the dietician services,
they can put their own little note. And then the exercise counselling can put their own little
note and then we can see what data was submitted", and "build a calendar tab… which patients I
have scheduled or which patients I have upcoming, what my schedule looks like."

## Scope

Two phases, one spec, each phase ends in a working admin:

1. **Phase 1:** Dietitian role · dietitian and exercise note types · chart changes · To-do per
   discipline.
2. **Phase 2:** appointments · Calendar page · booking from chart and Applicants · unbooked
   follow-up markers · appointment history.

**Out of scope:** an exercise role (none yet, no name chosen; providers write exercise notes
until it exists), patient self-booking, reminder emails (go with the client portal),
telemedicine (a video link field on appointments can come later), drag-to-move, Dashboard
changes.

## Constraints

- Program, never a storefront: medication appears only in consultation and progress notes,
  written by providers. Dietitian and exercise notes carry no prescriptions, enforced in rules.
- Appointments hold patient names and visit times: PHI. Same BAA blocker as intake records
  before real use.
- All times are Tampa time (`America/New_York`).
- No new dependencies. Dates via `Intl` and `Date`.
- Follow the existing admin: `chartStore.js` (Firestore + demo store), `chartMath.js` (pure
  helpers, `npm run check`), `roles.js`, `noteUi.jsx`, `NoteEditor.jsx`, `NoteView.jsx`,
  admin tokens and dark mode (`accent-text` for blue text).
- Hover = colour, never movement.

---

## Roles

New role `dietitian`, label "Dietitian".

| Capability | dietitian | provider | coAdmin | admin | superAdmin |
|---|---|---|---|---|---|
| Dashboard, To-do, Profile | ✓ | ✓ | ✓ | ✓ | ✓ |
| Applicants: view | ✓ | ✓ | ✓ | ✓ | ✓ |
| Applicants: admit, decline | | ✓ | ✓ | ✓ | ✓ |
| Patients and charts: view all note types | ✓ | ✓ | ✓ | ✓ | ✓ |
| Write and sign consultation, progress, exercise notes | | ✓ | ✓ | ✓ | ✓ |
| Write and sign dietitian notes | ✓ | | | ✓ | |
| Add addenda | dietitian notes only | ✓ | ✓ | ✓ | ✓ |
| Calendar: view, book, move, cancel, complete | ✓ | ✓ | ✓ | ✓ | ✓ |
| Appointment history | | | ✓ | ✓ | ✓ |
| Messages, Analytics, Staff | | | ✓ | ✓ | ✓ |
| Activity | | | | | ✓ |

The dietitian's page access was a placeholder Louie confirmed on 2026-10-02.

`roles.js`: `CLINICAL_ROLES` gains `dietitian`; `ROLE_LABELS.dietitian = "Dietitian"`;
`PAGE_ROLES.calendar = CLINICAL_ROLES`; `grantableRoles` for admin/coAdmin gains `dietitian`;
`ACTS_ON` for admin and coAdmin gains `dietitian`. New helpers:

```js
export const NOTE_WRITERS = {
  consultation: ["provider", "coAdmin", "admin", "superAdmin"],
  progress:     ["provider", "coAdmin", "admin", "superAdmin"],
  exercise:     ["provider", "coAdmin", "admin", "superAdmin"],
  dietitian:    ["dietitian", "admin"],
}
export const canWriteNote = (type, role) => NOTE_WRITERS[type]?.includes(role) ?? false
export const canAdmit = (role) => isClinicalRole(role) && role !== "dietitian"
export const canSeeAppointmentHistory = (role) => STAFF_ROLES.includes(role)
```

`getAdminRole()` in `admin/firebase.js` accepts `dietitian`.

---

## Phase 1

### Note types

Stored in the existing `patients/{chartId}/notes/{noteId}`. `type` becomes
`"consultation" | "progress" | "dietitian" | "exercise"`. Same lifecycle: draft (author only,
autosave) → sign (locked) → addenda.

New `sections` keys (strings, any may be empty): `dietHistory`, `goals`, `mealPlan`,
`activityLevel`, `limitations`. Existing keys keep their meaning. New optional field on
exercise notes:

```
exercisePlan   { daysPerWeek: 0–7 | null, intensity: "light" | "moderate" | "vigorous" | "",
                 minutesPerSession: 0–300 | null, kind: string, notes: string }
```

Dietitian and exercise notes: `prescriptions` is always `[]`; `vitals` uses `weightLb` only
(the others stay null).

**Fields by type** (`noteUi.jsx` holds the per-type config the editor and view read):

| Field | Dietitian | Exercise |
|---|---|---|
| Visit date (defaults to today) | ✓ | ✓ |
| Diet history / current eating pattern (`dietHistory`), prefilled from intake `nutrition` | ✓ | |
| Current activity level (`activityLevel`), prefilled from intake `socialHistory.exerciseFrequency` | | ✓ |
| Limitations and injuries (`limitations`) | | ✓ |
| Assessment | ✓ | |
| Exercise prescription (`exercisePlan`) | | ✓ |
| Goals | ✓ | ✓ |
| Meal plan and recommendations (`mealPlan`) | ✓ | |
| Weight (optional), change since last signed note of any type | ✓ | ✓ |
| Next follow-up | ✓ | ✓ |

Prefill for diet history joins the intake's `mealsPerDay`, `waterIntake`, estimated daily
calories and `dietNotes` into one editable paragraph, the way `historyFromIntake()` builds
pertinent history today.

### Chart page

- **New note** lists only `canWriteNote(type, role)` types.
- Note list filter: **All · Medical · Dietitian · Exercise** (Medical = consultation +
  progress). Each row shows type, author name and role, draft or signed.
- Summary gains:
  - **Current exercise plan:** `exercisePlan` from the latest signed exercise note.
  - **Next follow-ups:** one line per discipline from that discipline's latest signed note.
  - **Upcoming appointments** + **Book appointment** (Phase 2; hidden in Phase 1).
- Current prescriptions unchanged (medical notes only).
- Patients list "Last note" labels the new types. `lastNote.type` accepts all four.
- NoteView: dietitian sees **Add addendum** only on dietitian notes.

### To-do (`chartMath.dueTasks()`)

- Follow-ups per discipline: discipline of a note is `medical` (consultation, progress),
  `dietitian` or `exercise`. Each patient yields up to one follow-up task per discipline, from
  that discipline's latest signed note; due within 7 days or overdue.
- Renewals: medical only (unchanged). "No signed note yet": unchanged.
- Dietitian sees dietitian tasks by default, with a "Show all" switch. Others see all.
- Phase 2 adds: a follow-up with a matching appointment shows "Booked {date}" instead of
  "Due" (matching below).

### `chartMath.js` additions

```
disciplineOf(noteType)                    -> "medical" | "dietitian" | "exercise"
latestSignedByDiscipline(notes)           -> { medical?, dietitian?, exercise? }
currentExercisePlan(notes)                -> exercisePlan | null
nextFollowUps(notes)                      -> [{ discipline, date }]
```

---

## Phase 2

### Data: `appointments/{appointmentId}`

Top level, so one range query loads a week for everyone.

```
intakeId        string   intake record id (= chart id once admitted)
patientName     string   "First Last", copied at booking for display
staffUid        string   whose appointment it is
staffName       string
discipline      "medical" | "dietitian" | "exercise"
start           timestamp
minutes         15 | 30 | 45 | 60      default 30
status          "scheduled" | "completed" | "cancelled" | "noShow"
note            string   optional, short (≤ 500 chars); no clinical content expected
addedBy         { uid, name, role }
addedAt         timestamp   request.time
updatedAt       timestamp
lastChangeId    string   id of the changes entry written in the same batch (absent on create)
```

Because `intakeId` is the chart id, an appointment booked for an applicant belongs to the
chart the moment they are admitted. Nothing moves on admission.

### `appointments/{id}/changes/{changeId}` (append-only history)

```
kind     "moved" (time, length or staff) | "cancelled" | "completed" | "noShow" | "noteEdited"
from     { start?, minutes?, staffUid?, staffName?, status? }
to       { same keys }
reason   string   optional (cancel)
by       { uid, name, role }
at       timestamp   request.time
```

Every appointment update is one batch: the appointment write plus one `changes` entry.

### Calendar page (`/admin/calendar`, sidebar "Calendar", all clinical roles)

- **Week** (default on desktop): Monday–Sunday, 7am–7pm visible, scroll for the rest. Blocks
  coloured by discipline, show patient name and time. Cancelled hidden unless "Show
  cancelled" is on.
- **Month:** up to 3 per day, then "+N more" opening that day in Week view.
- **Agenda** (default on phone, < 640px): day-by-day upcoming list.
- Controls: Today, previous/next, view switch, staff filter **My schedule / Everyone / a staff
  member** (opens on My schedule).
- **Unbooked follow-up markers:** for each signed note's next follow-up (per discipline,
  latest note only) with no `scheduled` or `completed` appointment for that patient and
  discipline within ±3 days, a dashed "Follow-up due" marker on that day. Click → booking
  dialog prefilled with patient, discipline, date. Markers load from the charts the To-do page
  already reads.

### Booking dialog (`AppointmentDialog.jsx`)

Opened from Calendar (empty slot or New appointment), chart, Applicants row/modal, or a
follow-up marker.

- Fields: patient or applicant (search by name across intake records not declined),
  staff member (clinical staff list), date, start time (15-minute steps), length, discipline,
  note.
- Overlap with the same staff member's scheduled appointments: inline warning, not a block.
- Existing appointment: **Move** (time, length, staff), **Cancel** (confirm, optional reason),
  **Mark completed**, **No-show**. Completed/cancelled/no-show appointments are read-only.
- Footer: "Added by {name}, {role}, {time}".
- **History** list (co-admin, admin, super admin only): one line per change, e.g. "Moved from
  Oct 5, 10:00 to Oct 7, 2:00 PM, by {name}, {time}".

### Elsewhere

- Chart summary: next 3 upcoming appointments + Book appointment.
- Applicants: row action and modal button **Book appointment**; modal shows the next booked
  visit.
- To-do: "Booked {date}" matching as above.

### `chartMath.js` / new `calendarMath.js` additions

```
weekRange(date)                     -> { start, end }   Monday 00:00 to next Monday, Tampa time
monthGrid(date)                     -> 6×7 day cells
overlaps(appointment, others)       -> appointment[]
matchingAppointment(followUp, appts)-> appointment | null   same intakeId + discipline, ±3 days,
                                                            status scheduled or completed
unbookedFollowUps(charts, appts)    -> [{ intakeId, patientName, discipline, date }]
```

Audit actions: `book_appointment`, `move_appointment`, `cancel_appointment`,
`update_appointment_status`.

---

## Rules (`firestore.rules`)

- `isClinical()` gains `dietitian`.
- `canWriteType(type)`: dietitian notes `dietitian` or `admin`; others provider, coAdmin,
  admin, superAdmin.
- Intake status update (admit/decline): `isClinical() && role != 'dietitian'`. Chart create
  likewise.
- Staff: `dietitian` added to roles admin and coAdmin may grant and act on (`canActOn`,
  `isRoleChange`).
- Notes: `type in ['consultation','progress','dietitian','exercise']`; create and update
  require `canWriteType(resource type)`; dietitian and exercise notes require
  `prescriptions.size() == 0`; `exercisePlan`, when present, is a map with the keys above,
  `daysPerWeek` null or int 0–7, `minutesPerSession` null or int 0–300, `intensity` in the
  allowed list, strings bounded. `lastNote.type` accepts all four.
- Amendments: dietitian may create only on notes whose `type == 'dietitian'`.
- `appointments/{id}`:
  - read: `isClinical()`.
  - create: `isClinical()`, `addedBy.uid == request.auth.uid`, `addedAt == request.time`,
    `status == 'scheduled'`, valid `discipline` and `minutes`, `start` is a timestamp,
    strings bounded.
  - update: `isClinical()`; only `start`, `minutes`, `staffUid`, `staffName`, `status`,
    `note`, `updatedAt` change (`diff().affectedKeys().hasOnly`); `addedBy`/`addedAt`
    unchanged; a status of completed/cancelled/noShow can't change again; and
    `existsAfter` of a `changes` doc whose id is passed in the same batch
    (`changes/{request.resource.data.lastChangeId}`, so `lastChangeId` is also an allowed key).
  - delete: never.
- `appointments/{id}/changes/{changeId}`:
  - create: `isClinical()`, `by.uid == request.auth.uid`, `at == request.time`, valid `kind`.
  - read: `isStaff()` (co-admin and up).
  - update, delete: never.

Tests added to `tests/firestore.rules.test.js`: dietitian can't admit, can't sign a progress
note, can sign a dietitian note; admin can sign a dietitian note; provider can't create a
dietitian note; dietitian or exercise note with a prescription refused; exercise plan with
`daysPerWeek: 9` refused; dietitian addendum on a medical note refused; appointment create
with someone else's `addedBy` refused; appointment update without a changes doc refused;
appointment delete refused; provider can't read changes, co-admin can; changes can't be
edited. **Needs Java 21+; not runnable on this machine yet.**

---

## Demo mode

`seedCharts.js` gains a dietitian staff member, one signed dietitian note and one signed
exercise note on two patients, a dietitian follow-up due this week, and (Phase 2) a week of
appointments across disciplines with one move and one cancellation in their history, plus one
unbooked follow-up. The demo store mirrors the batch behaviour (appointment + change).

## Error handling

Same as notes: errors stay in the dialog, nothing is lost; permission errors read "Your role
can't do this." A failed booking or move leaves the dialog open with the values kept.

## Testing

- `npm run check`: asserts for `disciplineOf`, `latestSignedByDiscipline`,
  `currentExercisePlan`, per-discipline `dueTasks`, `weekRange` across a DST change,
  `overlaps`, `matchingAppointment` (±3 days edges, cancelled ignored), `unbookedFollowUps`.
- `npm run test:rules`: cases above (needs Java).
- `npm run lint`, `npm run build`.
- Browser pass in demo mode (Louie runs the dev server): dietitian login sees only dietitian
  "New note", can't admit; provider writes and signs an exercise note, chart shows the plan;
  To-do shows per-discipline follow-ups; Phase 2: book from a marker, move, cancel, history
  visible as admin and hidden as provider; week, month, agenda; phone width; dark mode.

## Files

Phase 1: `roles.js`, `firebase.js` (role, audit actions), `noteUi.jsx`, `NoteEditor.jsx`,
`NoteView.jsx`, `PatientChart.jsx`, `Patients.jsx`, `Todo.jsx`, `chartMath.js`,
`chartMath.check.js`, `chartStore.js`, `seedCharts.js`, `Staff.jsx`, `Applicants.jsx` /
`ApplicantModal.jsx` (hide admit/decline for dietitian), `firestore.rules`,
`tests/firestore.rules.test.js`.

Phase 2: new `Calendar.jsx`, `AppointmentDialog.jsx`, `appointmentStore.js`,
`calendarMath.js` (+ asserts in a `calendarMath.check.js` run by `npm run check`); edits to
`AdminApp.jsx` (route), `Sidebar.jsx`, `PatientChart.jsx`, `Applicants.jsx`,
`ApplicantModal.jsx`, `Todo.jsx`, `seedCharts.js`, `firestore.rules`, tests, `package.json`
(`check` runs both self-tests).
