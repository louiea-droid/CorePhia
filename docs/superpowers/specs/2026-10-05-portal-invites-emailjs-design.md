# Client portal: invites by EmailJS, portal setup, forgot password — design

2026-10-05. Decisions are Louie's, made in conversation the same day. Supersedes the
admin, invite and "Later: Cloud Function" parts of
`2026-10-05-client-portal-login-design.md`. Its patient side is built (portal page, sign-in
only, `patientAccounts` link, rules). Read that first.

## What and why

Staff invite an admitted patient from their chart. The patient gets **one email**, sent
by EmailJS, with staff's welcome message and a **Set up your portal** link. On that page
they choose a password, and their login is created and linked to their intake. A patient
who forgets their password later gets Firebase's reset email, restyled for CorePhia,
which opens a CorePhia page to choose a new one.

Decisions:
- **Sending: EmailJS from the admin's browser.** No Cloud Function, no Blaze plan.
- **Invites are manual:** "Send portal invite" on the chart, "Resend invite" after.
- **The message is editable** per invite, from a saved default template.
- **Forgot password: option A.** Firebase's own reset email (it alone can make the reset
  link), with the wording, sender and link customised in the Firebase console, landing on
  a CorePhia `/portal/reset` page. Not EmailJS: that would need a server.
- No EmailJS account yet: build against `VITE_EMAILJS_*` placeholders.

Out of scope: the portal sections (Updates is next), automatic invites on admit,
invite usage tracking ("opened", "used").

## Constraints

- Invites name patients: PHI, same BAA note as charts. EmailJS likely signs no BAA and an
  invite reveals a patient relationship: **flagged, not solved; decide before real
  patients get invites.**
- The EmailJS public key ships in the admin bundle; anyone with it could send our
  template to any address. Mitigation in the EmailJS dashboard: allowed origins
  (`corephia.com`, `localhost`) and its rate limit. Recorded in `docs/client-portal.md`.
- Emails carry no health details. Copy: "CorePhia", no em dashes, no provider name.
- No new dependencies: EmailJS's REST endpoint with `fetch`, not `@emailjs/browser`.
- Admin tokens, dark mode, hover = colour only. Store pattern with the demo branch
  (`getDemoStore()` / `demoId()` in `chartStore.js`).

## Admin: invite from the chart

**Portal access box** on `PatientChart.jsx`, near the chart header:
- The intake email the invite goes to (`demographics.email`), read-only. No email on the
  record: "No email on this intake" and no button.
- Status, from the newest invite and the link doc:
  - "Not invited"
  - "Sending…" / "Not sent. Try again." (newest is `ready` or `failed`; failed shows the error)
  - "Invite sent Oct 5 by Louie · link works until Oct 12" (newest is `sent`)
  - "Invite expired Oct 12" (newest `sent` is past 7 days)
  - "Portal active" (a `patientAccounts` doc has this `intakeId`)
- **Send portal invite**, or **Resend invite** once any invite exists. Roles that can admit
  (`isAdmitter`); inactive charts show status only. "Portal active" still shows Resend
  (harmless: the link page says "you're already set up").
- "Earlier invites": date, who, status for each.

**Compose dialog** (the Staff page's dialog pattern, `ui/Modal.jsx`):
- To (read-only), Subject (1–200), Message (1–5000), prefilled from the template with
  `{firstName}` and `{phone}` filled in.
- Fixed note: "A secure Set up your portal button is added below your message."
- "Save as the default template" checkbox, co-admin and up.
- **Send invite** / Cancel. Errors inline; the dialog stays open with the text kept.
- If the `VITE_EMAILJS_*` values are missing: the button is disabled and the dialog says
  "Email sending isn't set up yet." Demo mode (no Firebase) fakes a successful send.

**Default template** (no `settings/portalInvite` doc yet):

> **Subject:** Set up your CorePhia patient portal
>
> Hi {firstName},
>
> Your CorePhia patient portal is ready. Use the button below to choose a password and
> sign in. This is where you'll find updates from your care team.
>
> Questions? Call us at {phone} or email info@corephia.com.

**Send sequence** (`portalStore.sendInvite`):
1. Make `inviteId`: 16 random bytes from `crypto.getRandomValues`, hex (32 chars).
2. `setDoc(patients/{chartId}/invites/{inviteId})` with `status: 'ready'`.
3. `fetch("https://api.emailjs.com/api/v1.0/email/send", POST JSON)` with
   `{ service_id, template_id, user_id: publicKey, template_params: { to_email, subject,
   message_html, setup_link } }`. `message_html` is the message HTML-escaped with line
   breaks turned into `<br>`, so staff text can never inject markup. `setup_link` =
   `${location.origin}/portal/setup?c={chartId}&i={inviteId}`.
4. OK → `updateDoc` to `status: 'sent', sentAt: serverTimestamp()`.
   Not OK or network error → `status: 'failed', error: <first 300 chars>`; the dialog
   shows "The email didn't send: <error>".
A tab closed between 2 and 4 leaves `ready`; the box shows "Not sent. Try again."

**EmailJS template** (set up once in the EmailJS dashboard; documented in
`docs/client-portal.md`): To `{{to_email}}`, Subject `{{subject}}`, body `{{{message_html}}}` (triple
braces: already escaped HTML) then a button linking `{{setup_link}}`, then the footer
"CorePhia Health · Tampa, Florida".

## Patient: `/portal/setup`

Route `/portal/setup` (lazy, like `/account`; noindex). Reads `c` and `i` from the query.

1. `getDoc(patients/{c}/invites/{i})`. Not found, not `sent`, or past 7 days →
   "This invite link has expired or isn't valid. Contact us and we'll send a new one."
   with phone and email.
2. Valid → "Set up your portal" · "Hi {firstName}. Choose a password for {to}." ·
   Password + Confirm password (min 8, must match, show/hide toggle as in `LoginPanel`) ·
   **Create my login**.
3. Submit → `createUserWithEmailAndPassword(to, password)` → `setDoc(patientAccounts/{uid},
   { email: to, intakeId: c, firstName, inviteId: i, linkedAt: serverTimestamp() })` →
   navigate `/account`.
4. `auth/email-already-in-use` → the form switches to "You already have a login with this
   email. Enter your password to connect it." · Password · **Log in and connect** →
   `signInWithEmailAndPassword` → same `setDoc` (skipped if `getMyPortalLink` already
   returns a link) → `/account`. "Forgot password?" link opens the reset request.
5. Already signed in as this email and linked → "You're already set up" + **Open your
   portal**. Signed in as a different email → "You're signed in as {other}. Log out to
   set up this invite." + Log out.
6. Link write refused (expired between load and submit) → the expired message.

## Forgot password (option A)

**Login panel:** a "Forgot password?" link under the password field switches the panel
to: Email · **Send reset link** · "Back to log in". After sending, always: "If that email
has a portal login, we've sent a link to reset your password." (no account probing). Uses
the existing `resetPatientPassword(email)`, now passing
`{ url: location.origin + "/account" }` as the continue URL.

**`/portal/reset`** (lazy, noindex), handling Firebase's `?mode=resetPassword&oobCode=…
&continueUrl=…`:
- `verifyPasswordResetCode` → "Choose a new password for {email}" · New password +
  Confirm (min 8) · **Save password** → `confirmPasswordReset` → "Password changed." +
  **Continue** to `continueUrl` when it is on this site, else `/account`.
- Bad or used code → "This reset link has expired or was already used." + **Send a new
  link** (opens the login panel's reset view).
- Any other `mode` → the same expired message (verify-email isn't used).

**Staff share it.** The action URL is set per project, so staff invites (`addStaff`) and
the admin's own reset (`admin/lib/firebase.js:107`) land here too. Both pass a continue
URL of `location.origin + "/admin"`, so staff continue to the admin after saving.

**Firebase console, done once by Louie** (steps go in `docs/client-portal.md`):
Authentication → Templates → Password reset → edit sender name ("CorePhia"), subject
("Reset your CorePhia password"), message, reply-to `info@corephia.com`, and **Customize
action URL** → `https://corephia.com/portal/reset`. Optional: SMTP settings so it sends
from `info@corephia.com`. Until the action URL is set, Firebase's own page still works.

## Data

- `patients/{chartId}/invites/{inviteId}`:
  `{ to, firstName, subject, message, status: 'ready'|'sent'|'failed', createdBy:
  { uid, name }, createdAt, sentAt?, error? }`. `to` is stored lowercased.
- `settings/portalInvite`: `{ subject, message, updatedBy: { uid, name }, updatedAt }`.
- `patientAccounts/{uid}`: `{ email, intakeId, firstName, inviteId, linkedAt }`
  (`inviteId` added; console-made test docs without it still read fine).

## Rules

- **Invites** `patients/{chartId}/invites/{inviteId}`:
  - `get`: anyone, only when `resource.data.status == 'sent'` (the setup page reads it
    signed out; knowing the 128-bit id is the gate). `list`: `isClinical()` only.
  - `create`: `isAdmitter()`, chart exists and `status == 'active'`, exact keys, `status ==
    'ready'`, `to == intakeRecords/{chartId}.demographics.email.lower()`, `createdBy.uid ==
    request.auth.uid`, `createdBy.name == myName()`, `createdAt == request.time`, lengths.
  - `update`: `isAdmitter()`, `resource.data.status == 'ready'`, only `status` + `sentAt`
    (`'sent'`, `sentAt == request.time`) or `status` + `error` (`'failed'`, string ≤ 300).
  - `delete`: false.
- **Template** `settings/portalInvite`: read `isClinical()`; write `isStaff()`, exact keys,
  lengths, `updatedAt == request.time`, `updatedBy.uid == request.auth.uid`.
- **Link** `patientAccounts/{uid}`: read own or `isClinical()` (unchanged). `create` when:
  `request.auth.uid == uid`; exact keys `email, intakeId, firstName, inviteId, linkedAt`;
  `email == request.auth.token.email`; `linkedAt == request.time`; and the invite at
  `patients/{intakeId}/invites/{inviteId}` has `status == 'sent'`, `to ==
  request.auth.token.email`, `request.time < sentAt + duration.value(7, 'd')`, and
  `firstName` equal to the request's. `update`, `delete`: false.

## Code layout

- `src/admin/patients/portalStore.js`: `watchPortalAccess(chartId)`,
  `sendInvite(chart, intakeEmail, { subject, message }, actor)`, `getInviteTemplate()`,
  `saveInviteTemplate({ subject, message }, actor)`; demo branch.
- `src/admin/patients/PortalAccess.jsx` (box) and `InviteDialog.jsx` (compose).
- `src/admin/lib/emailjs.js`: `emailjsConfigured`, `sendEmail(params)` (the one `fetch`).
- `src/lib/inviteMath.js`: `inviteStatus(invites, linked, now)` → the box's status, and
  `isInviteUsable(invite, now)` (7-day check), shared by the box and the setup page.
  `inviteMath.check.js` added to `npm run check`.
- `src/pages/PortalSetup.jsx`, `src/pages/PortalReset.jsx`; routes in `App.jsx`.
- `src/lib/patientAuth.js`: `getInvite(chartId, inviteId)`,
  `createPortalLogin(invite, ids, password)`, `connectExistingLogin(…)`,
  `checkResetCode(code)`, `saveNewPassword(code, password)`.
- `LoginPanel.jsx`: the reset view.

## Testing

- `npm run test:rules`: invite create (good, wrong email, non-admitter, inactive chart,
  wrong status), invite update (ready→sent, ready→failed, sent→anything refused, other
  fields refused), signed-out `get` of a sent invite allowed and of a `ready` one refused,
  `list` refused for patients; link create (valid, wrong email, expired, `ready` invite,
  wrong `firstName`, someone else's uid, second create refused); template write by
  co-admin allowed, by provider refused.
- `npm run check`: `inviteMath` cases (each status, the 7-day boundary).
- Browser (Playwright, stubbed modules as in the patient-side check): the box and dialog in
  both admin themes, missing-config state, failed send; `/portal/setup` valid, expired,
  existing login, signed in as someone else; login panel reset view; `/portal/reset`
  good code, bad code. 390 px wide without horizontal scroll.
