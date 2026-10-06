# Client portal: Track progress — design

2026-10-06. Decisions are Louie's, made in conversation the same day. Second portal
section, after Updates (`docs/client-portal.md`, order Updates → Track progress →
Messages). Builds on the invite-only login: a patient's login is linked to their chart by
`patientAccounts/{uid}.intakeId`, and the chart id is the intake id.

## What and why

Dr. Antonious asked (meeting ¶43–45) for patients to see "the weight loss and all those
metrics that you guys are monitoring". The portal doc's plan also had patients logging
their own weight. Louie chose both.

Decisions:
- **Both sources on one chart:** weights from visits (signed notes) and weights the
  patient logs at home, marked differently.
- **Metrics:** weight, plus blood pressure and heart rate from visits. Patients log weight
  only.
- **Visit numbers are shared automatically** when a note is signed: only the visit date,
  weight, BP and heart rate, nothing else from the note.
- **Home entries:** the patient can delete their own, not edit. A deleted entry is hidden
  from the patient and stays on the chart for staff, marked deleted.
- Weight range 50–800 lbs; a home entry's date is today or up to 30 days back.
- Starting weight, goal weight and height come from the intake.
- Staff see the same chart on the patient's chart page.

Out of scope: emails or alerts when a patient logs a weight, home BP or heart rate,
editing entries, staff editing the goal, back-filling progress from notes signed before
this ships (only test charts exist), units other than lbs.

## Constraints

- Progress entries are PHI: same BAA note as charts and updates.
- Patient copy: "CorePhia", no em dashes, plain words, neutral about weight change
  (no celebration or alarm wording). Nothing about medication.
- No new dependencies. The chart is a plain SVG.
- Admin tokens and dark mode on the chart page; site tokens on `/account`. Hover = colour
  only.
- Store pattern with the demo branch (`getDemoStore()`, `demoId()`) on the staff side.

## Data

All under `patients/{chartId}/progress/{entryId}`.

**Visit entry**, id `visit-{noteId}`:
```
{ source: 'visit', date: 'YYYY-MM-DD', weightLb, systolic, diastolic, heartRate,
  noteId, createdAt, removed: false }
```
Numbers are the note's `vitals` values (number or null), `date` is the note's
`visitDate`. Written only when at least one of the four is set.

**Home entry**, random id:
```
{ source: 'home', date: 'YYYY-MM-DD', weightLb, createdAt, removed: false }
```
`removed` becomes the server time when the patient deletes it.

**Baseline**, id `baseline`:
```
{ source: 'baseline', heightFeet, heightInches, currentWeightLb, goalWeightLb,
  removed: false }
```
The intake's own `vitals` strings, copied as they are (empty string when missing; the
intake may only have a goal range). Converted to numbers by `progressMath`.

## Rules

Inside `match /patients/{chartId}`, a `match /progress/{entryId}` block:

- **Visit create** (`isClinical()`): id is `'visit-' + noteId`; exact keys; `createdAt ==
  request.time`; `removed == false`; `getAfter` of the note shows `status == 'signed'`; each
  number equals the note's `vitals` value (`get(key, null)`); `date == note.visitDate`. So
  it can only be written in the signing batch, with the note's own numbers.
- **Home create:** signed in; `get(patientAccounts/{uid}).data.intakeId == chartId`; exact
  keys; `weightLb` a number 50–800; `date` matches `^\d{4}-\d{2}-\d{2}$` and, as
  `timestamp.date(y, m, d)` from its parts, is no later than `request.time + 1 day` and no
  earlier than `request.time - 31 days` (a day of slack each way for time zones);
  `createdAt == request.time`; `removed == false`.
- **Home delete:** the linked patient; only `removed` changes, from `false` to
  `request.time`; only on `source == 'home'`.
- **Baseline create** (`isClinical()`): id `baseline`; exact keys; each value equals the
  intake's `vitals.get(key, '')`. Never updated.
- **Read:** `isClinical()`; or the linked patient when `resource.data.removed == false`
  (so their query must filter `removed == false`). The baseline has `removed: false` too,
  so the patient's one query returns it.
- No other update; delete is false for everyone.

## Staff: the chart

**Signing** (`chartStore.signNote`): when the note's vitals have any of the four numbers,
the batch also sets `progress/visit-{noteId}`. The sign confirmation gains one line when
the note has any: "The weight, blood pressure and heart rate also go to the patient's
progress." Demo branch mirrors it.

**Baseline:** when a chart page loads and `progress/baseline` doesn't exist, it is written
from the intake (silently; a failure is logged, never shown). Covers charts admitted or
linked before this shipped.

**Progress card** on `PatientChart.jsx`, summary column, under Updates. All clinical roles.
- Headline numbers: starting weight, latest weight, lost so far, to goal, latest BMI. Any
  that can't be worked out is left out.
- The weight chart (below).
- "Show all entries": dated list, newest first. Visit: weight, BP, heart rate, "From the
  {date} {note type}". Home: weight, "Logged at home". Deleted home entries greyed:
  "Deleted by patient on {date}".
- Empty: "No weights yet. Weights from signed notes and the patient's own weigh-ins show
  here."
- Load error: "Couldn't load progress."

## Patient: the portal

`/account`, linked state: a **Track progress** box at the top of the main column, above
Updates. Track progress comes off `COMING_SOON`.
- Headline: current weight; "Down 12 lbs since you started" / "Up 2 lbs since you
  started" / "Same as when you started"; "18 lbs to your goal" (or "You've reached your
  goal weight" when at or below it). Left out when not computable.
- The weight chart.
- **Log your weight**: opens an inline form: weight (lbs, number) and date (default
  today, min today − 30 days, max today). Save / busy "Saving…". Out of range: "Check the
  number. Weights between 50 and 800 lbs can be saved." Save error: "Couldn't save your
  weigh-in. Try again." Value kept on error. After saving the box reloads.
- **Your weigh-ins**: home entries, newest first, each with Delete behind a confirm:
  "Delete this weigh-in? Your care team will still see that it was deleted."
- **From your visits**: date, weight, BP, heart rate. Read-only.
- Empty: "Your weight from each visit will show here. You can also log your own
  weigh-ins."
- Load error: "We couldn't load your progress." with Try again.

## The weight chart

`src/components/WeightChart.jsx`, used by both sides. Plain SVG, responsive width.
- One line through all live weights in date order.
- Visit points solid; home points hollow. Key: "Visit" / "Logged at home".
- Goal weight as a dashed horizontal line, labelled, when known.
- Each point is focusable; hover or focus shows date, weight and source. A visually hidden
  table lists the same points for screen readers.
- Colours from tokens (`accent-dark` line and points) so it follows each side's theme.
- One point: a dot, no line. None: the box's empty state instead of a chart.
- Load the `dataviz` skill when building it.

## Code layout

- `src/lib/progressMath.js` (pure; `progressMath.check.js` in `npm run check`):
  `toNumbers(baseline)` → `{ startWeightLb, goalWeightLb, heightIn }` (nulls when missing);
  `series(entries)` → live weights sorted by date, then `createdAt`;
  `summary(entries, baseline)` → `{ latestLb, startLb, changeLb, toGoalLb, bmi }` where
  start is the baseline weight, else the earliest entry; `visitEntryFor(note)` → the visit
  entry fields or `null` when no vitals.
- `src/components/WeightChart.jsx`.
- `src/admin/patients/progressStore.js`: `loadProgress(chartId)`,
  `ensureBaseline(chartId, intake)`; `chartStore.signNote` adds the visit entry using
  `visitEntryFor`.
- `src/admin/patients/ProgressCard.jsx`; `PatientChart.jsx` mounts it and calls
  `ensureBaseline`; `NoteEditor.jsx` the extra confirmation line.
- `src/portal/lib/patientAuth.js`: `getMyProgress(intakeId)`, `logWeight(intakeId, { date,
  weightLb })`, `deleteWeighIn(intakeId, entryId)`.
- `src/portal/progress/PortalProgress.jsx`, `LogWeightForm.jsx`; `PortalHome.jsx` mounts
  it and drops Track progress from `COMING_SOON`.

## Testing

- `npm run test:rules`: visit create (in the signing batch ok; numbers not matching the
  note refused; on an unsigned note refused; by a patient refused); home create (linked
  patient ok; other chart refused; 49 and 801 refused; date 32 days back refused; future
  date refused; staff creating a home entry refused); home delete (own ok; second delete
  refused; on a visit entry refused; changing weight refused); baseline (matching intake
  ok; mismatch refused; update refused); reads (patient live ok; removed refused; other
  chart refused; list with `removed == false` ok; staff read all).
- `npm run check`: `progressMath` for each function, including no baseline, string inputs,
  a goal range only, one entry, deleted entries ignored.
- Browser (Playwright, stubs as before): chart card (entries, deleted greyed, empty, sign
  line), both admin themes; `/account` box (log ok, out of range, delete confirm, empty,
  error, 390 px).
