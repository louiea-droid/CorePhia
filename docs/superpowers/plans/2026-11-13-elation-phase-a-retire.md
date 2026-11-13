# Elation Phase A: retire the back office, portal and Stripe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove everything Elation replaces (charts, notes, calendar, to-do, patient inbox, patient portal, Stripe billing, visit copies, portal emails), leaving the public site, the intake, and an admin of Applicants, contact Messages, Analytics, Staff, Activity, Profile and Help.

**Architecture:** Mostly deletion. First move the few helpers that kept pages borrow from the retiring folders, then delete in layers (admin, portal, functions, rules), keeping `npm run build`, `npm run lint`, `npm run check` and `npm run test:rules` green after every task. Admitting becomes a status change only.

**Tech Stack:** React 19, Vite 8, Firebase (Auth, Firestore, Cloud Functions v2), oxlint, node `--test` against the Firestore emulator.

**Spec:** `docs/superpowers/specs/2026-11-13-elation-emr-design.md`

## Global Constraints

- Work on branch `elation-emr`. Do not deploy; deployment and live cleanup are a separate step Louie runs (Task 7 writes the list).
- The only Cloud Function left is `notifyNewIntake`. `sendMail` goes too: nothing in the browser queues mail once invites, updates and messages are gone.
- Keep the intake record shape, `buildIntakeRecord()`, `isIntakeSections` and the intake rules unchanged (Phase B maps them to Elation).
- Old audit entries must still display: remove retired actions from `AUDIT_ACTIONS` and the rules list, but keep their `ACTION_LABELS` in `Activity.jsx`.
- Visitor copy: no em dashes, brand "CorePhia", "form" not "intake", provider not named, medication only as part of the program. Load `humanizer` for Task 6.
- Rules file: no byte-order mark; never edit it through `String.prototype.replace` from a script.
- Commit after each task, message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Admit/Decline/Discharge on Applicants still works for real Firestore (no chart write is attempted, rules accept the status update alone). Task 1 adds a rules test.
2. An old chart-era audit entry (`sign_note`, `book_appointment`) still shows a readable label on Activity. Task 2 keeps the labels; verify in demo mode.
3. `/account`, `/account/messages`, `/portal/setup`, `/portal/reset` show NotFound (noindex), not a blank page or the old portal. Task 3 browser check.
4. Header and mobile menu render with no "Patient portal" entry while `PATIENT_PORTAL_URL` is empty, and a working new-tab link once set. Task 3.
5. Superadmin can still delete an intake (the rule no longer checks `patients/`). Task 5 test.

---

### Task 1: Move shared helpers out of retiring folders; admit becomes status-only

**Files:**
- Move: `src/admin/calendar/calendarMath.js` → `src/admin/lib/calendarMath.js`, and its `calendarMath.check.js` (update `package.json` `check`)
- Create: `src/admin/staff/staffStore.js` (moved from `chartStore.js`: `loadStaff`, `deleteStaff`, `addStaff`, `setStaffName`, `setStaffRole`, plus the private helpers they use)
- Create: `src/admin/ui/formUi.js` (moved from `noteUi.jsx`: `inputClass`, `labelClass`, `formatDay`, `formatStamp`; plus `asDate` from `chartMath.js`)
- Create: `src/admin/applicants/applicantStore.js` with `setApplicantStatus(record, status)`
- Modify imports in: `analytics/analytics.js`, `analytics/SiteTraffic.jsx`, `lib/firebase.js`, `staff/AddStaffDialog.jsx`, `EditNameDialog.jsx`, `EditRoleDialog.jsx`, `Security.jsx`, `Staff.jsx`, `applicants/Applicants.jsx`
- Test: `tests/firestore.rules.test.js`

**Interfaces:**
- Produces: `setApplicantStatus(record: {id}, status: "admitted"|"declined"|"discharged"|...): Promise<void>` — updates only `intakeRecords/{id}.status` (demo mode: mutates the seed record). Callers keep writing the audit entry themselves as today.
- Produces: `staffStore.js` exports with the same signatures they had in `chartStore.js`.

- [ ] **Step 1:** Add rules test in a new `describe("applicant status")`: an admitter's `updateDoc(intakeRecords/x, { status: "admitted" })` succeeds with no `patients/x` doc and no other write. Run `npm run test:rules`; it should already pass (documents current rules allow it). Keep it as the regression pin.
- [ ] **Step 2:** Do the moves above with `git mv` where whole files move; leave the old exports in place for now if retiring code still imports them (Task 2 deletes those files).
- [ ] **Step 3:** In `Applicants.jsx`, import `setApplicantStatus` from `./applicantStore`; drop `loadCharts` (and anything showing chart state) and the "book first visit" `AppointmentDialog` / `loadAppointmentsFor` path. In `ApplicantsTable.jsx` drop `MembershipBadge`.
- [ ] **Step 4:** Run `npm run lint && npm run check && npm run build`. Expected: all pass.
- [ ] **Step 5:** Commit `refactor(admin): move shared helpers, admit is status-only`.

### Task 2: Remove the admin back office

**Files:**
- Delete: `src/admin/patients/`, `src/admin/calendar/` (all that remains), `src/admin/inbox/`, `src/admin/dashboard/TodayStrip.jsx`, `src/admin/ui/PatientPicker.jsx`, `src/admin/lib/seedRecords.js` parts only used by charts (keep what Applicants' demo uses)
- Modify: `src/admin/AdminApp.jsx` (routes: drop `/admin/patients`, `/admin/patients/:chartId`, `/admin/todo`, `/admin/calendar`, `/admin/messages`→ patient inbox; keep `/admin/queries` contact messages), `layout/Sidebar.jsx` (drop those items and `useTopics`), `staff/roles.js` (drop `patients`, `todo`, `calendar`, `inbox` pages and `canWriteNote`/`canWriteType`), `staff/roles.check.js`, `dashboard/Dashboard.jsx` (drop `TodayStrip`), `help/Help.jsx` (drop chart, notes, calendar, to-do, membership, portal topics; Admit topic says "then add the patient in Elation"), `lib/firebase.js` (`AUDIT_ACTIONS`: remove `viewChart`, `signNote`, `addAmendment`, `bookAppointment`, `moveAppointment`, `cancelAppointment`, `updateAppointmentStatus`, `sendPortalInvite`, `setMembership`, `endMembership`), `firestore.rules` action list to match, `package.json` `check` (remove chartMath and todoMath; calendarMath stays, at its new path from Task 1)
- Keep: `staff/Activity.jsx` `ACTION_LABELS` entries for removed actions.

- [ ] **Step 1:** Delete and modify as listed. Unknown `/admin/...` already redirects to the dashboard, so old bookmarks land safely.
- [ ] **Step 2:** `npm run lint && npm run check && npm run build`. Expected: pass; `auditActions.check.js` passes (lists in step).
- [ ] **Step 3:** Browser check in demo mode (own server on :5190 with empty Firebase env, per CLAUDE.md): `/admin?demoRole=superAdmin` — sidebar shows Dashboard, Applicants, Messages (contact), Analytics, Staff, Activity, Help; Admit and Decline an applicant; `/admin/patients` redirects to dashboard. Repeat for `demoRole=dietitian`.
- [ ] **Step 4:** Commit `feat(admin): retire charts, calendar, to-do, patient inbox (Elation replaces them)`.

### Task 3: Remove the patient portal

**Files:**
- Delete: `src/portal/`, `src/components/LoginPanel.jsx`, `src/lib/inviteMath.js`, `progressMath.js`, `messageMath.js` (+ their `.check.js`), `patientSessionHint.js`, `src/lib/mail.js`
- Modify: `src/App.jsx` (remove the `/account/*`, `/portal/setup`, `/portal/reset` branch; they fall to NotFound), `src/components/Header.jsx` and `MobileMenu.jsx` (replace the login panel with a link to `PATIENT_PORTAL_URL`, `target="_blank" rel="noopener"`, rendered only when it is non-empty), `src/lib/siteContact.js` (add `export const PATIENT_PORTAL_URL = ""` with a comment: Elation Patient Passport address, from Dr. Antonious), `src/index.css` (remove `#patient-portal-root` rules and the `good`, `good-soft`, `wash` tokens if nothing else uses them; grep first), `package.json` `check` (remove inviteMath, progressMath, messageMath, whatsNext), `src/admin/lib/useIdleTimeout.js` comment
- Keep: `googleAnalytics.js` exclusions for `/account` and `/portal` (harmless, and `googleAnalytics.check.js` stays as is).

- [ ] **Step 1:** Make the changes. Grep `src` for `patientAuth|LoginPanel|queueMail|portal/` afterwards; expect no hits outside comments you then fix.
- [ ] **Step 2:** `npm run lint && npm run check && npm run build`. Expected: pass; prerender still writes every public page.
- [ ] **Step 3:** Browser check (Review Focus 3, 4): `/account`, `/account/messages`, `/portal/setup` show NotFound; header (desktop and 390px mobile menu) has no portal entry; set `PATIENT_PORTAL_URL` temporarily to `https://example.com` and confirm the link appears and opens a new tab, then set it back to `""`.
- [ ] **Step 4:** Commit `feat: retire patient portal (Elation Patient Passport replaces it)`.

### Task 4: Remove Stripe, visit copies and portal emails from functions

**Files:**
- Delete: `functions/billing.js`, `billing.check.js`, `visits.js`, `visits.check.js`
- Modify: `functions/index.js` (keep only `notifyNewIntake` and the `send` helper; delete `sendMail`, `startCheckout`, `openBillingPortal`, `stripeWebhook`, `onChartDischarged`, `mirrorVisit`, `copyVisitsOnChartCreate`, the Stripe secrets and imports), `functions/emails.js` (keep `newIntake`, `intakeReceipt`), `emails.check.js`, `send-test.js` (two emails), `functions/package.json` (remove `stripe`; run `npm install` in `functions/` to update the lockfile), root `package.json` `check` (remove billing, visits)

- [ ] **Step 1:** Make the changes.
- [ ] **Step 2:** `npm run check` and `node -e "import('./functions/index.js')"` from `functions/` with no secrets set. Expected: check passes; import loads without error and exports only `notifyNewIntake`.
- [ ] **Step 3:** Commit `feat(functions): retire Stripe billing, visit copies and portal email`.

### Task 5: Trim Firestore rules and their tests

**Files:**
- Modify: `firestore.rules` — delete `match` blocks `patientAccounts`, `patients/{chartId}` (with notes, amendments, invites, visits, updates, progress, topics, messages), `billing`, `appointments` (with changes), `todos`, the `{path=**}/topics` group, `mail`; delete helpers only those used (`canWriteType`, membership/invite helpers, etc.); `intakeRecords` delete rule becomes `allow delete: if role() == 'superAdmin';`. The final `{document=**}` deny stays.
- Modify: `tests/firestore.rules.test.js` — delete describes: charts, notes, amendments, dietitian and exercise notes, appointments, todos, patient accounts, portal invites, portal setup links, portal updates, portal progress, portal messages, outgoing mail, membership, patient visits; trim `roles` and `deleting an intake` of chart cases. Add: superAdmin deletes an intake (Review Focus 5); a client write to `patients/x` and `mail/x` is refused.

- [ ] **Step 1:** Write the two new tests; run `npm run test:rules`; the `patients/x` / `mail/x` refusal tests fail against current rules.
- [ ] **Step 2:** Trim the rules and the old tests.
- [ ] **Step 3:** `npm run test:rules` and `npm run check`. Expected: all pass (report the new count).
- [ ] **Step 4:** Commit `feat(rules): drop chart, portal, billing and mail rules`.

### Task 6: Public copy

**Files:** `src/pages/Legal.jsx` (Privacy: Elation as the medical record and billing provider replacing the portal and Stripe; remove portal theme localStorage line; Terms "Cost and payment" and portal mentions; Notice of Privacy Practices), `src/pages/Faq.jsx` or its data (How do I pay?, portal answers, urgent-problem answer no longer says "portal messages"), `public/llms.txt`, any home/membership/program copy that mentions the portal (grep `portal|Stripe|billing` in `src/pages src/components src/data public/llms.txt`).

- [ ] **Step 1:** Load `humanizer`. Make the edits; Elation is named only where the legal pages list service providers ("Elation Health, our electronic medical record and billing system"); elsewhere "your patient portal" (Passport is the patient-facing name).
- [ ] **Step 2:** `npm run lint && npm run build`; grep shows no `Stripe` in `src` or `public`; no em dashes added.
- [ ] **Step 3:** Commit `docs(site): copy for Elation (portal, billing, privacy)`.

### Task 7: CLAUDE.md, memory and the deploy checklist

**Files:** `CLAUDE.md` (rewrite: Stack check list, Architecture `src/portal` line, Routes, Billing: Stripe → "Retired 2026-11-13, Elation bills", Client portal → "Retired, Elation Patient Passport", Admin charts/calendar/to-do sections collapsed to one "Retired" note, Email section (two emails, `sendMail` gone), Elation section pointing to the spec and Phase B), `docs/superpowers/specs/2026-11-13-elation-emr-design.md` (add "Deploy checklist").

Deploy checklist to write (Louie runs it, with the site and rules together as always):
1. `firebase deploy --only hosting,firestore:rules,functions` (CLI asks to delete the removed functions: yes).
2. If not prompted: `firebase functions:delete sendMail startCheckout openBillingPortal stripeWebhook onChartDischarged mirrorVisit copyVisitsOnChartCreate --region us-central1`.
3. `firebase functions:secrets:destroy STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
4. Firestore console: delete test data in `patients`, `appointments`, `todos`, `billing`, `patientAccounts`, `mail`.
5. Stripe sandbox: delete the webhook endpoint if one was made; the account can be closed later.

- [ ] **Step 1:** Write it. Update memory `deploy-status` and `resume-2026-11-05` (portal and Stripe retired).
- [ ] **Step 2:** Final `npm run lint && npm run check && npm run build && npm run test:rules`. Expected: all pass.
- [ ] **Step 3:** Commit `docs: Elation phase A done, deploy checklist`.
