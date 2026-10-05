# Client portal: Updates — design

2026-10-05. Decisions are Louie's, made in conversation the same day. First portal section
after the login (`docs/client-portal.md`, order Updates → Track progress → Messages).
Builds on the invite-only login (`2026-10-05-client-portal-login-design.md`,
`2026-10-05-portal-invites-emailjs-design.md`): a patient's login is linked to their intake
by `patientAccounts/{uid}.intakeId`, and the chart id is the intake id.

## What and why

Dr. Antonious asked (meeting ¶43–45) for patients to see what their care team is doing and
to get an email saying "check your portal". Updates are short dated messages from staff to
the patient, read in the portal.

Decisions:
- **Both sources:** staff write an update directly, and can share from a signed note.
- **Sharing a note = a pre-filled update staff edit first.** Nothing clinical goes out
  unread.
- **Email: a tick box, on by default.** The email never carries the update's text.
- **Author shown as name and role**, e.g. "From Sam Rivera, RD (Dietitian)".
- No edit after posting; **Remove** hides it from the patient and keeps it on the chart.

Out of scope: unread counts or "new" badges, patient replies (that's Messages),
attachments, scheduling, the chart's "Portal active" card change (parked by Louie until
after Updates).

## Constraints

- Updates are PHI: same BAA note as charts. EmailJS likely signs no BAA; the email holds
  no health details, only "you have a new update".
- Copy: "CorePhia", no em dashes in patient-facing text, plain words.
- No new dependencies. Admin tokens and dark mode; site tokens on `/account`; hover =
  colour only. Store pattern with the demo branch (`getDemoStore()`, `demoId()`).
- Reuse: `emailjs.js` (`sendEmail`, now with a template id argument), `escapeMessage`,
  `retryOnce` from `inviteMath.js`, `Modal`, `ConfirmDialog`, `noteUi` classes and
  `ROLE_LABELS`.

## Staff: the chart

**Updates card** on `PatientChart.jsx`, in the summary column under "Patient portal":
- Header "Updates" with **Post an update** (clinical roles, active chart only).
- The list, newest first: date and time, "{name} ({role label})", the message (line breaks
  kept), and "Email sent" / "Email not sent" / "Not emailed" in small text. Removed updates
  stay, greyed: "Removed by {name} on {date}". Shows the latest 5 with "Show all (n)".
- **Remove** on an update for its author or co-admin and up, behind a ConfirmDialog:
  "Remove this update? The patient won't see it any more. It stays on the chart as
  removed."
- Empty: "No updates yet. Updates you post here show in the patient's portal."

**Post dialog** (`Modal`, title "Post an update"):
- Message (textarea, 1–2000 characters, counter near the limit).
- "Email the patient that there's a new update", ticked by default. Disabled with "Email
  sending isn't set up yet." when the update template id is missing (still posts).
- Fixed note: "The patient sees your name and role. The email doesn't include the
  message."
- **Post update** / busy "Posting…". Errors inline; text kept.
- After posting: closes; the card reloads. If the email failed: the card's new update shows
  "Email not sent" and an inline line on the card: "Update posted, but the email
  didn't send." No retry button in this version; the patient still sees it on login.

**Sharing from a note:** the sign confirmation ("Sign this note?") gets a checkbox
"Then share an update with the patient" (unticked by default; hidden when the chart is
inactive). After a successful sign with it ticked, the Post dialog opens pre-filled:

| note type | prefill |
|---|---|
| consultation, progress | `sections.plan` |
| dietitian | `sections.goals`, a blank line, `sections.mealPlan` (blank parts skipped) |
| exercise | `exercisePlanLine(note.exercisePlan)`, then `sections` plan text if present |

Empty prefill → the dialog opens empty. The update records `fromNoteId` so the chart can
say "Shared from the Oct 5 progress note".

## Patient: the portal

`/account`, linked state: the **Updates** card becomes live (no "Coming soon"). Below the
four cards, an **Updates** section lists updates newest first:
- "Oct 5, 2026 · From Sam Rivera, RD (Dietitian)", then the message (line breaks kept,
  plain text, never HTML).
- Empty: "Updates from your care team will show up here."
- Load error: "We couldn't load your updates." with **Try again**.
- The Updates card links down to the section (`#updates`).

## Email

Second EmailJS template (Louie sets it up once; content in `docs/client-portal.md`):
To `{{to_email}}`, Subject `{{subject}}`, body "Your CorePhia care team posted an update.
Log in to your portal to read it." and a button **Open your portal** linking
`{{portal_link}}`. Sent params: `to_email`, `subject` ("You have a new update from
CorePhia"), `portal_link` (`${origin}/account`). Env: `VITE_EMAILJS_UPDATE_TEMPLATE_ID`.
`sendEmail(params, templateId)` takes the template; the invite keeps its own.

The email goes to the intake's `demographics.email` (same as the invite).

## Data

`patients/{chartId}/updates/{updateId}`:
```
{ body, author: { uid, name, role }, createdAt, email: 'none'|'sent'|'failed',
  fromNoteId: string|null, removed: false | { by: { uid, name }, at } }
```
`removed` is `false` on create so the patient's query can filter on it.

## Rules

- create: `isClinical()`, chart `status == 'active'`, exact keys, `body` string 1–2000,
  `author` = `{ uid: request.auth.uid, name: myName(), role: role() }`,
  `createdAt == request.time`, `email == 'none'`, `fromNoteId` null or string ≤ 200, `removed == false`.
- update, by `isClinical()`, one of:
  - email result: only `email` changes, from `'none'` to `'sent'` or `'failed'`, and only by
    the author;
  - remove: only `removed` changes, from `false` to `{ by: { uid: me, name: myName() },
    at: request.time }`, by the author or `isStaff()`.
- delete: false.
- read: `isClinical()`; or the signed-in patient whose
  `patientAccounts/{uid}.intakeId == chartId`, only when `resource.data.removed == false`
  (so their list query must filter `removed == false`).

## Code layout

- `src/admin/patients/updateStore.js`: `loadUpdates(chartId)`, `postUpdate({ chartId, to,
  body, fromNoteId, email }, actor)` → `{ update, emailed: 'none'|'sent'|'failed' }`,
  `removeUpdate(chartId, updateId, actor)`; demo branch.
- `src/admin/patients/UpdatesCard.jsx`, `PostUpdateDialog.jsx`.
- `src/admin/patients/chartMath.js`: `updatePrefill(note) → string` (pure; checked in
  `chartMath.check.js`).
- `NoteEditor.jsx`: the checkbox; `onSigned(note, { share })` so `PatientChart` opens the
  dialog with `updatePrefill`.
- `src/admin/lib/emailjs.js`: `sendEmail(params, templateId = TEMPLATE_ID)`,
  `updateEmailConfigured`.
- `src/admin/staff/roles.js`: `canRemoveUpdate(update, actor)`.
- `src/lib/patientAuth.js`: `getMyUpdates(intakeId)`; `src/pages/Account.jsx`: the section.

## Testing

- `npm run test:rules`: create (good; inactive chart; wrong author; long body; removed not
  false; patient can't), email update (author none→sent ok; other field refused; sent→failed
  refused; non-author refused), remove (author ok; co-admin ok; other provider refused;
  un-remove refused), patient read (own chart's live update ok; removed refused; other
  chart refused; list with `removed == false` ok), delete refused.
- `npm run check`: `updatePrefill` for each note type and blanks.
- Browser (Playwright, stubs as before): chart card + dialog (post, email failed line,
  remove, share-after-sign prefill), both admin themes; `/account` updates list, empty,
  error, 390 px.
