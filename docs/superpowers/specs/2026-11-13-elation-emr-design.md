# Elation EMR: retire the back office, then connect admissions

Date: 2026-11-13. Status: approved by Louie 2026-11-13.

## Why

Dr. Antonious bought **Elation** (with API access, Patient Passport and billing). The practice
runs in Elation from now on. Our admin back office, patient portal and Stripe billing were built
only because the EMR was on hold (`docs/meeting-analysis.md` §5); keeping them means two systems
for the same patient. The site goes back to its agreed role: marketing pages, the intake, and
staff review of applicants.

## The flow (decided by Louie)

Form → our admin (Applicants) → staff admit → patient created in Elation → all care in Elation.
Declined applicants never reach Elation.

## Order (decided by Louie)

**Phase A (first): retire what Elation replaces.** **Phase B (second): send admitted patients to
Elation.** Between the two, admitting only marks the applicant admitted; staff type the patient
into Elation by hand. Acceptable because no real patients are on the site yet (BAA blocker).

## Goals

- One place for clinical work: Elation.
- Less to maintain, less PHI in Firestore.
- Admit in our admin creates the Elation patient with no retyping (Phase B).

## Non-goals

- Two-way sync. Nothing comes back from Elation into our site.
- Rebuilding anything Elation does (charts, notes, scheduling, portal, billing).

## Anti-goals

- Leaving a half-working portal or billing page visible to patients.
- Any PHI in emails (unchanged rule).

## Approaches considered

1. **Manual handoff only.** Works with any plan, but retyping every intake. Rejected: API is paid for.
2. **Send to Elation on admit (chosen, Louie).** Our review screen stays; only accepted patients
   enter Elation. Cost: Firestore still holds intakes until admitted, so the Google BAA is still
   needed before real patients.
3. **Send to Elation on submit.** Removes PHI from Firestore, but staff review moves into Elation
   and declined applicants clutter it. Not chosen.
4. **Two-way sync** to keep our portal. Rejected: duplicates Patient Passport.

## Phase A: what goes

| Area | Remove |
|---|---|
| Admin pages | Dashboard Today strip parts about charts, Patients + PatientChart (notes, prescriptions, progress, updates, portal access, invites, membership), To-do, Calendar, patient Messages inbox (`admin/inbox`) |
| Admin code | `admin/patients/*`, `admin/calendar/*`, `admin/inbox/*`, `admin/dashboard/TodayStrip.jsx` (or its chart cards), `ui/PatientPicker.jsx` if unused, chart-related audit actions |
| Patient portal | `src/portal/*`, routes `/account/*`, `/portal/setup`, `/portal/reset`, `LoginPanel`, `lib/patientAuth` |
| Billing | Stripe functions `startCheckout`, `openBillingPortal`, `stripeWebhook`, `onChartDischarged`; `functions/billing*.js`; Stripe secrets |
| Visit copies | `mirrorVisit`, `copyVisitsOnChartCreate`, `functions/visits*.js` |
| Emails | invite, update, message, staff notice (keep new-form alert and receipt) |
| Rules | `patients/**`, `appointments`, `topics`, `billing`, `patientAccounts`, portal-only `mail` kinds, invites; tests in `tests/firestore.rules.test.js` to match |
| Self-checks | chartMath, calendarMath, todoMath, progressMath, messageMath, inviteMath, billing, visits, whatsNext |

## Phase A: what stays

Public site, intake, contact form, cookie banner and analytics. Admin: Applicants (admit /
decline / discharge status), contact Messages, Analytics, Staff, Activity, Profile, Help.
Functions: `sendMail`, `notifyNewIntake`. Membership page (plans and prices must match what is
set up in Elation billing).

## Phase A: what changes

- Header and mobile menu "Patient portal": links to Elation Patient Passport (new tab) instead of
  our login panel. *My call*; URL from Elation once the practice is set up, hidden until then.
- Admitting: no chart is created; status only.
- Dashboard: keeps what does not depend on charts (pending applicants, contact messages, traffic).
- Roles: keep the five roles for admin access to Applicants; note-writing permissions go.
- Copy: Privacy, Terms, HIPAA notice (Elation replaces Firebase/Stripe for clinical data and
  payment), FAQ "How do I pay?" and portal answers, `llms.txt`, admin Help.
- Live cleanup after deploy: delete the six retired functions and the Stripe secrets; deploy rules
  with the site (as always). Existing test charts/topics in Firestore: delete in the console.
  *My call.*
- `CLAUDE.md`: rewrite the portal, billing, charts, calendar sections.

## Phase B: send to Elation on admit

- Callable Cloud Function `sendToElation(intakeId)`, admitters only, run when staff admit (and by a
  Retry button). OAuth client credentials; `ELATION_CLIENT_ID` / `ELATION_CLIENT_SECRET` in Secret
  Manager; sandbox base URL first, production switch in one constant.
- Creates the Elation patient (demographics), then problems, medications, allergies, history from
  the grouped `buildIntakeRecord()` sections. Field mapping is a pure function with a self-check
  (`functions/elation.check.js`, in `npm run check`).
- Writes back on the intake: `elation: { patientId, sentAt }` or `elation: { error, at }`.
  Applicants shows "In Elation" with a link, or the error and Retry.
- Idempotent: if `elation.patientId` exists, do nothing.
- Intake deleted from Firestore 30 days after a successful send (Louie, 2026-11-13).

## Left to the builder

Exact Elation field mapping (needs the sandbox and Elation's patient schema), how the plan choice
is recorded in Elation, the Passport URL.

## Open, needs Louie / Elation

- Sandbox client ID and secret (Elation → Settings → API Access).
- ~~Elation billing covers monthly memberships~~: confirmed (Louie, 2026-11-13). Stripe goes.
- ~~Retention after send~~: 30 days, confirmed (Louie, 2026-11-13).
- Google BAA still required before real patients (option A keeps intakes in Firestore).
