# Portal invites, admin side — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff send an admitted patient a portal invite from their chart: an editable message, sent once through EmailJS, with a secure setup link, and the chart shows the invite's status.

**Architecture:** Invites live in `patients/{chartId}/invites/{inviteId}` (id = 128-bit random hex). The admin writes the invite as `ready`, calls EmailJS's REST endpoint with `fetch`, then marks it `sent` or `failed`. Status logic is pure (`src/lib/inviteMath.js`, shared later with `/portal/setup`). A saved default template lives in `settings/portalInvite`.

**Tech Stack:** React 19, Tailwind v4 admin tokens, Firebase Firestore v12, `@firebase/rules-unit-testing` + `node --test`, `node:assert` self-checks (`npm run check`), Playwright from a session scratchpad.

**Spec:** `docs/superpowers/specs/2026-10-05-portal-invites-emailjs-design.md` (sections "Admin: invite from the chart", "Data", "Rules" for invites and template, "Code layout"). The patient pages (`/portal/setup`, `/portal/reset`), the login panel reset view and the `patientAccounts` create rule are the next plan.

## Global Constraints

- No new dependencies: EmailJS via `fetch("https://api.emailjs.com/api/v1.0/email/send")`.
- Env: `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY`; missing → sending disabled with "Email sending isn't set up yet."
- Staff text never becomes markup: `message_html` is HTML-escaped, then `\n` → `<br>`.
- Invite `to` is the intake's `demographics.email`, lowercased and trimmed.
- Follow the store pattern: every store function has a `usingSeedData` branch using `getDemoStore()` / `demoId()`.
- Admin UI: `ui/Modal.jsx`, `noteUi` `inputClass`/`labelClass`, admin tokens (`accent-text` for blue text, `oncolor` on solid fills), dark mode, hover = colour only.
- Copy: "CorePhia", no em dashes in patient-facing text (the default template), no provider name.
- Load UI skills before UI tasks (CLAUDE.md); don't start or stop the dev server.

## Review Focus

1. **Intake with no email** → box says "No email on this intake", no button. → Task 4 browser case.
2. **EmailJS returns an error or the network fails** → invite saved as `failed` with the error, dialog shows "The email didn't send: …", text kept. → Task 3 check (`sendInvite` with a failing fetch, demo store) + Task 4 browser case.
3. **Message containing `<b>` or `&`** reaches EmailJS escaped. → Task 2 `escapeMessage` check.
4. **An invite exactly 7 days old** counts as expired; 7 days minus a minute does not. → Task 2 boundary check.
5. **A provider can't save the default template** (only co-admin and up); the checkbox is hidden for them. → Task 1 rules test + Task 4 browser case.

---

### Task 1: Rules for invites and the template

**Files:** Modify `firestore.rules` (inside `match /patients/{chartId}`, plus a new top-level `match /settings/portalInvite`); Test `tests/firestore.rules.test.js` (seed + `describe("portal invites")`).

**Produces:** the rule contract in the spec's "Rules" section, invites and template only.

- [ ] Seed in `beforeEach`: `intakeRecords/chart1` gains `demographics: { email: "pat@x.co" }`; add `patients/chart1/invites/sent1` `{ to: "pat@x.co", firstName: "Pat", subject: "s", message: "m", status: "sent", createdBy: { uid: "provider", name: "provider" }, createdAt: new Date(), sentAt: new Date() }` and `.../ready1` (same, `status: "ready"`, no `sentAt`).
- [ ] Tests (write first, run, see them fail):
  - provider creates a valid `ready` invite → succeeds (`createdAt: serverTimestamp()`, `createdBy: { uid: "provider", name: "provider" }`, `to: "pat@x.co"`).
  - refused: `to` another email; `status: "sent"` on create; dietitian creates; `createdBy.uid` someone else; extra key; chart `pending1` (no active chart).
  - update `ready1` → `{ status: "sent", sentAt: serverTimestamp() }` succeeds; → `{ status: "failed", error: "x" }` succeeds; `sent1` → anything refused; `ready1` changing `message` refused; delete refused.
  - signed-out `get` of `sent1` succeeds, of `ready1` refused; signed-out `list` of invites refused; provider `list` succeeds.
  - `settings/portalInvite`: coadmin writes `{ subject, message, updatedBy: { uid: "coadmin", name: "coadmin" }, updatedAt: serverTimestamp() }` → succeeds; provider → refused; provider reads → succeeds.
- [ ] Rules:

```
      // Portal invites (Louie, 2026-10-05): the admin saves one as 'ready',
      // sends it through EmailJS, then marks it 'sent' or 'failed'. The id is
      // 128 random bits; a signed-out /portal/setup page may get a sent one by
      // id (the link is the proof), never list them.
      match /invites/{inviteId} {
        function isNewInvite() {
          let data = request.resource.data;
          let chart = get(/databases/$(database)/documents/patients/$(chartId)).data;
          let intake = get(/databases/$(database)/documents/intakeRecords/$(chartId)).data;
          return data.keys().hasOnly(['to', 'firstName', 'subject', 'message', 'status', 'createdBy', 'createdAt'])
            && chart.status == 'active'
            && data.status == 'ready'
            && data.to == intake.demographics.email.lower().trim()
            && data.firstName is string && data.firstName.size() <= 100
            && data.subject is string && data.subject.size() > 0 && data.subject.size() <= 200
            && data.message is string && data.message.size() > 0 && data.message.size() <= 5000
            && data.createdBy.keys().hasOnly(['uid', 'name'])
            && data.createdBy.uid == request.auth.uid
            && data.createdBy.name == myName()
            && data.createdAt == request.time;
        }
        function isSendResult() {
          let changed = request.resource.data.diff(resource.data).affectedKeys();
          return resource.data.status == 'ready'
            && ((changed.hasOnly(['status', 'sentAt']) && request.resource.data.status == 'sent'
                 && request.resource.data.sentAt == request.time)
             || (changed.hasOnly(['status', 'error']) && request.resource.data.status == 'failed'
                 && request.resource.data.error is string && request.resource.data.error.size() <= 300));
        }
        allow get: if isClinical() || resource.data.status == 'sent';
        allow list: if isClinical();
        allow create: if isAdmitter() && isNewInvite();
        allow update: if isAdmitter() && isSendResult();
        allow delete: if false;
      }
```

```
    // The default portal-invite wording. Co-admin and up change it.
    match /settings/portalInvite {
      allow read: if isClinical();
      allow write: if isStaff()
        && request.resource.data.keys().hasOnly(['subject', 'message', 'updatedBy', 'updatedAt'])
        && request.resource.data.subject is string && request.resource.data.subject.size() > 0 && request.resource.data.subject.size() <= 200
        && request.resource.data.message is string && request.resource.data.message.size() > 0 && request.resource.data.message.size() <= 5000
        && request.resource.data.updatedBy.keys().hasOnly(['uid', 'name'])
        && request.resource.data.updatedBy.uid == request.auth.uid
        && request.resource.data.updatedAt == request.time;
    }
```

- [ ] `npm run test:rules` → all pass; update the count line. Commit "Rules: portal invites and the invite template".

---

### Task 2: `inviteMath` (pure) + self-check

**Files:** Create `src/lib/inviteMath.js`, `src/lib/inviteMath.check.js`; Modify `package.json` `check` script (append `&& node src/lib/inviteMath.check.js`).

**Produces:**
- `INVITE_DAYS = 7`
- `asDate(value) → Date | null` (Firestore Timestamp, Date, ISO string, null)
- `inviteExpiresAt(invite) → Date | null` (sentAt + 7 days)
- `isInviteUsable(invite, now) → boolean` (`status === "sent"` and `now < expiresAt`)
- `inviteStatus(invites, linked, now) → { kind, invite }` where `invites` is newest first and `kind` ∈ `"active" | "none" | "sending" | "failed" | "sent" | "expired"`; `linked` true wins.
- `fillTemplate(text, { firstName, phone }) → string` (replaces every `{firstName}`, `{phone}`; blank firstName → "there")
- `toTemplate(text, { firstName, phone }) → string` (puts the placeholders back; skips empty values)
- `escapeMessage(text) → string` (escape `& < > " '`, then `\r?\n` → `<br>`)
- `newInviteId() → string` (32 hex chars from `crypto.getRandomValues`)
- `DEFAULT_INVITE = { subject, message }` (the spec's default wording)

- [ ] Write `inviteMath.check.js` first with `node:assert/strict`: each `inviteStatus` kind; linked beats a failed invite; 7-day boundary (exactly 7 days → expired, 7 days − 1 min → sent); `isInviteUsable` false for `ready`; `fillTemplate` with and without a name; `toTemplate(fillTemplate(x)) === x` for the default; `escapeMessage("<b>&\nx")` === `"&lt;b&gt;&amp;<br>x"`; `newInviteId()` matches `/^[0-9a-f]{32}$/` and two calls differ. Run → fails (module missing). Implement. Run `npm run check` → pass. Commit "Invites: status, template and escaping helpers".

---

### Task 3: EmailJS client + portal store

**Files:** Create `src/admin/lib/emailjs.js`, `src/admin/patients/portalStore.js`; Modify `.env.example` (three `VITE_EMAILJS_*` lines, empty).

**Consumes:** Task 2 helpers. **Produces:**
- `emailjsConfigured: boolean`
- `sendEmail(templateParams) → Promise<void>`; throws `Error(<response text or "Network error">)` on non-2xx/failed fetch.
- `loadPortalAccess(chartId) → Promise<{ invites: Invite[] (newest first), linked: boolean }>`
- `sendInvite({ chartId, to, firstName, subject, message }, actor) → Promise<Invite>`; resolves with the final invite (`sent` or `failed`, never throws on an email failure; throws only if the first save fails).
- `loadInviteTemplate() → Promise<{ subject, message }>` (doc or `DEFAULT_INVITE`)
- `saveInviteTemplate({ subject, message }, actor) → Promise<void>`

`sendInvite` in demo mode keeps invites in `store.invites` (a `Map` created on first use) and, when `emailjsConfigured` is false, records the invite as `sent` (demo fakes success). With Firebase, follows the spec's send sequence; the email call is injectable for the check: `sendInvite(input, actor, { send = sendEmail } = {})`.

- [ ] Check first: extend `src/lib/inviteMath.check.js`? No — store code imports Firebase. Instead the failing-send path is pinned by the Task 4 browser case (demo mode with a stubbed failing `emailjs.js`). Ruling recorded in the ledger.
- [ ] Implement; `npm run lint`, `npm run build` clean. Commit "Invites: EmailJS client and portal store".

---

### Task 4: Portal access box and invite dialog on the chart

**Files:** Create `src/admin/patients/PortalAccess.jsx`, `src/admin/patients/InviteDialog.jsx`; Modify `src/admin/patients/PatientChart.jsx` (render `<PortalAccess chart intake actor />` as the first card of the summary column, before "Current prescriptions").

**Consumes:** Tasks 2–3. Role checks: `canAdmit(actor.role)` to send; `["coAdmin","admin","superAdmin"].includes(actor.role)` for the template checkbox (add `canEditInviteTemplate` to `staff/roles.js` + `roles.check.js`).

Box (a `Card` titled "Patient portal"):
- line 1: the email, or "No email on this intake".
- line 2: status from `inviteStatus` — active "Portal active"; none "Not invited yet"; sending "Not sent yet. Try again."; failed "Not sent: {error}"; sent "Invite sent {date} by {name}. The link works until {date}."; expired "Invite expired {date}."
- action: "Send portal invite" (none) / "Resend invite" (otherwise), only when `canAdmit`, chart active and email present.
- "Earlier invites (n)" `<details>` listing date, by, status for the rest.

Dialog (`Modal`, title "Send portal invite"; form id `portal-invite`):
- To (read-only text), Subject, Message (`textarea rows=9`), fixed note, template checkbox (co-admin+), "Email sending isn't set up yet." when not configured (demo mode exempt).
- Footer: error (role=alert) + **Send invite** (busy "Sending…"). Success closes and reloads the box; a `failed` result keeps the dialog open with "The email didn't send: {error}".
- Prefill: `fillTemplate(template, { firstName, phone: SUPPORT_PHONE })`. Saving the template uses `toTemplate`.
- Audit: `recordAuditEvent({ action: AUDIT_ACTIONS.sendPortalInvite, targetCollection: "patients", targetId: chartId, targetLabel: name })` after a `sent` result; add `sendPortalInvite: "sendPortalInvite"` to `AUDIT_ACTIONS` and its label wherever `AUDIT_ACTIONS` labels live.

- [ ] Browser check first (`<scratchpad>/invite-check.mjs`): Playwright routes `**/src/admin/lib/firebase.js*` through the dev server's own response with `usingSeedData` forced `true`, and (failure case) `**/src/admin/lib/emailjs.js*` with a stub whose `sendEmail` rejects with "Bad template". Cases: box shows "Not invited yet" → Send → dialog prefilled with the patient's first name → Send invite → box shows "Invite sent"; button now "Resend invite"; failure stub → dialog shows "The email didn't send: Bad template" and keeps the text; demo actor switched to provider hides the template checkbox (if the demo can't switch roles, record a ruling and rely on Task 1's rules test); dark theme screenshot; 390 px no horizontal scroll.
- [ ] Implement; check passes; lint, build. Commit "Chart: patient portal box and invite dialog".

---

### Task 5: Docs

- [ ] `docs/client-portal.md`: admin invite built; EmailJS dashboard setup (service, template with `{{to_email}}`, `{{subject}}`, `{{{message_html}}}`, `{{setup_link}}`, public key, allowed origins); `.env` keys; the setup link opens `/portal/setup`, which is the next build, so invites sent now lead to a page that doesn't exist yet.
- [ ] Final: `npm run test:rules`, `npm run check`, `npm run lint`, `npm run build`, browser check. Commit "Docs: portal invites admin side".
