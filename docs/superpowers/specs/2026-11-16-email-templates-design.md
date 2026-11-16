# Email templates and decision emails (design, 2026-11-16)

Approved mockup: `email-editor-v3-mockup.html` (session scratchpad, 2026-11-16; the screens
described below are the source of truth if it is gone).

## Why

Today nothing tells a patient they were accepted or declined: Admit and Decline on Applicants
only change a status (since the Elation move, 2026-11-13). Patients wait in silence, and a
declined patient hears nothing at all. Louie wants the patient emailed automatically when staff
decide, and wants the wording of every patient email editable in the admin, without a developer,
with formatting, several templates per purpose, and a history of changes.

## Goals

- Admit and Decline each send the patient an email, after a confirm step.
- Staff can send a one-off "New email" to an applicant from the applicant record.
- An **Email templates** admin page where the admin and super admin write and edit every
  patient email: subject, headline, a formatted message, what the template is used for, and
  whether it is a draft, published, or the default for its purpose.
- Basic formatting: bold, italic, underline, bulleted and numbered lists, links, clear
  formatting, undo/redo, and a first-name placeholder.
- History: every save is kept; compare any version with the live one; restore an old version.
- The existing Welcome receipt reads its wording from the default Welcome template.

## Non-goals

- No colours, fonts or sizes in the editor. Every email keeps the CorePhia layout
  (`layout()` in `functions/emails.js`).
- The staff "new form" alert to `providermd@` stays in code (staff only, not a patient email).
- No emails after admission beyond these: Elation sends portal invites and everything else.
- No bulk or scheduled sending.

## Anti-goals (a failure even if it works)

- A patient gets an email by accident: a misclick, a double click, or a status switched back
  and forth. Each decision email goes out once per intake and kind, and only after a confirm.
- An email carries health information. Templates hold no intake answers; the only patient value
  inserted is the first name. The editor warns staff to keep emails general.
- An email reads as pay-for-medication (CLAUDE.md, the compliance boundary). The editor shows
  the same warning; this is policy, not something the code can check.
- A template edit breaks sending. If a template is missing or unreadable the send fails with a
  clear error in the admin (decisions), or falls back to the built-in wording (Welcome).

## Decisions

**People and permissions**
- Edit, publish, delete, restore templates: `admin` and `superAdmin` only. Other staff who can
  open the page see it read only, with no buttons. (Who can open it: every role that can admit,
  i.e. `isAdmitter()`, since they pick templates when deciding.)
- Send decision and New emails: admitters (`isAdmitter()`), same as Admit/Decline today.
- Every template save, restore, delete and every email sent is an audit event
  (`AUDIT_ACTIONS`, the rules list and `ACTION_LABELS` in `Activity.jsx`, kept in step;
  `npm run check` covers the first two).

**Template**
- Fields: name (staff only), used for (`accepted` | `declined` | `welcome` | `manual`, shown as
  Accepted, Declined, Welcome, New email), status (`draft` | `published`), `isDefault`, subject,
  headline, body (TipTap JSON), updated by and at.
- One default per purpose. Making a template the default clears the previous one (done in a
  transaction / batch). Drafts are never sent and never offered in pickers.
- Deleting the default is refused until another template is made default (except `manual`,
  which has no default).
- `{firstName}` is a TipTap inline node (shown as a chip, inserted with "+ First name");
  headline and subject accept the literal `{firstName}` text.
- Fixed parts added on send, not editable: the contact line (phone and care@), the privacy note,
  and the Google Workspace footer (added by Gmail as today).
- Links: only `https://corephia.com/...` and Elation (`https://*.elationemr.com`,
  `https://*.elationpassport.com`). Enforced in the editor and again on the server when
  rendering (a disallowed link renders as plain text).

**History**
- Each save writes a new version document; versions are never edited or deleted (rules:
  create only). Restore copies an old version into the template as a new save.
- Compare shows a word-level diff of the plain text, plus notes for formatting-only changes.
  `ponytail:` text diff, not a structural one; enough for short emails.

**Sending**
- One callable function `sendPatientEmail({ intakeId, templateId, mode })`:
  - `mode: "decision"`: checks the caller is an admitter, the template is published and its
    purpose matches, the intake has a valid email, and no email of that purpose was already
    sent for this intake. Sends, then writes `patientEmails.{accepted|declined}: { templateId,
    sentAt, sentBy }` on the intake. Status is set by the same function (so the email and the
    status change cannot drift apart).
  - `mode: "manual"`: a `manual` template; appends to `patientEmails.manual` (a list, capped).
  - `mode: "test"`: renders any template (drafts included) with the sample name and sends it to
    the caller's own sign-in email. Admin and super admin only.
- `notifyNewIntake` keeps sending the Welcome receipt, reading the default `welcome` template;
  if none is readable it uses today's wording in `emails.js`.
- Rendering lives in `functions/` (a small walker over the allowed TipTap nodes into the
  existing table layout, with HTML escaping), and the same walker renders the admin preview so
  they match. The plain-text part is generated from the same tree.

**Applicants**
- Pending and Discharge keep saving on one click (no email).
- Admit and Decline open a confirm dialog: the recipient address, the published templates for
  that purpose with the default selected, a Preview link, Cancel focused first, then
  "Admit and send email" / "Decline and send email" (red).
- If that decision email was already sent, the dialog says so and only changes the status.
- No valid email on the intake: the dialog says so and offers to change the status without an
  email.
- The record shows "Acceptance email sent Nov 16, 2:14 PM" (or decline / New email list).
- A "Send email" button on the record opens the same dialog with `manual` templates.

**Admin page**
- Sidebar: "Email templates", in the website group.
- Layout as in the mockup: list on the left (search, grouped by purpose with counts, status
  dots), editor in the middle (name heading, default badge, History, ⋯ menu with Duplicate and
  Delete, Used for and Status pop-up selects, subject, headline, formatted message, the fixed
  parts note, the compliance warning, sticky Discard / Save changes bar), preview on the right
  (Desktop / Phone switch, inbox-style header, Send me a test).
- Leaving with unsaved changes asks first.
- Help page: a topic for Email templates and for the decision emails.

**Sending order and failures** (builder's call, recorded)
- The function claims the send in a transaction (`patientEmails.<kind>.state: "sending"`), sends,
  then marks it `sent` and sets the status. If SMTP fails it clears the claim, leaves the status
  unchanged and returns an error; the dialog shows it with "Try again" and "Change status
  without email". A crash between send and mark could, rarely, allow one duplicate on retry;
  accepted over a patient marked "sent" who got nothing.
- The acceptance email does not wait for Elation. Staff send the Passport invite from Elation;
  Phase B (`sendToElation`) can later be called from the same function after the email.

**Only one decision email per intake** (Louie, 2026-11-16)
- Once an acceptance or decline email has been sent for an intake, the other one can never be
  sent for it. The status can still change. The dialog says, for example: "Jane Doe already
  received the acceptance email on Nov 16. Contact them directly to explain the change." and
  offers only "Change status". The function enforces it too (checks both kinds before claiming).

**Applicants decided before this ships** (builder's call, recorded)
- No backlog emails. A record with no `patientEmails` behaves as never emailed: pressing the
  status it already has does nothing; pressing the other decision opens the normal dialog.

**Starting content**
Seeded on first deploy (or created on first open if missing), each the default for its purpose.
The Declined wording still needs Dr. Antonious's approval before real patients.

- **Accepted, "Welcome aboard"**. Subject: *Welcome to the CorePhia program*. Headline:
  *Welcome aboard, {firstName}*. Body:
  We're happy to let you know that our provider has reviewed your form, and you've been accepted
  into the CorePhia program. / **What happens next:** you'll get an email from Elation, the
  secure patient portal we use, inviting you to create your account. Once you're set up, you can
  book your first visit and message your care team directly. If it hasn't arrived in a few days,
  check your spam folder or give us a call. / Your membership begins when our team activates it,
  and that's when the card you added is first charged. / We're looking forward to working with
  you.
- **Declined, "Not the right fit"**. Subject: *An update on your CorePhia form*. Headline:
  *Thank you, {firstName}*. Body:
  Thank you for taking the time to fill out our form and for considering CorePhia. / Our
  provider has carefully reviewed your answers, and we aren't able to offer you a place in the
  program right now. We know that may be disappointing to hear. It isn't a judgment of you or
  your goals, only that our program may not be the best way to support you at this time. /
  **Your card has not been charged, and it won't be.** / Your primary care doctor is a good next
  step. They know your health history and can talk with you about options that may be a better
  fit. / If you have questions about this decision, or your situation changes, we'd be glad to
  hear from you.
- **Welcome, "Welcome to CorePhia"**: today's receipt wording from `functions/emails.js`
  (`intakeReceipt`), headline *Welcome to CorePhia!*.
- The fixed contact line ("Questions? Call us at … or email care@corephia.com.") and privacy
  note are appended on send, so the bodies above leave them out.

## Approaches considered

- **Editor:** TipTap (chosen: only the allowed formats exist, paste is cleaned, stored as JSON so
  the server never trusts staff HTML; ~50 KB, loaded only on this page) vs the browser's own
  `contentEditable` with `execCommand` (no dependency, but deprecated, inconsistent between
  browsers, and pasted HTML would need sanitising on every send).
- **Sending:** one callable function (chosen: server-side role check, once-only guard, one path
  for decision, manual and test emails) vs a Firestore trigger on the status change (fine for
  Admit/Decline but needs separate paths for manual and test, and the template choice would
  have to travel through the intake, loosening its rules).

## Constraints

- Firestore rules must cover `emailTemplates/{id}` and `emailTemplates/{id}/versions/{v}`, the
  new intake field `patientEmails` (written only by the function; clients may not write it),
  and the new audit actions. Add tests to `tests/firestore.rules.test.js`.
- Functions deploy checks every `defineSecret`; `SMTP_PASSWORD` is the only one.
- The callable is `us-central1`, like `notifyNewIntake`.
- Privacy policy and the HIPAA notice describe what the system emails; add the decision and
  manual emails there (`pages/Legal.jsx`).
- Admin UI conventions in CLAUDE.md apply (dialogs via `useDialog`, `formUi.js`, dark mode
  `accent-text`, hover = colour only).

## Left to the builder

- Exact TipTap packages (StarterKit trimmed, Underline, Link, a custom first-name node).
- Where the shared renderer lives so both the admin and `functions/` import it (a small shared
  file copied at build, or the admin calls the function to preview).
- Cap on `patientEmails.manual` and on version count shown.
- Help text wording.
