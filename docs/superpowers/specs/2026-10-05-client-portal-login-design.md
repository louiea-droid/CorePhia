# Client portal: login and invites (no sending yet) — design

2026-10-05. Decisions are Louie's, made in conversation the same day. Builds on
`docs/client-portal.md` (invite-only, login first) and the existing patient login
(`src/components/LoginPanel.jsx`, `src/lib/patientAuth.js`, `src/pages/Account.jsx`).

## What and why

The patient login becomes the CorePhia client portal, and only admitted patients can
have an account. Staff prepare a "set up your client portal" invite from the patient's
chart, with a message they can edit.

Decisions:
- **Invite route: a Cloud Function will send it (option A), but not in this round.** No
  function, no email sending and no Blaze plan now. Invites are saved as "Ready to send";
  the function picks them up later without UI changes.
- **Sign-in after the invite: email and password.** The invite link (later) lets the
  patient choose a password. No Google sign-in, no public sign-up.
- **Invites are manual:** a "Send portal invite" button on the chart, which becomes
  "Resend invite" after the first one. Not automatic on admit.
- **The message is editable** per invite, from a saved default template staff can change.
- Portal sections stay "Coming soon" this round. **Updates is the next build** (see Later).

## Constraints

- Invites and account links name patients: PHI, same BAA note as charts (CLAUDE.md,
  blocker 1). Emails, once sent, carry no health details, but the email sender must also be
  covered by a BAA, since "welcome to your CorePhia portal" reveals a patient relationship.
- The browser never creates or links a patient's account. `patientAccounts/{uid}` is
  written only by the server (later) or by hand in the console (testing now).
- Visitor-facing copy: "CorePhia", no em dashes, no provider name, "your care team" not
  "your provider" as one person.
- No new dependencies. Admin tokens and dark mode; hover = colour only.
- Follow the existing store pattern: Firestore functions with an in-memory demo branch
  (`getDemoStore()` / `demoId()` in `chartStore.js`).

## Patient side (public site)

**Header.** "Log in" and the signed-in "My account" both become **Patient portal**
(desktop and mobile menu), so the entry has one name whether or not you are signed in.

**Login panel.** Email, password, "Forgot password". The "Create account" mode, the
sign-up path and "Continue with Google" are removed. `signUpPatient`,
`signInPatientWithGoogle` and `recordNewPatient` in `patientAuth.js` go with them.

**`/account` (the portal page).** Title "Patient portal | CorePhia", still noindex.
- Checking: nothing shown (as today).
- Signed out: "Sign in to your patient portal" with a button that opens the login panel,
  and a line for people who aren't patients yet pointing to "Get started" (the intake).
- Signed in and linked (a `patientAccounts/{uid}` doc with an `intakeId` exists):
  "Welcome back, {firstName}", then four cards: **Updates**, **Track progress**,
  **Messages**, **Membership**, each with one line of what it will hold and a "Coming soon"
  tag. Then Sign out.
- Signed in but not linked (old self sign-ups, a mismatched email, no doc): "Your portal
  isn't set up yet. If you're a CorePhia patient, contact us and we'll send you an invite,"
  with `SUPPORT_PHONE` and `info@corephia.com`. Sign out. No data shown.
- Read failure: "We couldn't load your portal. Please try again." with Retry.

**Not this round:** the set-password page the invite link lands on. It needs the token the
function issues, so it is built with the function.

## Staff side (admin)

**Portal access box** on `PatientChart.jsx`, near the chart header. Shows:
- the intake email the invite goes to (read-only);
- status, from the newest invite and the link doc:
  - "Not invited"
  - "Ready to send · saved Oct 5 by Louie" (newest invite is `ready`)
  - "Sent Oct 5" (newest invite is `sent`; only once the function exists)
  - "Portal active" (a `patientAccounts` doc links to this intake; staff can read it)
- **Send portal invite**, or **Resend invite** once any invite exists. Shown to roles that
  can admit (`isAdmitter`); inactive charts show the status but no button.
- "Earlier invites" disclosure: date, who, status for each previous invite.

**Compose dialog** (same dialog pattern as the Staff page):
- To: the intake email, read-only.
- Subject and Message fields, prefilled from the template with `{firstName}` replaced.
  Limits: subject 1–200 chars, message 1–5000 chars.
- A fixed note under the message: "A secure **Set up your portal** button is added below
  your message automatically." The button and link are never part of the editable text.
- "Save as the default template" checkbox, shown only to co-admin and up. When ticked,
  the template is saved with `{firstName}` put back in place of the patient's first name.
- Buttons: **Save invite** (primary) and Cancel. The primary says "Save invite", not
  "Send", because nothing is sent yet; it becomes "Send invite" when the function exists.
- Errors show inline in the dialog; the dialog stays open with the text kept.

**Default template** (used when `settings/portalInvite` doesn't exist):

> **Subject:** Set up your CorePhia patient portal
>
> Hi {firstName},
>
> Your CorePhia patient portal is ready. Use the button below to choose a password and
> sign in. This is where you'll find updates from your care team.
>
> Questions? Call us at {phone} or email info@corephia.com.
>
> CorePhia Health · Tampa, Florida

`{phone}` is filled from `SUPPORT_PHONE` at compose time, like `{firstName}`.

## Data

**`patients/{chartId}/invites/{inviteId}`** — the invite queue. Append-only for staff.
```
{ to, firstName, subject, message,
  status: 'ready',          // 'sent' | 'failed' are written by the function later
  createdBy: { uid, name }, createdAt }
```
`createdBy.name` is the staff record name (as for signed notes). The function will later
send each `ready` invite, create or reuse the Auth account, write the link doc, and set
`status`, `sentAt` or `error`.

**`settings/portalInvite`** — `{ subject, message, updatedBy: { uid, name }, updatedAt }`.

**`patientAccounts/{uid}`** — the account-to-intake link.
```
{ email, intakeId, firstName, linkedAt }
```
Written by the function later; by hand in the Firebase console for testing now.

## Rules (`firestore.rules`)

- `patients/{chartId}/invites/{id}`: read if `isClinical()`; create if `isAdmitter()`,
  the chart exists and is active, `status == 'ready'`, `to` equals the intake record's
  `demographics.email`, `createdBy.uid == request.auth.uid` and name matches `myName()`,
  `createdAt == request.time`, exact keys and length limits. No update or delete from
  clients (the function uses the Admin SDK, which bypasses rules).
- `settings/portalInvite`: read if `isClinical()`; write if `isStaff()`, exact keys,
  length limits, `updatedAt == request.time`, `updatedBy.uid == request.auth.uid`.
- `patientAccounts/{uid}`: read if `request.auth.uid == uid` or `isClinical()` (the chart's
  "Portal active" status needs a query on `intakeId`); **create, update, delete: false**.
  The client create rule for self sign-up is removed.

## Admin store

New `src/admin/patients/portalStore.js`:
- `watchPortalAccess(chartId)` → newest invites + whether a link doc exists.
- `saveInvite(chart, { subject, message }, actor)`.
- `getInviteTemplate()` / `saveInviteTemplate({ subject, message }, actor)`.
Each with the in-memory demo branch.

Public side: `patientAuth.js` gains `getMyPortalLink(uid)` reading `patientAccounts/{uid}`.

## Testing

- `npm run test:rules` gains cases: a patient reads only their own link doc and can't
  write any; a signed-in non-staff user can't create a link doc; a provider can create a
  `ready` invite for an active chart, not edit or delete it, not create one with another
  email or a `sent` status; only co-admin and up write the template. Needs Java 21+ (not
  installed; CLAUDE.md blocker 2).
- `npm run build` and `npm run lint` clean.
- Browser check (Playwright, scratchpad script): header label, login panel without
  sign-up or Google, `/account` in all four states (demo/console-linked account),
  admin Portal access box, compose dialog, template save, Resend, both admin themes.

## Later (not this round)

1. **The Cloud Function and sending** (Blaze plan, sending mailbox, BAA for the sender):
   send `ready` invites, create the patient's Auth account, write `patientAccounts`, issue
   the setup link, mark `sent` / `failed`. Check link lifetime: Firebase's built-in
   password-reset links expire quickly, so a 7-day invite likely needs our own token.
   Fallback with no server: `addStaff` in `chartStore.js` already creates accounts on a
   secondary auth instance and sends Firebase's reset email, but that email's wording
   can't be edited per invite.
2. **The set-password page** the invite lands on.
3. **Updates section** (next portal build). Staff post a dated update on the chart; the
   patient sees it on their portal; the function emails "you have a new update, check your
   portal" with no details. Data idea: `patients/{chartId}/updates/{id}` `{ body,
   createdBy, createdAt }`, patient reads via their `intakeId` link. Size: small.
4. Then Track progress, then Messages; Membership waits on billing.
