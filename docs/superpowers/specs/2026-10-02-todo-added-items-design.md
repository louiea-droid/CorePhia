# To-do: items staff add themselves — design

2026-10-02. Decisions are Louie's, made in conversation the same day. Builds on the To-do page
(`src/admin/patients/Todo.jsx`), which today lists only automatic items (renewals, follow-ups,
first consultations) worked out from signed notes.

## What and why

Staff can add their own to-dos and notes ("Call the pharmacy about Riley's refill", "Order more
scales") on the To-do page, next to the automatic items.

Decisions:
- **Visibility per item:** "Just me" or "Everyone", chosen when adding.
- **Optional patient link:** an item can name a patient (or applicant); it then shows their name
  and opens their chart.
- **Ticking off moves an item to Done**, showing who ticked it and when, with Undo. Nothing is
  deleted. Done items older than 30 days are hidden from the page, not removed.

Out of scope: reminder emails, assigning to a specific person, repeating tasks.

## Constraints

- Items can mention patients: PHI, same BAA note as charts and appointments.
- No new dependencies. Admin tokens, dark mode, hover = colour only.
- Follow the existing store pattern (`appointmentStore.js`): Firestore functions with an
  in-memory demo branch using `getDemoStore()` / `demoId()` from `chartStore.js`.

## Page

An **Add a to-do** card at the top of the To-do page, then an **Added to-dos** card, then the
automatic list exactly as today (automatic items keep no tick box: signing the right note is
what clears them).

**Add a to-do:** text (required, up to 500 characters), patient (optional, searchable, same
search as the booking dialog), due date (optional, DatePicker), visible to **Just me /
Everyone** (default Just me), **Add** button. Enter in the text field adds.

**Added to-dos**, grouped: Overdue, Today, Next 7 days, Later, No date (open items), then
**Done** (collapsed by default, last 30 days, newest first). Each row: tick box, text, patient
link (to `/admin/patients/{intakeId}` when admitted; plain name for an applicant), due date,
"Just me" or "Everyone", and on shared items "Added by {name}". Done rows show "Done by {name},
{date}" and **Undo**. The author sees **Edit** on their own open items (text, patient, due,
visibility in place). Empty state: "Nothing added yet. Add a to-do above."

The dietitian's "Dietitian / Everything" switch filters only the automatic list.

## Data: `todos/{todoId}`

```
text          string, 1–500 chars
intakeId      string | ""       linked patient or applicant (intake record id)
patientName   string            copied at save, for display ("" when none)
due           "YYYY-MM-DD" | ""
visibility    "me" | "everyone"
ownerUid      string            who added it
ownerName     string
createdAt     timestamp         request.time
updatedAt     timestamp         request.time
done          { uid, name, at } | null
```

Queries: `where("ownerUid", "==", me)` and `where("visibility", "==", "everyone")`, merged.

## Rules

- read: `isClinical()` and (`visibility == 'everyone'` or `ownerUid == request.auth.uid`).
- create: `isClinical()`, exact keys, `ownerUid == auth.uid`, `ownerName == myName()`,
  `createdAt == updatedAt == request.time`, `done == null`, text 1–500, visibility in the two
  values, due empty or `YYYY-MM-DD`, patientName ≤ 200.
- update, content (author only): changes only `text`, `intakeId`, `patientName`, `due`,
  `visibility`, `updatedAt`; same field checks; `updatedAt == request.time`.
- update, tick (anyone who can read it): changes only `done` and `updatedAt`; `done` is null
  (Undo) or `{ uid == auth.uid, name == myName(), at == request.time }`.
- delete: never.

Tests in `tests/firestore.rules.test.js`: private items unreadable by others; shared items
readable by any clinician, not by no-role users; create must name yourself at server time;
others can't edit your text; anyone can tick a shared item but only as themselves; can't tick a
private item that isn't theirs; Undo works; delete refused.

## Code

- `src/admin/patients/todoStore.js`: `loadTodos(uid)`, `addTodo(fields, actor)`,
  `editTodo(todo, fields)`, `setTodoDone(todo, done, actor)`; demo branch.
- `src/admin/patients/todoMath.js` (+ `todoMath.check.js` in `npm run check`):
  `groupTodos(todos, today)` → `{ overdue, today, week, later, undated, done }`, done limited to
  30 days and newest first.
- `src/admin/patients/AddTodo.jsx`, `src/admin/patients/AddedTodos.jsx`; `Todo.jsx` renders both
  above the automatic list.
- Seed: a few demo items (private and shared, one with a patient, one done).
- Browser check in demo mode at 1280 and 375, light and dark.
