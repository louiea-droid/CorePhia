# Zahga CRM replaces our admin

Date: 2026-11-13. Status: draft for Louie. Changes the Elation design
(`2026-11-13-elation-emr-design.md`): Phase B's trigger moves from our admin to the CRM.

## Why

Louie owns the Zahga CRM (crm.zahga.com) and wants CorePhia's staff to work there instead of in
a second, home-built admin. After Elation Phase A, our admin is only Applicants (admit / decline
/ discharge), contact Messages, Analytics, Staff, Activity, Profile and Help. The CRM already has
clients, users and roles, an entry history, tasks, calendar and analytics. Keeping both means two
logins and the same applicant in two places.

## The flow

Form → Firestore (as today) → our function copies it to the CRM → staff review in the CRM and set
the status → the CRM's webhook tells our function → admitted applicants are created in Elation.
Declined applicants never reach Elation (unchanged).

## Goals

- Staff use one tool for applicants and inquiries: the CRM. Care stays in Elation.
- Delete our admin (`src/admin`, `/admin/*`) and everything only it needs.
- Admitting in the CRM creates the Elation patient with no retyping.

## Non-goals

- Changing the public site, the intake screens or the contact form (only where they submit to).
- Building anything in the CRM's own code. CorePhia uses its API, webhooks and settings.
- Pulling anything from Elation back into the CRM beyond "sent" / the Elation link.

## Anti-goals

- PHI in the CRM before the four HIPAA conditions below are met.
- A CRM API key or webhook secret in the browser or in the repo.
- Any PHI in emails (unchanged rule).

## HIPAA conditions (Louie, before real patients)

The CRM will hold full intake answers. Until all four hold, only fake test data goes in.

1. Google Cloud BAA accepted for the `zahga-crm` project's billing account.
2. A BAA between Zahga (Hyacinth) and CorePhia.
3. CorePhia's workspace closed to people outside that BAA, including the CRM's developer
   "view another company" mode.
4. In the CRM: per-person logins, two-step sign-in for anyone who can see CorePhia, automatic
   sign-out after inactivity.

**Enforced by a switch, not by care** (*my call*): `CRM_SYNC` (a Functions parameter) is `test` until all four hold. In `test`, only intakes and inquiries whose email ends in `@corephia.com` or contains `+test` go to the CRM; everything else is skipped and logged. `live` sends all. The daily sweep only looks at intakes created after `CRM_SYNC_SINCE` (the day the switch went live), so turning it on never backfills old submissions.

The Google BAA on `corephia-health` is still needed too: Firestore holds each intake until it is
sent to Elation (below).

## Approaches considered

1. **Keep our admin; CRM gets name, contact and status only.** No PHI in the CRM, no BAA work
   there. Two tools for staff. Was the earlier recommendation.
2. **CRM replaces our admin (chosen, Louie 2026-11-13).** One tool, our admin is deleted. Needs
   the HIPAA conditions above.
3. **Intake form built in the CRM's Forms, our intake retired.** Least of our code, but loses the
   one-question-per-screen intake, the Firestore rules checks and the grouped record the Elation
   mapping is built on. Not chosen.

## What gets built

### 1. CRM setup (Louie, in the CRM)

- A custom object **CorePhia applicants** with fields named by API key: `intakeId` (text, unique
  key for upserts), `name`, `email`, `phone`, `dateOfBirth`, `plan`, `submittedAt`, `status`
  (choice: New, Admitted, Declined, Discharged), `elation` (choice: Not sent, Sent, Error, Retry),
  `elationLink` (URL), `elationError` (text), and one text-area field per intake section
  (`demographics`, `vitals`, `medicalHistory`, `familyHistory`, `socialHistory`, `nutrition`,
  `visit`, `consent`). *My call:* one readable field per section keeps the object small and
  mirrors `buildIntakeRecord()`; staff read it like a form.
- A custom object **CorePhia inquiries**: `name`, `email`, `phone`, `message`, `submittedAt`.
- An API key with `objects:read`, `objects:write`. A webhook (signed) for applicant entry
  changes, pointing at our `crmWebhook` function.

### 2. Copy to the CRM (Cloud Functions in `corephia-health`)

- `onIntakeCreated` (extends today's `notifyNewIntake` trigger, or a second trigger on the same
  document): upsert the applicant by `intakeId`, status New, elation Not sent; upsert a CRM
  **client** by email and link the entry to it. Write back on the intake:
  `crm: { entryId, at }` or `crm: { error, at }`.
- `onContactMessageCreated`: same for inquiries.
- The formatting (intake record → CRM fields) is a pure function in `functions/crm.js` with a
  self-check `functions/crm.check.js` in `npm run check`.
- Secrets: `ZAHGA_API_KEY`, `ZAHGA_WEBHOOK_SECRET` in Secret Manager. Base URL
  `https://us-central1-zahga-crm.cloudfunctions.net/objectsApi/v1` in one constant.
- Failures retry (Firestore trigger retry on), and a scheduled daily sweep re-sends any intake
  with no `crm.entryId`. *My call:* without our admin nobody would see a stuck intake otherwise.

### 3. Status from the CRM (`crmWebhook`, HTTPS, public invoker)

- Verify `X-Zahga-Signature` (HMAC-SHA256 of the raw body) before anything else; reject
  otherwise. Ignore events for other objects.
- Copy `status` to the intake in Firestore: New → `pending`, Admitted → `admitted`, Declined → `declined`, Discharged → `discharged` (today's values).
- After an entry is in Elation, later status changes update Firestore only. Elation is never told (no sync, unchanged); discharging a patient is done in Elation by staff. *My call.*
- If `status` is Admitted and `elation` is Not sent or Retry: run Elation Phase B's send
  (`sendToElation`, now an internal function, not a callable). Write the result to the CRM
  entry: `elation` Sent + `elationLink`, or Error + `elationError`. Staff retry by setting
  `elation` to Retry.
- Idempotent (unchanged): an intake with `elation.patientId` is never sent twice. The CRM
  retries webhooks for ~15 hours, so a slow Elation call must not create two patients: mark the
  intake "sending" in a transaction first.
- Our own writes back to the CRM raise webhooks too; the function must treat them as no-ops.

### Overlap (Order step 1)

While both exist, the CRM is the authority: our admin's Applicants status control becomes read-only (rules refuse staff status updates), so the two can't disagree. The Elation design's `sendToElation` callable, the Applicants "In Elation" link and Retry button are dropped; the send only runs from `crmWebhook`. *My call.*

### 4. Delete our admin

- `src/admin/**`, the `/admin/*` routes and their lazy imports, `admin-portal-root` styles.
- Rules: staff reads and updates on `intakeRecords` and `contactMessages`, `user/*`,
  `staffPhotos`, `auditLog`, `siteEvents` reads; the client keeps create-only on
  `intakeRecords`, `contactMessages`, `siteEvents`. Rules tests to match.
- Self-checks that only served the admin: `roles`, `staffMath`, `calendarMath`, `auditActions`.
- `siteEvents` (our cookie-free counts) lose their only reader. *My call:* stop writing them and
  drop the rules, the lazy loader and their privacy-policy line; Google Analytics stays. Say no
  if Louie wants the counts kept for later.
- Staff Firebase Auth logins: delete in the console after deploy.
- Retention: a new scheduled function (none exists today) deletes intakes 30 days after the
  Elation send (decided) and declined ones 30 days after the decline (*my call*). Contact
  messages are deleted from Firestore once the CRM has them (*my call*: nothing reads them here).

### 5. Copy and docs

Privacy policy and HIPAA notice: name the CRM (Zahga) as a service provider that stores intake
and contact data; remove the cookie-free counts if dropped. `llms.txt` unchanged. `CLAUDE.md`:
replace the admin sections.

## Order

1. Build 2 and 3 against the CRM with fake data, while our admin still works (both show the same
   applicants for a while).
2. Elation Phase B plugs into `crmWebhook` once the Elation sandbox credentials arrive.
3. Delete our admin (4, 5) once Louie has tried a full run in the CRM.
4. Real patients only after the HIPAA conditions.

## Left to the builder

Confirm in the CRM's API page (Louie can log in) that it has upsert by a custom unique field, client linking, signed webhooks for custom objects and the acting user or key in the payload; fall back to find-then-create and value comparison if not. The CRM's exact webhook event payload and how to tell our own writes from staff edits; text-area
length limits per field; the scheduled sweep's schedule.

## Open, needs Louie

- The HIPAA conditions above.
- Elation sandbox credentials (from the Elation design, unchanged).
