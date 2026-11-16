# Email Templates and Decision Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff-editable patient email templates in the admin, and Admit / Decline / a manual "New email" that email the patient from those templates, once and only after a confirm.

**Architecture:** Templates live in Firestore (`emailTemplates`, with an append-only `versions` subcollection), edited in a new admin page with a TipTap editor that stores JSON. One pure renderer in `functions/emailRender.js` turns a template into `{ subject, html, text }`; the admin imports the same file for its preview. A callable function `sendPatientEmail` checks the caller's role, guards against duplicates in a transaction, sends through the existing Gmail SMTP path, and for decisions sets the intake status. `notifyNewIntake` reads the default Welcome template, falling back to built-in wording.

**Tech Stack:** React 19, Vite 8, Tailwind v4, Firebase 12 (Firestore, Functions client), Cloud Functions v2 (Node 22, `firebase-functions` 7, `firebase-admin` 14, `nodemailer`), TipTap 3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`).

**Spec:** `docs/superpowers/specs/2026-11-16-email-templates-design.md`

## Global Constraints

- Purposes are exactly `accepted`, `declined`, `welcome`, `manual`; labels Accepted, Declined, Welcome, New email.
- Template statuses are exactly `draft`, `published`. A default must be published. Drafts are never sent or offered in pickers.
- Edit / publish / delete / restore / test-send: `admin` and `superAdmin` only. Open the page and send decision or manual emails: admitters (`provider`, `coAdmin`, `admin`, `superAdmin`).
- Only one decision email per intake, ever: once `accepted` or `declined` was sent, neither can be sent again; the status can still change.
- The only patient value in an email is the first name. No intake answers, ever.
- Allowed formatting: bold, italic, underline, bulleted list, numbered list, link, hard break, the first-name chip. No colours, fonts, sizes, headings, images.
- Allowed link hosts: `corephia.com` and `www.corephia.com` (https), any `*.elationemr.com` and `*.elationpassport.com` (https). Others render as plain text.
- Every email gets, appended and not editable: `Questions? Call us at +1 (866) 849-2673 or email care@corephia.com.` and `For your privacy, this email doesn't include any of your health information.`
- Visitor-facing copy: no em dashes; "form", not "intake"; brand "CorePhia".
- Functions region `us-central1`; secrets: `SMTP_PASSWORD` only.
- Audit actions added in three places in step: `AUDIT_ACTIONS` (`src/admin/lib/firebase.js`), the `isOwnAuditEntry` list in `firestore.rules`, `ACTION_LABELS` (`src/admin/staff/Activity.jsx`).
- `firestore.rules` edited from a script: use `split(a).join(b)`, never `String.replace`; no byte-order mark.
- Admin UI: dialogs through `ui/useDialog.js` (Cancel focused first), inputs from `ui/formUi.js`, hover = colour only, dark mode blue text uses `accent-text`.

## Review Focus

1. **Double click on "Decline and send email"** (or two staff at once): exactly one email; the second call returns `already-exists`. Test in Task 2 (`planSend` with a `sending` claim) and the button is disabled while the call runs (Task 7).
2. **Intake with no or invalid email:** the dialog says so and offers only "Change status without email"; the function returns `failed-precondition` rather than throwing an SMTP error. Tests in Task 2 and Task 7.
3. **A name or subject containing `<script>` or `&`:** escaped in HTML, unchanged in text. Test in Task 1.
4. **Text pasted from Word or a web page** (headings, colours, images, outside links): the editor schema drops what isn't allowed, and the renderer ignores unknown nodes and outside links even if they reach the database. Test in Task 1 (renderer on a hostile tree).
5. **Saving the default as a draft, or deleting the default:** refused in the UI with a reason; the function also ignores drafts. Tests in Task 4 (`validateTemplate`) and Task 2.

---

### Task 1: Renderer and default wording

**Files:**
- Create: `functions/emailRender.js`
- Create: `functions/emailDefaults.js`
- Modify: `functions/emails.js` (export `layout`, `PHONE`; drop `intakeReceipt` case into the defaults)
- Test: `functions/emailRender.check.js`; add to `npm run check` in `package.json`

**Interfaces:**
- Produces:
  - `renderTemplate(template, { firstName }) -> { subject: string, html: string, text: string }` where `template = { subject, headline, body }` and `body` is TipTap JSON (`{ type: "doc", content: [...] }`).
  - `isAllowedLink(href: string) -> boolean`
  - `plainText(body) -> string` (paragraphs joined by `\n\n`, list items prefixed `- ` or `1. `; used for diff and text part)
  - `PURPOSES = ["accepted", "declined", "welcome", "manual"]`, `PURPOSE_LABELS = { accepted: "Accepted", declined: "Declined", welcome: "Welcome", manual: "New email" }`
  - `DEFAULT_TEMPLATES`: array of three `{ name, purpose, status: "published", isDefault: true, subject, headline, body }` (Accepted "Welcome aboard", Declined "Not the right fit", Welcome "Welcome to CorePhia") with the exact wording from the spec's "Starting content"; Welcome reuses today's `intakeReceipt` paragraphs minus the "Questions?" and privacy lines (now appended).
  - `layout({ title, paragraphs, button, after })` stays the email shell; `renderTemplate` builds its HTML body inside the same card markup (export a variant `layoutHtml(title, innerHtml)` if `layout` only takes strings).

- [ ] **Step 1: Write the failing check `functions/emailRender.check.js`**

```js
import assert from "node:assert/strict"
import { renderTemplate, isAllowedLink, plainText } from "./emailRender.js"
import { DEFAULT_TEMPLATES } from "./emailDefaults.js"

const doc = (...content) => ({ type: "doc", content })
const p = (...content) => ({ type: "paragraph", content })
const t = (text, marks) => ({ type: "text", text, ...(marks && { marks }) })
const name = { type: "firstName" }

// first name, escaping, fixed lines
const r = renderTemplate({ subject: "Hi {firstName} & co", headline: "Thank you, {firstName}", body: doc(p(t("Dear "), name, t("."))) }, { firstName: "<Jo>" })
assert.equal(r.subject, "Hi <Jo> & co")
assert.ok(r.html.includes("Thank you, &lt;Jo&gt;"))
assert.ok(r.html.includes("Dear &lt;Jo&gt;."))
assert.ok(!r.html.includes("<Jo>"))
assert.ok(r.text.includes("Dear <Jo>."))
assert.ok(r.text.includes("Questions? Call us at +1 (866) 849-2673 or email care@corephia.com."))
assert.ok(r.text.includes("For your privacy, this email doesn't include any of your health information."))
// empty name falls back to "there"
assert.ok(renderTemplate({ subject: "s", headline: "Hi {firstName}", body: doc() }, { firstName: "  " }).html.includes("Hi there"))

// marks and lists
const marked = renderTemplate({ subject: "s", headline: "h", body: doc(
  p(t("b", [{ type: "bold" }]), t("i", [{ type: "italic" }]), t("u", [{ type: "underline" }])),
  { type: "bulletList", content: [{ type: "listItem", content: [p(t("one"))] }] },
  { type: "orderedList", content: [{ type: "listItem", content: [p(t("first"))] }] },
) }, { firstName: "A" })
for (const s of ["<strong>b</strong>", "<em>i</em>", "<u>u</u>", "<ul", "<ol", "one", "first"]) assert.ok(marked.html.includes(s), s)
assert.ok(marked.text.includes("- one") && marked.text.includes("1. first"))

// links: allowed vs not
assert.ok(isAllowedLink("https://corephia.com/guides/x"))
assert.ok(isAllowedLink("https://app.elationemr.com/membership/1"))
assert.ok(isAllowedLink("https://x.elationpassport.com/"))
for (const bad of ["http://corephia.com", "https://corephia.com.evil.io", "javascript:alert(1)", "https://evil.io"]) assert.equal(isAllowedLink(bad), false, bad)
const linked = renderTemplate({ subject: "s", headline: "h", body: doc(p(
  t("good", [{ type: "link", attrs: { href: "https://corephia.com/faq" } }]),
  t("bad", [{ type: "link", attrs: { href: "https://evil.io" } }]),
)) }, { firstName: "A" })
assert.ok(linked.html.includes('href="https://corephia.com/faq"'))
assert.ok(!linked.html.includes("evil.io") && linked.html.includes("bad"))

// hostile tree: unknown nodes and marks are ignored, their text kept
const hostile = renderTemplate({ subject: "s", headline: "h", body: doc(
  { type: "heading", content: [t("Big")] },
  { type: "image", attrs: { src: "https://evil.io/x.png" } },
  p(t("red", [{ type: "textStyle", attrs: { color: "red" } }])),
) }, { firstName: "A" })
assert.ok(hostile.html.includes("Big") && hostile.html.includes("red"))
assert.ok(!hostile.html.includes("img") && !hostile.html.includes("color"))

assert.equal(plainText(doc(p(t("a")), p(t("b")))), "a\n\nb")

// defaults: three, one per purpose, render without throwing, no em dashes
assert.deepEqual(DEFAULT_TEMPLATES.map((d) => d.purpose).sort(), ["accepted", "declined", "welcome"])
for (const d of DEFAULT_TEMPLATES) {
  const out = renderTemplate(d, { firstName: "Jane" })
  assert.ok(!/[—]/.test(out.text), d.name)
}
assert.ok(renderTemplate(DEFAULT_TEMPLATES.find((d) => d.purpose === "declined"), { firstName: "Jane" }).html.includes("<strong>Your card has not been charged, and it won't be.</strong>"))
console.log("emailRender: ok")
```

- [ ] **Step 2: Run it to see it fail**

Run: `node functions/emailRender.check.js`
Expected: FAIL, `Cannot find module './emailRender.js'`

- [ ] **Step 3: Implement `functions/emailRender.js` and `functions/emailDefaults.js`**

Pure ES modules, no imports beyond `./emails.js` (for the card shell and `PHONE`). Walker: a `switch` on node `type` for the allowed nodes; any other node renders its children (text kept, element dropped). Marks applied innermost-first in a fixed order (link, underline, italic, bold). `{firstName}` in subject and headline is a literal string replace; in the body it is the `firstName` node. Escape `& < > " '` in HTML. Lists in HTML use `style="margin:0 0 16px;padding-left:22px"` to match the card's paragraphs.

- [ ] **Step 4: Point `buildEmail("intakeReceipt")` at the Welcome default**

`intakeReceipt` returns `renderTemplate(DEFAULT_TEMPLATES welcome, { firstName })` with `to`. `functions/emails.check.js` still passes (it checks "We've received your form" and no `<a href`); update its call to pass `firstName: "A"` if the signature needs it.

- [ ] **Step 5: Run checks**

Run: `node functions/emailRender.check.js; node functions/emails.check.js`
Expected: `emailRender: ok`, `emails: ok`

- [ ] **Step 6: Add `node functions/emailRender.check.js` to the `check` script, run `npm run check`, commit**

```bash
git add functions/emailRender.js functions/emailDefaults.js functions/emails.js functions/emailRender.check.js functions/emails.check.js package.json
git commit -m "feat(email): template renderer and default wording"
```

---

### Task 2: `sendPatientEmail` and the Welcome template

**Files:**
- Create: `functions/patientEmail.js` (pure decision logic)
- Modify: `functions/index.js`
- Test: `functions/patientEmail.check.js`; add to `npm run check`

**Interfaces:**
- Consumes: `renderTemplate`, `DEFAULT_TEMPLATES` (Task 1).
- Produces:
  - `planSend({ mode, role, intake, template, callerEmail }) -> { ok: true, to, kind, nextStatus? } | { ok: false, code, message }`, where `code` is a Firebase `HttpsError` code: `permission-denied`, `not-found`, `failed-precondition`, `already-exists`, `invalid-argument`.
    - `mode: "decision"`: `role` admitter; `template.status === "published"`; `template.purpose` in `accepted|declined`; `intake.patientEmails?.accepted` and `?.declined` both absent (any `state`, including `"sending"`), else `already-exists` with message naming which was sent and when; valid email else `failed-precondition` "This applicant has no valid email address."; `nextStatus` = `admitted` | `declined`; `to` = trimmed lowercase intake email.
    - `mode: "manual"`: admitter; published `manual` template; valid email.
    - `mode: "test"`: `role` in `admin|superAdmin`; any status; `to = callerEmail`.
  - Callable `sendPatientEmail` (export from `index.js`), request `{ mode, templateId, intakeId? }`, response `{ sentAt: ISO string, to }`. Steps: read `user/{uid}.role`; read template and intake; `planSend`; for `decision`, a transaction re-reads the intake, re-runs `planSend`, writes `patientEmails.<kind> = { state: "sending", templateId, by: uid }`; send via existing `send()`; on success update `patientEmails.<kind> = { state: "sent", templateId, sentAt: serverTimestamp(), sentBy: <name or email> }` and `status: nextStatus`; on SMTP failure delete `patientEmails.<kind>` and throw `unavailable` "The email couldn't be sent. Nothing was changed. Try again.". `manual` uses `FieldValue.arrayUnion` on `patientEmails.manual` with `{ templateId, sentAt: ISO, sentBy }`, capped to the last 20 (read, slice, write in the transaction). Every successful send writes an `auditLog` doc `{ actorUid, actorEmail, action: "send_patient_email", targetCollection: "intakeRecords" (or "emailTemplates" for test), targetId, targetLabel: "<purpose label> email", at: serverTimestamp() }` with the admin SDK.
  - `notifyNewIntake`: receipt reads the published `isDefault` `welcome` template (first by `updatedAt` desc if more than one), falling back to `DEFAULT_TEMPLATES` welcome on any read error; passes `firstName` from `demographics.firstName`.

- [ ] **Step 1: Write the failing check `functions/patientEmail.check.js`**

```js
import assert from "node:assert/strict"
import { planSend } from "./patientEmail.js"

const intake = (extra = {}) => ({ status: "pending", demographics: { email: " Pat@X.co ", firstName: "Pat" }, ...extra })
const tpl = (purpose, status = "published") => ({ purpose, status })
const base = { mode: "decision", role: "provider", intake: intake(), template: tpl("declined") }

assert.deepEqual(planSend(base), { ok: true, to: "pat@x.co", kind: "declined", nextStatus: "declined" })
assert.equal(planSend({ ...base, template: tpl("accepted") }).nextStatus, "admitted")
assert.equal(planSend({ ...base, role: "dietitian" }).code, "permission-denied")
assert.equal(planSend({ ...base, template: tpl("declined", "draft") }).code, "failed-precondition")
assert.equal(planSend({ ...base, template: tpl("manual") }).code, "invalid-argument")
assert.equal(planSend({ ...base, intake: intake({ demographics: { email: "nope" } }) }).code, "failed-precondition")
// once per intake, either kind, including an in-flight claim
assert.equal(planSend({ ...base, intake: intake({ patientEmails: { accepted: { state: "sent" } } }) }).code, "already-exists")
assert.equal(planSend({ ...base, intake: intake({ patientEmails: { declined: { state: "sending" } } }) }).code, "already-exists")
// manual
assert.equal(planSend({ ...base, mode: "manual", template: tpl("manual") }).ok, true)
assert.equal(planSend({ ...base, mode: "manual", template: tpl("declined") }).code, "invalid-argument")
assert.equal(planSend({ ...base, mode: "manual", template: tpl("manual"), intake: intake({ patientEmails: { declined: { state: "sent" } } }) }).ok, true)
// test
assert.equal(planSend({ mode: "test", role: "provider", template: tpl("declined", "draft"), callerEmail: "a@b.co" }).code, "permission-denied")
assert.deepEqual(planSend({ mode: "test", role: "admin", template: tpl("declined", "draft"), callerEmail: "a@b.co" }), { ok: true, to: "a@b.co", kind: "test" })
console.log("patientEmail: ok")
```

- [ ] **Step 2: Run it to see it fail**

Run: `node functions/patientEmail.check.js`
Expected: FAIL, module not found

- [ ] **Step 3: Implement `planSend` in `functions/patientEmail.js`**, then the callable and the `notifyNewIntake` change in `functions/index.js` (`onCall` from `firebase-functions/v2/https` with `{ ...OPTIONS }`; `getFirestore`, `FieldValue` from `firebase-admin/firestore`). `send()` accepts an already-built `{ to, subject, html, text }`.

- [ ] **Step 4: Run checks**

Run: `npm run check`
Expected: every line ends `ok` / `passed`

- [ ] **Step 5: Commit**

```bash
git add functions/patientEmail.js functions/patientEmail.check.js functions/index.js package.json
git commit -m "feat(email): sendPatientEmail callable and Welcome from template"
```

---

### Task 3: Rules, audit actions, rules tests

**Files:**
- Modify: `firestore.rules`
- Modify: `src/admin/lib/firebase.js` (`AUDIT_ACTIONS`)
- Modify: `src/admin/staff/Activity.jsx` (`ACTION_LABELS`)
- Test: `tests/firestore.rules.test.js`

**Interfaces:**
- Produces:
  - `AUDIT_ACTIONS.saveEmailTemplate = "save_email_template"`, `deleteEmailTemplate = "delete_email_template"`, `restoreEmailTemplate = "restore_email_template"`, `sendPatientEmail = "send_patient_email"`; labels "Saved an email template", "Deleted an email template", "Restored an email template version", "Sent a patient email".
  - Rules:
    - `function isTemplateEditor() { return role() in ['admin', 'superAdmin']; }`
    - `function isWellFormedTemplate(d)`: keys exactly `name, purpose, status, isDefault, subject, headline, body, updatedAt, updatedBy`; `purpose in ['accepted','declined','welcome','manual']`; `status in ['draft','published']`; `isDefault is bool`; `!(isDefault && status == 'draft')`; `!(isDefault && purpose == 'manual')`; `name` 1..80, `subject` 1..200, `headline` 1..200 strings; `body is map`; `updatedAt == request.time`; `updatedBy == myName()`.
    - `match /emailTemplates/{id}`: read `isAdmitter()`; create, update `isTemplateEditor() && isWellFormedTemplate(request.resource.data)`; delete `isTemplateEditor() && !resource.data.isDefault`.
    - `match /emailTemplates/{id}/versions/{v}`: read `isAdmitter()`; create `isTemplateEditor() && isWellFormedTemplate(request.resource.data)`; update, delete `false`.
    - `isStatusUpdate()` unchanged, so clients still cannot write `patientEmails` (it is not in `hasOnly(['status','adminNote'])`).

- [ ] **Step 1: Add failing tests** in a new `describe("email templates")`:
  - admin and superAdmin can create a well-formed template; coAdmin, provider, dietitian cannot.
  - provider can read templates; dietitian cannot.
  - draft + `isDefault: true` refused; `manual` + `isDefault: true` refused; extra key refused; `updatedBy` not `myName()` refused.
  - deleting the default refused; deleting a non-default allowed for admin.
  - version create allowed for admin, update and delete refused for everyone including superAdmin.
  - an admitter's update of `intakeRecords/pending1` adding `patientEmails` is refused.
  - audit entry with `action: "send_patient_email"` accepted for a clinical user.

- [ ] **Step 2: Run them to see them fail**

Run: `npm run test:rules`
Expected: the new tests FAIL (deny-all), the existing 47 pass.

- [ ] **Step 3: Add the rules, audit actions and labels**

- [ ] **Step 4: Run all checks**

Run: `npm run test:rules; npm run check`
Expected: all rules tests pass; `auditActions: all checks passed`

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.js src/admin/lib/firebase.js src/admin/staff/Activity.jsx
git commit -m "feat(rules): email templates, versions, send audit action"
```

---

### Task 4: Admin data layer

**Files:**
- Create: `src/admin/emails/templateStore.js`
- Create: `src/admin/emails/templateMath.js` (pure)
- Test: `src/admin/emails/templateMath.check.js`; add to `npm run check`

**Interfaces:**
- Consumes: `DEFAULT_TEMPLATES`, `PURPOSES`, `PURPOSE_LABELS` (import from `../../../functions/emailDefaults.js` / `emailRender.js`); `AUDIT_ACTIONS`, `recordAuditEvent`, `usingSeedData`, the Firestore `db` (export `db` and `app` from `lib/firebase.js` if not already).
- Produces (`templateMath.js`):
  - `validateTemplate(t) -> string | null` (reason, or null): empty name/subject/headline; default while draft ("A default template has to be published."); default on `manual` ("New email templates have no default."); body with no text ("Write a message first.").
  - `groupByPurpose(templates) -> { accepted: T[], declined: T[], welcome: T[], manual: T[] }`, each sorted default first, then name.
  - `pickable(templates, purpose) -> T[]` published only, default first.
  - `diffWords(a: string, b: string) -> Array<{ type: "same"|"add"|"remove", text: string }>` (LCS over whitespace-split words; `ponytail: O(n·m), fine for short emails`).
- Produces (`templateStore.js`):
  - `watchTemplates(onChange, onError) -> unsubscribe`
  - `saveTemplate(id | null, fields, actorName) -> id`: one `writeBatch`: the template (with `updatedAt: serverTimestamp()`, `updatedBy: actorName`), a new `versions` doc with the same fields, and, when `fields.isDefault`, `isDefault: false` on every other template of that purpose (each also gets a version). Audit `saveEmailTemplate`.
  - `deleteTemplate(id)`; audit `deleteEmailTemplate`.
  - `loadVersions(id) -> Version[]` newest first, limit 50.
  - `restoreVersion(id, version, actorName)`: `saveTemplate` with the version's fields, keeping the template's current `isDefault`; audit `restoreEmailTemplate`.
  - `seedDefaultsIfEmpty(actorName)`: if no templates exist, `saveTemplate(null, d)` for each `DEFAULT_TEMPLATES` entry.
  - `sendPatientEmail({ mode, templateId, intakeId }) -> { sentAt, to }`: `httpsCallable(getFunctions(app, "us-central1"), "sendPatientEmail")`.
  - Demo mode (`usingSeedData`): an in-memory list seeded from `DEFAULT_TEMPLATES` plus one Declined "Outside Florida" and one manual "Checking in"; `sendPatientEmail` resolves `{ sentAt: new Date().toISOString(), to: "demo@example.com" }` after 400 ms.

- [ ] **Step 1: Write the failing check** for `validateTemplate` (each reason above, and null for a valid default), `groupByPurpose` order, `pickable` excluding drafts, and `diffWords("a b c", "a x c")` → `[same "a", remove "b", add "x", same "c"]`.
- [ ] **Step 2: Run it to see it fail** — `node src/admin/emails/templateMath.check.js`, module not found.
- [ ] **Step 3: Implement both files.**
- [ ] **Step 4: Run** `npm run check` — all ok.
- [ ] **Step 5: Commit** `feat(admin): email template store and helpers`.

---

### Task 5: The editor

**Files:**
- Modify: `package.json` (add `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, all `^3`)
- Create: `src/admin/emails/MessageEditor.jsx`
- Create: `src/admin/emails/firstNameNode.js`

**Interfaces:**
- Produces: `<MessageEditor value={json} onChange={(json) => …} readOnly={bool} />`.
  - StarterKit with `heading`, `blockquote`, `codeBlock`, `code`, `horizontalRule`, `strike` off; `link: { openOnClick: false, autolink: false, protocols: ["https"], isAllowedUri: (url) => isAllowedLink(url) }`; `underline` on.
  - `firstNameNode`: `Node.create({ name: "firstName", group: "inline", inline: true, atom: true })`, rendered as a chip `<span data-first-name class="…">first name</span>`, parsed back from `span[data-first-name]`.
  - Toolbar (`role="toolbar"`, `aria-label="Formatting"`), icon buttons with `aria-label` and `title` including the shortcut: Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Bulleted list, Numbered list, Link (Ctrl+K), Clear formatting, Undo (Ctrl+Z), Redo (Ctrl+Y); right end "+ First name". Active marks use `aria-pressed`. SVG icons added to `src/admin/ui/icons.jsx`, not emoji.
  - Link button opens a small popover (Link address input, "Only links to corephia.com or Elation." hint, Remove link, Apply); Apply is disabled and shows "That address isn't allowed." when `isAllowedLink` fails.

- [ ] **Step 1: Install** — `npm install @tiptap/react@^3 @tiptap/pm@^3 @tiptap/starter-kit@^3`; confirm `package.json` shows them.
- [ ] **Step 2: Implement** the node and the editor.
- [ ] **Step 3: Browser check** (after Task 6 mounts it): paste `<h1>Big</h1><p style="color:red">red</p><img src=x>` and confirm the editor shows two plain paragraphs and no image; Ctrl+B toggles bold and `aria-pressed`.
- [ ] **Step 4: Run** `npm run lint` — no new errors.
- [ ] **Step 5: Commit** `feat(admin): TipTap message editor`.

---

### Task 6: Email templates page

**Files:**
- Create: `src/admin/emails/EmailTemplates.jsx` (page: list, editor, preview)
- Create: `src/admin/emails/TemplateHistory.jsx` (slide-in panel, compare, restore)
- Modify: `src/admin/staff/roles.js` (`PAGE_ROLES.emailTemplates = ADMITTERS`, export `canEditTemplates = (role) => ["admin","superAdmin"].includes(role)`)
- Modify: `src/admin/staff/roles.check.js` (assert both)
- Modify: `src/admin/AdminApp.jsx` (route `/admin/emails`, `React.lazy` import so TipTap loads only here)
- Modify: `src/admin/layout/Sidebar.jsx` ("Email templates" in the website group after Analytics)

**Interfaces:**
- Consumes: Task 4 store and math, Task 5 editor, `renderTemplate` for the preview (sample name "Jane", recipient "jane.doe@example.com").
- Layout and copy as the approved mockup (`email-editor-v3-mockup.html`, described in the spec's "Admin page"):
  - Header "Email templates", "Every email patients get from CorePhia. Changes apply to the next email sent.", primary "New template" (editors only).
  - List: search; groups in `PURPOSES` order with counts; status dot + "Default" / "Published" / "Draft, never sent"; selected item has the left accent bar. Empty group: "No templates for {label} yet", "Until there is one, the built-in wording is sent." (Welcome) or "Nothing can be sent for {label} until one is published." (others).
  - Editor: name as heading; badge "Default for {label}"; History; ⋯ menu (Duplicate, Delete); Used for and Status selects (the shared `src/components/Select.jsx`, pop-up over the page); Subject line; Headline; Message; the fixed-parts note; the compliance warning "Keep it general. No health details, and medication only ever as part of the program."; sticky bar "Unsaved changes" + Discard + Save changes; `validateTemplate` reason shown above the bar and Save disabled while there is one.
  - Preview: Desktop / Phone switch (phone = 375 px frame); "Send me a test" (editors only) → toast "Test sent to {email}".
  - Read only for non-editors: every field disabled, no buttons, a line "Only the admin and super admin can change these emails."
  - On first open by an editor, `seedDefaultsIfEmpty`.
  - Unsaved changes: switching template or leaving the page asks "Discard your changes to {name}?" (ConfirmDialog).
  - Delete asks first; refused for the default with "Make another template the default first."
  - History panel: versions newest first (who, when); Compare shows `diffWords(plainText(old), plainText(live))` with removed in red strikethrough, added in green; Restore asks first, then `restoreVersion`.

- [ ] **Step 1: Add the roles assertions** (`canOpen("emailTemplates","provider") === true`, `"dietitian" === false`, `canEditTemplates("coAdmin") === false`, `"admin" === true`); run `node src/admin/staff/roles.check.js` → FAIL.
- [ ] **Step 2: Implement roles, route, sidebar, page and history.**
- [ ] **Step 3: Run** `npm run check; npm run lint` — pass.
- [ ] **Step 4: Browser check in demo mode** (CLAUDE.md "Testing the admin without a login", port 5190): `/admin/emails?demoRole=admin` — seeded groups show; edit Declined, preview updates; save as draft while default shows the reason; make "Outside Florida" default and the old one loses its badge; History lists versions and Compare highlights; `?demoRole=provider` is read only; `?demoRole=dietitian` has no sidebar entry. Scroll before screenshots. Stop the server and `git clean -fdq .playwright-mcp`.
- [ ] **Step 5: Commit** `feat(admin): Email templates page`.

---

### Task 7: Admit, Decline and New email on Applicants

**Files:**
- Create: `src/admin/applicants/PatientEmailDialog.jsx`
- Create: `src/admin/applicants/patientEmailState.js` (pure) + `patientEmailState.check.js` (add to `npm run check`)
- Modify: `src/admin/applicants/ApplicantModal.jsx` (Admit / Decline open the dialog; "Send email" button; sent line)
- Modify: `src/admin/applicants/Applicants.jsx` (`updateStatus` keeps status-only path; new `afterEmailSent(record, patch)` updates local state)

**Interfaces:**
- Consumes: `sendPatientEmail`, `watchTemplates`, `pickable` (Task 4); `renderTemplate` for Preview.
- Produces:
  - `emailDialogState(record, purpose) -> { kind: "send" } | { kind: "noEmail" } | { kind: "alreadySent", sentKind, sentAt }`; `purpose` `accepted|declined|manual`; `manual` never returns `alreadySent`.
  - `sentLines(record) -> string[]`, e.g. `"Acceptance email sent Nov 16, 2026, 2:14 PM"`, `"Decline email sent …"`, `"Email sent: {template name or 'New email'} …"` (uses `formatStamp`).
- Dialog copy:
  - Title "Admit {full name}?" / "Decline {full name}?" / "Email {full name}".
  - `send`: "Choose the email {first name} gets at {email}." then radio cards of `pickable` templates (default preselected; subject under the name), a Preview link (opens the rendered email in a modal), Cancel focused, confirm "Admit and send email" (accent) / "Decline and send email" (red) / "Send email". No published template: "There's no published {label} template yet." and only "Change status without email".
  - `noEmail`: "{first name} has no valid email address, so no email can be sent." confirm "Change status without email".
  - `alreadySent`: "{first name} already received the {acceptance|decline} email on {date}. Contact them directly to explain the change." confirm "Change status".
  - On `unavailable` / other errors: show the message from the function, and two buttons "Try again" and "Change status without email" (decisions only).
  - While sending: confirm disabled, label "Sending…", Escape waits (ConfirmDialog `confirmDisabled`).
- Pending and Discharge keep the one-click status change. Clicking the current status does nothing.

- [ ] **Step 1: Write the failing check** for `emailDialogState` (each state; `manual` with a decline already sent → `send`; invalid email → `noEmail`; `patientEmails.accepted.state === "sending"` → `alreadySent`) and `sentLines`; run → FAIL.
- [ ] **Step 2: Implement** the helper, dialog, and modal changes.
- [ ] **Step 3: Run** `npm run check; npm run lint` — pass.
- [ ] **Step 4: Browser check in demo mode** `/admin/applicants?demoRole=provider`: Decline opens the dialog with the default preselected; Enter on open does nothing (Cancel focused); send shows "Decline email sent …"; Admit afterwards shows the already-sent message and only changes status; the seeded record with no email shows `noEmail`; Pending is still one click; dietitian sees no buttons.
- [ ] **Step 5: Commit** `feat(admin): decision and manual patient emails on Applicants`.

---

### Task 8: Help, legal, docs, final verification

**Files:**
- Modify: `src/admin/help/Help.jsx` ("What emails go out": add acceptance, decline and New email; drop "No email goes out on admit or decline."; new topic "Edit patient emails" shown to admitters, steps for templates, default, drafts, first name, history, test)
- Modify: `src/pages/Legal.jsx` (privacy policy and notice: we email you when your form is received and when a decision is made, and may send other program emails; these never include health information)
- Modify: `CLAUDE.md` (Email section: `sendPatientEmail`, templates, the once-only rule; Admin pages list; Roles; Elation section's "Admit is a status change only")
- Modify: `functions/emails.js` header comment and Help/Legal wording via the `humanizer` skill (visitor-facing copy)

- [ ] **Step 1: Update Help, Legal, CLAUDE.md.**
- [ ] **Step 2: Full verification**

Run: `npm run lint; npm run check; npm run test:rules; npm run build`
Expected: lint clean of new errors; every check `ok`; all rules tests pass; build succeeds and prerender reports every page.

- [ ] **Step 3: Real send test (before deploy, with Louie's go-ahead):** deploy functions to the live project only when Louie asks; then send a test from the Email templates page to a corephia.com mailbox and check it in Gmail on desktop and phone.
- [ ] **Step 4: Commit** `docs: patient emails in Help, legal pages and CLAUDE.md`.

Deploy note (for Louie, not part of this plan): rules, hosting and functions go together (`firebase deploy --only hosting,firestore:rules,functions`); the Declined wording needs Dr. Antonious's OK before real patients.
