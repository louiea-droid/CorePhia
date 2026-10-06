# Portal Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patients and the care team exchange messages in subject-based topics: a new admin page `/admin/messages` (shared inbox) and `/account/messages` in the portal, with "new message" emails both ways that never carry content.

**Architecture:** Topics live at `patients/{chartId}/topics/{topicId}` with a `messages` subcollection. Every write is a batch (topic summary + message) that `firestore.rules` ties together; staff read across charts with a collection-group rule. Live lists use Firestore listeners. The portal gains a small router (`PortalApp.jsx`); the admin gains `src/admin/inbox/`. EmailJS moves to `src/lib/` and gets a shared "portal notice" template plus a fixed-recipient "staff notice" template.

**Tech Stack:** React 19, react-router-dom v7, Tailwind v4, Firebase Firestore modular SDK v12 (`onSnapshot`, `collectionGroup`, `writeBatch`), EmailJS REST, `@firebase/rules-unit-testing` + `node --test`, `node:assert` self-checks, Playwright in the session scratchpad.

**Spec:** `docs/superpowers/specs/2026-10-06-portal-messages-design.md`

## Global Constraints

- Messages are PHI. Emails never carry a name, subject or message text.
- Messages and topics are never edited or deleted. Subject 1–120 characters; body 1–2000.
- Patient copy: "CorePhia", no em dashes, plain words; patients see "conversation", staff see "topic". Every compose area shows "For anything urgent, call us at {SUPPORT_PHONE}. In an emergency, call 911."
- Patient-facing roles: provider → Provider, dietitian → Dietitian, admin → Provider, coAdmin and superAdmin → Care team.
- Only an active chart can start or add to topics; inactive charts' topics stay readable.
- No new dependencies. Admin tokens and dark mode (`text-accent-text` for blue text); site tokens in the portal. Hover = colour only.
- Staff store functions have a `usingSeedData` branch (`getDemoStore()`, `demoId()`).
- Env: `VITE_EMAILJS_PORTAL_TEMPLATE_ID` (replaces `VITE_EMAILJS_UPDATE_TEMPLATE_ID`), `VITE_EMAILJS_STAFF_TEMPLATE_ID`.
- Per CLAUDE.md, load the skills each task needs before it (UI: `frontend-design`, `ui-design-system`, `ui-ux-pro-max`; React: `react-best-practices`, `senior-frontend`; copy: `humanizer`; browser: `playwright-cli`; `superpowers:verification-before-completion` before calling it done). Louie runs the dev server.

## Review Focus

1. **A patient sends three messages in a row** before staff answer: one info@ email, not three (only when the topic newly needs a reply). Pinned in Task 2 (`notifiesStaff`) and Task 8 browser check (stub counts staff notices).
2. **A topic closed by the patient, then the patient writes again**: it reopens and info@ is emailed (it newly needs a reply). Pinned in Task 2.
3. **Two staff open the same topic at once and both reply**: both messages save (each batch moves the topic to its own message); the list shows the later one. Pinned in Task 1 (two consecutive replies both succeed).
4. **A patient whose chart goes inactive while a conversation is open**: the compose area is replaced with "Messaging is closed…", sends are refused by the rules. Pinned in Task 1 (inactive refused) and Task 8 (inactive stub).
5. **Message text with HTML or very long words**: shown as text, wraps without breaking the layout at 390 px. Pinned in Task 5 and Task 8 browser checks.

---

### Task 1: Rules for topics and messages

**Files:**
- Modify: `firestore.rules` (a database-level `isLinkedTo(chartId)` helper; patients/{chartId} read for the linked patient; `match /topics/{topicId}` with `messages` inside `match /patients/{chartId}`; a collection-group `match /{path=**}/topics/{topicId}` at database level)
- Test: `tests/firestore.rules.test.js` (import `collectionGroup`; new `describe("portal messages")`; header count)

**Interfaces:**
- Produces: the shapes in the spec. A topic is created only in a batch with its first message (`lastMessageId`); a message only in a batch that moves its topic (`lastMessageId == messageId`, `lastMessageAt == request.time`).

- [x] **Step 1: Write the failing tests.** Add `collectionGroup` to the `firebase/firestore` import list. Append:

```js
describe("portal messages", () => {
  const asPatient = (uid, email) => env.authenticatedContext(uid, { email }).firestore()
  const topicRef = (db, id = "t1", chart = "chart1") => doc(db, `patients/${chart}/topics/${id}`)
  const msgRef = (db, topic, id, chart = "chart1") => doc(db, `patients/${chart}/topics/${topic}/messages/${id}`)
  const staffFrom = (uid = "provider", role = "provider", name = uid) => ({ kind: "staff", uid, name, role })
  const patientFrom = (uid = "patient1") => ({ kind: "patient", uid })
  const newTopic = (side, overrides = {}) => ({
    subject: "About my plan",
    status: "open",
    startedBy: side,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastFrom: side,
    lastMessageId: "m1",
    patientReadAt: side === "patient" ? serverTimestamp() : null,
    staffReadAt: side === "staff" ? serverTimestamp() : null,
    closed: null,
    ...overrides,
  })
  const newMessage = (from, overrides = {}) => ({ body: "Hello", from, createdAt: serverTimestamp(), email: "none", ...overrides })
  const start = (db, side, from, { topic = {}, message = {}, chart = "chart1" } = {}) => {
    const batch = writeBatch(db)
    batch.set(topicRef(db, "t1", chart), newTopic(side, topic))
    batch.set(msgRef(db, "t1", "m1", chart), newMessage(from, message))
    return batch.commit()
  }
  const reply = (db, side, from, messageId, { topic = {}, message = {} } = {}) => {
    const batch = writeBatch(db)
    batch.update(topicRef(db), {
      lastMessageAt: serverTimestamp(),
      lastFrom: side,
      lastMessageId: messageId,
      status: "open",
      closed: null,
      [side === "staff" ? "staffReadAt" : "patientReadAt"]: serverTimestamp(),
      ...topic,
    })
    batch.set(msgRef(db, "t1", messageId), newMessage(from, message))
    return batch.commit()
  }
  const seedTopic = (overrides = {}) =>
    env.withSecurityRulesDisabled((c) =>
      setDoc(topicRef(c.firestore()), {
        ...newTopic("patient"),
        createdAt: new Date(),
        lastMessageAt: new Date(),
        patientReadAt: new Date(),
        ...overrides,
      }),
    )
  const seedMessage = (id, data) => env.withSecurityRulesDisabled((c) => setDoc(msgRef(c.firestore(), "t1", id), data))

  test("a patient or a clinician starts a topic with its first message", async () => {
    await assertSucceeds(start(asPatient("patient1", "p1@x.co"), "patient", patientFrom()))
  })
  test("staff start topics as themselves; the dietitian too", async () => {
    await assertSucceeds(start(as("dietitian"), "staff", staffFrom("dietitian", "dietitian")))
  })
  test("a topic or a message alone is refused", async () => {
    const db = asPatient("patient1", "p1@x.co")
    await assertFails(setDoc(topicRef(db), newTopic("patient")))
    await assertFails(setDoc(msgRef(db, "t1", "m1"), newMessage(patientFrom())))
  })
  test("starting is refused on an inactive or someone else's chart, or with a fake sender", async () => {
    await assertFails(start(as("provider"), "staff", staffFrom(), { chart: "inactive1" }))
    await assertFails(start(asPatient("patient1", "p1@x.co"), "patient", patientFrom(), { chart: "pending1" }))
    await assertFails(start(as("provider"), "staff", staffFrom("provider", "provider", "Dr. Somebody")))
    await assertFails(start(as("provider"), "staff", staffFrom("admin", "admin")))
    await assertFails(start(asPatient("patient1", "p1@x.co"), "patient", patientFrom("patient2")))
    await assertFails(start(as("provider"), "patient", patientFrom("provider")))
  })
  test("subject and message lengths are checked", async () => {
    await assertFails(start(as("provider"), "staff", staffFrom(), { topic: { subject: "" } }))
    await assertFails(start(as("provider"), "staff", staffFrom(), { topic: { subject: "x".repeat(121) } }))
    await assertFails(start(as("provider"), "staff", staffFrom(), { message: { body: "x".repeat(2001) } }))
    await assertFails(start(as("provider"), "staff", staffFrom(), { message: { email: "sent" } }))
  })
  test("a reply moves the topic in the same save; two replies in a row both work", async () => {
    await seedTopic()
    await assertSucceeds(reply(as("provider"), "staff", staffFrom(), "m2"))
    await assertSucceeds(reply(as("coadmin"), "staff", staffFrom("coadmin", "coAdmin"), "m3"))
    await assertSucceeds(reply(asPatient("patient1", "p1@x.co"), "patient", patientFrom(), "m4"))
  })
  test("a reply without moving the topic, or a move without a message, is refused", async () => {
    await seedTopic()
    await assertFails(setDoc(msgRef(as("provider"), "t1", "m2"), newMessage(staffFrom())))
    await assertFails(
      updateDoc(topicRef(as("provider")), { lastMessageAt: serverTimestamp(), lastFrom: "staff", lastMessageId: "m9", staffReadAt: serverTimestamp() }),
    )
    await assertFails(reply(as("provider"), "patient", staffFrom(), "m2"))
  })
  test("replying in a closed topic reopens it", async () => {
    await seedTopic({ status: "closed", closed: { by: "patient", name: "", at: new Date() } })
    await assertSucceeds(reply(asPatient("patient1", "p1@x.co"), "patient", patientFrom(), "m2"))
  })
  test("each side only moves its own read marker", async () => {
    await seedTopic()
    await assertSucceeds(updateDoc(topicRef(asPatient("patient1", "p1@x.co")), { patientReadAt: serverTimestamp() }))
    await assertFails(updateDoc(topicRef(asPatient("patient1", "p1@x.co")), { staffReadAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(topicRef(as("dietitian")), { staffReadAt: serverTimestamp() }))
    await assertFails(updateDoc(topicRef(as("provider")), { staffReadAt: new Date("2020-01-01") }))
    await assertFails(updateDoc(topicRef(as("provider")), { subject: "Changed" }))
  })
  test("either side closes a topic as itself, once", async () => {
    await seedTopic()
    await assertFails(updateDoc(topicRef(as("provider")), { status: "closed", closed: { by: "staff", name: "admin", at: serverTimestamp() } }))
    await assertSucceeds(updateDoc(topicRef(as("provider")), { status: "closed", closed: { by: "staff", name: "provider", at: serverTimestamp() } }))
    await assertFails(updateDoc(topicRef(as("admin")), { status: "closed", closed: { by: "staff", name: "admin", at: serverTimestamp() } }))
    await seedTopic()
    await assertFails(updateDoc(topicRef(asPatient("patient1", "p1@x.co")), { status: "closed", closed: { by: "staff", name: "", at: serverTimestamp() } }))
    await assertSucceeds(updateDoc(topicRef(asPatient("patient1", "p1@x.co")), { status: "closed", closed: { by: "patient", name: "", at: serverTimestamp() } }))
  })
  test("only the staff author records the email result, once", async () => {
    await seedTopic()
    await seedMessage("s1", { ...newMessage(staffFrom()), createdAt: new Date() })
    await assertFails(updateDoc(msgRef(as("admin"), "t1", "s1"), { email: "sent" }))
    await assertSucceeds(updateDoc(msgRef(as("provider"), "t1", "s1"), { email: "sent" }))
    await assertFails(updateDoc(msgRef(as("provider"), "t1", "s1"), { email: "failed" }))
  })
  test("nothing is edited or deleted", async () => {
    await seedTopic()
    await seedMessage("p1", { ...newMessage(patientFrom()), createdAt: new Date() })
    await assertFails(updateDoc(msgRef(asPatient("patient1", "p1@x.co"), "t1", "p1"), { body: "Edited" }))
    await assertFails(deleteDoc(msgRef(as("super"), "t1", "p1")))
    await assertFails(deleteDoc(topicRef(as("super"))))
  })
  test("reads: the patient's own chart only; staff across charts", async () => {
    await seedTopic()
    await seedMessage("p1", { ...newMessage(patientFrom()), createdAt: new Date() })
    const db = asPatient("patient1", "p1@x.co")
    await assertSucceeds(getDocs(collection(db, "patients/chart1/topics")))
    await assertSucceeds(getDocs(collection(db, "patients/chart1/topics/t1/messages")))
    await assertFails(getDocs(collection(asPatient("patient2", "p2@x.co"), "patients/chart1/topics")))
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), "patients/chart1/topics")))
    await assertSucceeds(getDocs(collectionGroup(as("dietitian"), "topics")))
    await assertFails(getDocs(collectionGroup(db, "topics")))
  })
  test("a patient reads their own chart record, not anyone else's", async () => {
    await assertSucceeds(getDoc(doc(asPatient("patient1", "p1@x.co"), "patients", "chart1")))
    await assertFails(getDoc(doc(asPatient("patient1", "p1@x.co"), "patients", "inactive1")))
  })
})
```


- [x] **Step 2: Run, see the allow-cases fail.** `npm run test:rules` > a log; read the summary. Expected: every `assertSucceeds` test FAILS; the pure-deny tests pass.

- [x] **Step 3: Add the rules.**

At database level, after `myName()`:

```
    // A patient's login linked to this chart (patientAccounts/{uid}.intakeId,
    // set by /portal/setup and never changed).
    function isLinkedTo(chartId) {
      return request.auth != null
        && get(/databases/$(database)/documents/patientAccounts/$(request.auth.uid)).data.intakeId == chartId;
    }
```

In `match /patients/{chartId}`, change `allow read: if isClinical();` to:

```
      // The linked patient reads their own chart record (name, status), so the
      // portal knows whether messaging is open.
      allow read: if isClinical() || isLinkedTo(chartId);
```

Inside `match /patients/{chartId}`, after the `progress` block:

```
      // Messages (spec 2026-10-06-portal-messages-design). A topic and its
      // first message are saved together; every later message moves the
      // topic (lastMessageId/At) in the same save, so the inbox can't be faked.
      // Patient and staff branches are separate `||` cases: role() errors for
      // a patient, and only `||` tolerates that.
      function chartActive() {
        return get(/databases/$(database)/documents/patients/$(chartId)).data.status == 'active';
      }
      match /topics/{topicId} {
        function messagePath(id) {
          return /databases/$(database)/documents/patients/$(chartId)/topics/$(topicId)/messages/$(id);
        }
        function isNewTopic(side) {
          let data = request.resource.data;
          return data.keys().hasOnly(['subject', 'status', 'startedBy', 'createdAt', 'lastMessageAt', 'lastFrom', 'lastMessageId', 'patientReadAt', 'staffReadAt', 'closed'])
            && data.keys().hasAll(['subject', 'status', 'startedBy', 'createdAt', 'lastMessageAt', 'lastFrom', 'lastMessageId', 'patientReadAt', 'staffReadAt', 'closed'])
            && data.subject is string && data.subject.size() > 0 && data.subject.size() <= 120
            && data.status == 'open'
            && data.startedBy == side && data.lastFrom == side
            && data.createdAt == request.time && data.lastMessageAt == request.time
            && data.closed == null
            && (side == 'staff'
                ? (data.staffReadAt == request.time && data.patientReadAt == null)
                : (data.patientReadAt == request.time && data.staffReadAt == null))
            && data.lastMessageId is string
            && existsAfter(messagePath(data.lastMessageId))
            && chartActive();
        }
        function isMove(side) {
          let data = request.resource.data;
          return data.diff(resource.data).affectedKeys().hasOnly(['lastMessageAt', 'lastFrom', 'lastMessageId', 'status', 'closed', side == 'staff' ? 'staffReadAt' : 'patientReadAt'])
            && data.lastFrom == side
            && data.lastMessageAt == request.time
            && data.status == 'open' && data.closed == null
            && (side == 'staff' ? data.staffReadAt == request.time : data.patientReadAt == request.time)
            && data.lastMessageId is string
            && data.lastMessageId != resource.data.lastMessageId
            && !exists(messagePath(data.lastMessageId))
            && existsAfter(messagePath(data.lastMessageId))
            && chartActive();
        }
        function isRead(side) {
          let key = side == 'staff' ? 'staffReadAt' : 'patientReadAt';
          return request.resource.data.diff(resource.data).affectedKeys().hasOnly([key])
            && request.resource.data[key] == request.time;
        }
        function isClose(side, name) {
          let data = request.resource.data;
          return data.diff(resource.data).affectedKeys().hasOnly(['status', 'closed'])
            && resource.data.status == 'open'
            && data.status == 'closed'
            && data.closed.keys().hasOnly(['by', 'name', 'at'])
            && data.closed.by == side && data.closed.name == name && data.closed.at == request.time;
        }
        allow read: if isClinical() || isLinkedTo(chartId);
        allow create: if (isClinical() && isNewTopic('staff')) || (isLinkedTo(chartId) && isNewTopic('patient'));
        allow update: if (isClinical() && (isMove('staff') || isRead('staff') || isClose('staff', myName())))
          || (isLinkedTo(chartId) && (isMove('patient') || isRead('patient') || isClose('patient', '')));
        allow delete: if false;

        match /messages/{messageId} {
          function movesTopic(side) {
            let topic = getAfter(/databases/$(database)/documents/patients/$(chartId)/topics/$(topicId)).data;
            return topic.lastMessageId == messageId && topic.lastMessageAt == request.time && topic.lastFrom == side;
          }
          function isNewMessage(side) {
            let data = request.resource.data;
            return data.keys().hasOnly(['body', 'from', 'createdAt', 'email'])
              && data.keys().hasAll(['body', 'from', 'createdAt', 'email'])
              && data.body is string && data.body.size() > 0 && data.body.size() <= 2000
              && data.createdAt == request.time
              && data.email == 'none'
              && data.from.uid == request.auth.uid
              && (side == 'staff'
                  ? (data.from.keys().hasOnly(['kind', 'uid', 'name', 'role']) && data.from.kind == 'staff'
                     && data.from.name == myName() && data.from.role == role())
                  : (data.from.keys().hasOnly(['kind', 'uid']) && data.from.kind == 'patient'))
              && movesTopic(side)
              && chartActive();
          }
          allow read: if isClinical() || isLinkedTo(chartId);
          allow create: if (isClinical() && isNewMessage('staff')) || (isLinkedTo(chartId) && isNewMessage('patient'));
          allow update: if isClinical()
            && resource.data.from.kind == 'staff'
            && resource.data.from.uid == request.auth.uid
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['email'])
            && resource.data.email == 'none'
            && request.resource.data.email in ['sent', 'failed'];
          allow delete: if false;
        }
      }
```

At database level, just before the final catch-all `match /{document=**}`:

```
    // The staff inbox lists topics across every chart.
    match /{path=**}/topics/{topicId} {
      allow read: if isClinical();
    }
```

- [x] **Step 4: Run.** `npm run test:rules`. Expected: all pass (111 + 14 = 125). If the rules fail to compile, read the "Error compiling rules" line in the log. Update the test-file header ("portal messages", "All 125 passed on <today>").

- [x] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.js
git commit -m "Rules: portal messages (topics with their first message, replies move the topic, read and close markers, staff inbox across charts)"
```

---

### Task 2: `messageMath`

**Files:**
- Create: `src/lib/messageMath.js`, `src/lib/messageMath.check.js`
- Modify: `package.json` (`check` script: append `&& node src/lib/messageMath.check.js`), `src/portal/updates/PortalUpdates.jsx` (use `PATIENT_ROLE_LABELS`)

**Interfaces:**
- Produces: `needsReply(topic) → bool`; `unreadFor(topic, side: "staff"|"patient") → bool`; `notifiesStaff(topicBefore | null) → bool`; `topicCounts(topics) → { needsReply, open, closed }`; `byLatest(a, b)` sort comparator (newest activity first); `PATIENT_ROLE_LABELS`; `patientRoleLabel(role) → string` ("Care team" fallback).

- [x] **Step 1: Write the failing check** `src/lib/messageMath.check.js`:

```js
// Self-check for messageMath.js: `npm run check`. Plain node:assert.
import assert from "node:assert/strict"
import { byLatest, needsReply, notifiesStaff, patientRoleLabel, topicCounts, unreadFor } from "./messageMath.js"

const at = (iso) => ({ toMillis: () => new Date(iso).getTime() })
const topic = (overrides = {}) => ({
  status: "open",
  lastFrom: "patient",
  lastMessageAt: at("2026-10-06T10:00:00Z"),
  patientReadAt: at("2026-10-06T10:00:00Z"),
  staffReadAt: null,
  ...overrides,
})

// Needs a reply: open, and the patient wrote last.
assert.equal(needsReply(topic()), true)
assert.equal(needsReply(topic({ lastFrom: "staff" })), false)
assert.equal(needsReply(topic({ status: "closed" })), false)

// Unread for a side: the other side wrote after this side last looked.
assert.equal(unreadFor(topic(), "staff"), true)
assert.equal(unreadFor(topic({ staffReadAt: at("2026-10-06T10:05:00Z") }), "staff"), false)
assert.equal(unreadFor(topic(), "patient"), false)
assert.equal(unreadFor(topic({ lastFrom: "staff", patientReadAt: at("2026-10-06T09:00:00Z") }), "patient"), true)

// Email info@ only when the patient's message makes the topic newly need a reply.
assert.equal(notifiesStaff(null), true)
assert.equal(notifiesStaff(topic({ lastFrom: "staff" })), true)
assert.equal(notifiesStaff(topic({ lastFrom: "patient" })), false)
assert.equal(notifiesStaff(topic({ lastFrom: "patient", status: "closed" })), true)

// Counts for the sidebar and filters.
assert.deepEqual(topicCounts([topic(), topic({ lastFrom: "staff" }), topic({ status: "closed" })]), { needsReply: 1, open: 2, closed: 1 })

// Newest activity first.
const older = topic({ lastMessageAt: at("2026-10-01T10:00:00Z") })
const newer = topic({ lastMessageAt: at("2026-10-05T10:00:00Z") })
assert.deepEqual([older, newer].sort(byLatest), [newer, older])

// How a staff role reads to a patient.
assert.equal(patientRoleLabel("admin"), "Provider")
assert.equal(patientRoleLabel("dietitian"), "Dietitian")
assert.equal(patientRoleLabel("superAdmin"), "Care team")
assert.equal(patientRoleLabel(undefined), "Care team")

console.log("messageMath: all checks passed")
```

Append ` && node src/lib/messageMath.check.js` to the `check` script.

- [x] **Step 2: Run.** `npm run check`. Expected: FAIL, cannot find `./messageMath.js`.

- [x] **Step 3: Implement** `src/lib/messageMath.js`:

```js
// Messages arithmetic shared by the admin inbox and the patient portal. No
// React or Firebase, so messageMath.check.js runs under plain node.

const ms = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value ? new Date(value).getTime() : 0)

export const needsReply = (topic) => topic.status === "open" && topic.lastFrom === "patient"

// The other side wrote after this side last opened it.
export const unreadFor = (topic, side) =>
  topic.lastFrom !== side && ms(side === "staff" ? topic.staffReadAt : topic.patientReadAt) < ms(topic.lastMessageAt)

// info@ is emailed only when a patient's message makes the topic newly need a
// reply: a new topic, after a staff message, or reopening a closed one. Five
// messages in a row mean one email.
export const notifiesStaff = (topicBefore) => !topicBefore || topicBefore.lastFrom === "staff" || topicBefore.status === "closed"

export function topicCounts(topics) {
  return {
    needsReply: topics.filter(needsReply).length,
    open: topics.filter((topic) => topic.status === "open").length,
    closed: topics.filter((topic) => topic.status === "closed").length,
  }
}

export const byLatest = (a, b) => ms(b.lastMessageAt) - ms(a.lastMessageAt)

// How staff roles read to a patient: the admin is Dr. Antonious, so
// "Provider"; co-admins and super admins aren't necessarily clinicians.
export const PATIENT_ROLE_LABELS = { provider: "Provider", dietitian: "Dietitian", admin: "Provider", coAdmin: "Care team", superAdmin: "Care team" }
export const patientRoleLabel = (role) => PATIENT_ROLE_LABELS[role] ?? "Care team"
```

In `src/portal/updates/PortalUpdates.jsx`, delete the `AUTHOR_ROLES` constant and its comment, import `patientRoleLabel` from `../../lib/messageMath`, and replace `AUTHOR_ROLES[update.author?.role] ?? "Care team"` with `patientRoleLabel(update.author?.role)`.

- [x] **Step 4: Run.** `npm run check` → all pass. `npm run lint` clean.

- [x] **Step 5: Commit**

```bash
git add src/lib/messageMath.js src/lib/messageMath.check.js package.json src/portal/updates/PortalUpdates.jsx
git commit -m "Messages: messageMath (needs a reply, unread, staff notice rule, patient role labels)"
```

---

### Task 3: Email: move to `src/lib`, portal notice and staff notice templates

**Files:**
- Move: `src/admin/lib/emailjs.js` → `src/lib/emailjs.js` (`git mv`)
- Modify: importers `src/admin/patients/InviteDialog.jsx`, `portalStore.js`, `PostUpdateDialog.jsx`, `updateStore.js`; `.env.example`; `docs/client-portal.md` (EmailJS setup)
- Test: `<scratchpad>/updates-check.mjs` (its emailjs stub route and export names)

**Interfaces:**
- Produces from `src/lib/emailjs.js`: `sendEmail(params, templateId = TEMPLATE_ID)`, `emailjsConfigured` (invites), `PORTAL_TEMPLATE_ID`, `portalEmailConfigured`, `STAFF_TEMPLATE_ID`, `staffEmailConfigured`.
- `updateStore.postUpdate` sends `{ to_email, subject, notice, portal_link }` with `PORTAL_TEMPLATE_ID`.

- [x] **Step 1: Update the browser check first.** In `<scratchpad>/updates-check.mjs`, change the stub route `**/src/admin/lib/emailjs.js*` to `**/src/lib/emailjs.js*` and the stub body to:

```js
export const PORTAL_TEMPLATE_ID = "t"
export const STAFF_TEMPLATE_ID = "s"
export const emailjsConfigured = true
export const portalEmailConfigured = true
export const staffEmailConfigured = true
export async function sendEmail() { throw new Error("Bad template") }
```

Run it: expected FAIL on the "Email not sent" case (the app still loads the old path, so the stub doesn't apply and the demo send succeeds).

- [x] **Step 2: Move and rename.** `git mv src/admin/lib/emailjs.js src/lib/emailjs.js`. In it, replace the `UPDATE_TEMPLATE_ID` and `updateEmailConfigured` lines with:

```js
// One "portal notice" template for Updates and Messages (the sentence comes
// in as {{notice}}), and a "staff notice" template whose recipient
// (info@corephia.com) is fixed in EmailJS, never sent from here.
export const PORTAL_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_PORTAL_TEMPLATE_ID
export const STAFF_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_STAFF_TEMPLATE_ID
```

and after `emailjsConfigured`:

```js
export const portalEmailConfigured = Boolean(SERVICE_ID && PORTAL_TEMPLATE_ID && PUBLIC_KEY)
export const staffEmailConfigured = Boolean(SERVICE_ID && STAFF_TEMPLATE_ID && PUBLIC_KEY)
```

Update the top comment: "The public key ships in the admin bundle and, for the staff notice, the patient portal by design; limit it in the EmailJS dashboard (allowed origins, rate limit)."

Importers: `InviteDialog.jsx`, `portalStore.js` → `../../lib/emailjs`. `PostUpdateDialog.jsx` → `import { portalEmailConfigured } from "../../lib/emailjs"` and rename its use of `updateEmailConfigured`. `updateStore.js` → `import { PORTAL_TEMPLATE_ID, portalEmailConfigured, sendEmail } from "../../lib/emailjs"`, rename the uses, and change `emailParams` to:

```js
const emailParams = (to) => ({
  to_email: to,
  subject: UPDATE_SUBJECT,
  notice: "Your CorePhia care team posted an update. Log in to your portal to read it.",
  portal_link: `${window.location.origin}/account`,
})
```

`.env.example`: replace `VITE_EMAILJS_UPDATE_TEMPLATE_ID=` with `VITE_EMAILJS_PORTAL_TEMPLATE_ID=` and add `VITE_EMAILJS_STAFF_TEMPLATE_ID=`.

- [x] **Step 3: Docs.** In `docs/client-portal.md` "EmailJS setup (once)", replace the "A second template for portal updates" step with:

```markdown
   A **portal notice** template (Updates and Messages): To Email `{{to_email}}`, From Name
   `CorePhia`, Reply To `info@corephia.com`, Subject `{{subject}}`, body `{{notice}}`, a
   button **Open your portal** linking `{{portal_link}}`, then "CorePhia Health · Tampa,
   Florida". Copy its id into `VITE_EMAILJS_PORTAL_TEMPLATE_ID`.

   A **staff notice** template (a patient sent a message): To Email
   **info@corephia.com typed in the template** (never `{{…}}`, so the site can't send it
   anywhere else; add Dr. Antonious here later), Subject "New patient message", body "A
   patient sent a message in the CorePhia portal. Log in to the admin to read it.", a
   button **Open Messages** linking `{{admin_link}}`. Copy its id into
   `VITE_EMAILJS_STAFF_TEMPLATE_ID`.
```

and update the env step to list `VITE_EMAILJS_PORTAL_TEMPLATE_ID` and `VITE_EMAILJS_STAFF_TEMPLATE_ID` instead of `VITE_EMAILJS_UPDATE_TEMPLATE_ID`, noting the public key now also ships with the patient portal.

- [x] **Step 4: Verify.** `updates-check.mjs` all pass; `npm run lint`, `npm run build`, `npm run check` clean; `grep -rn "admin/lib/emailjs\|UPDATE_TEMPLATE_ID\|updateEmailConfigured" src` returns nothing.

- [x] **Step 5: Commit**

```bash
git add -A src/lib/emailjs.js src/admin .env.example docs/client-portal.md
git commit -m "Email: move EmailJS to src/lib; one portal notice template for Updates and Messages; staff notice template"
```

---

### Task 4: Admin `topicStore` and `useTopics`

**Files:**
- Create: `src/admin/inbox/topicStore.js`, `src/admin/inbox/useTopics.js`

No unit test (Firebase imports, same ruling as the other stores). Shapes are pinned by Task 1; behaviour by Task 5's browser check.

**Interfaces:**
- Consumes: `notifiesStaff` not needed here; `retryOnce` from `src/lib/inviteMath.js`; `sendEmail`, `PORTAL_TEMPLATE_ID`, `portalEmailConfigured` (Task 3); `getDemoStore`, `demoId`, `loadCharts`, `PATIENTS_COLLECTION` from `chartStore`.
- Produces:
  - `listenTopics(onChange(topics), onError) → unsubscribe` — every topic with `{ id, chartId, ...data }`.
  - `listenMessages(chartId, topicId, onChange(messages), onError) → unsubscribe` — oldest first.
  - `startTopic({ chartId, subject, body, to, email }, actor) → Promise<{ topicId, emailed }>`
  - `replyToTopic({ chartId, topicId, body, to, email }, actor) → Promise<{ emailed }>`
  - `closeTopic(chartId, topicId, actor) → Promise<void>`
  - `markTopicRead(chartId, topicId) → Promise<void>`
  - `useTopics({ enabled }) → { topics: Topic[] | null, error }`
  - `emailed` is `'none' | 'sent' | 'failed'`; `actor = { uid, name, role }`.

- [x] **Step 1: `topicStore.js`:**

```js
// Patient messages on the staff side (spec 2026-10-06-portal-messages-design):
// every read and write for patients/{chartId}/topics. Each write is one batch
// that firestore.rules ties together (a message always moves its topic).
// Demo mode keeps topics in memory with a tiny listener list so the page
// still updates live, and seeds two sample topics.
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore"
import { retryOnce } from "../../lib/inviteMath"
import { PORTAL_TEMPLATE_ID, portalEmailConfigured, sendEmail } from "../../lib/emailjs"
import { db, usingSeedData } from "../lib/firebase"
import { PATIENTS_COLLECTION, demoId, getDemoStore } from "../patients/chartStore"

const TOPICS = "topics"
const MESSAGES = "messages"
export const MESSAGE_SUBJECT = "You have a new message from CorePhia"

const requireDb = () => {
  if (!db) throw new Error("Firebase is not configured.")
  return db
}

const emailParams = (to) => ({
  to_email: to,
  subject: MESSAGE_SUBJECT,
  notice: "Your CorePhia care team sent you a message. Log in to your portal to read it.",
  portal_link: `${window.location.origin}/account/messages`,
})

async function emailPatient(to, wanted) {
  if (!wanted || !to) return "none"
  if (usingSeedData && !portalEmailConfigured) return "sent"
  return sendEmail(emailParams(to), PORTAL_TEMPLATE_ID).then(
    () => "sent",
    () => "failed",
  )
}

const staffFrom = (actor) => ({ kind: "staff", uid: actor.uid, name: actor.name, role: actor.role })

// --- Demo ------------------------------------------------------------------

async function demo() {
  const store = await getDemoStore()
  if (!store.topics) {
    store.topics = []
    store.topicListeners = new Set()
    const charts = [...store.charts.values()].filter((chart) => chart.status === "active").slice(0, 2)
    const hoursAgo = (h) => new Date(Date.now() - h * 3600000)
    if (charts[0]) {
      store.topics.push({
        id: demoId(),
        chartId: charts[0].id,
        subject: "Feeling dizzy after the new dose",
        status: "open",
        startedBy: "patient",
        createdAt: hoursAgo(5),
        lastMessageAt: hoursAgo(2),
        lastFrom: "patient",
        lastMessageId: "m2",
        patientReadAt: hoursAgo(2),
        staffReadAt: null,
        closed: null,
        messages: [
          { id: "m1", body: "Hi, I've felt a little dizzy in the mornings since last week.", from: { kind: "patient", uid: "p" }, createdAt: hoursAgo(5), email: "none" },
          { id: "m2", body: "It's better after breakfast. Should I keep going?", from: { kind: "patient", uid: "p" }, createdAt: hoursAgo(2), email: "none" },
        ],
      })
    }
    if (charts[1]) {
      store.topics.push({
        id: demoId(),
        chartId: charts[1].id,
        subject: "Swapping the evening snack",
        status: "open",
        startedBy: "staff",
        createdAt: hoursAgo(30),
        lastMessageAt: hoursAgo(26),
        lastFrom: "staff",
        lastMessageId: "m2",
        patientReadAt: hoursAgo(27),
        staffReadAt: hoursAgo(26),
        closed: null,
        messages: [
          { id: "m1", body: "How did the new evening snack go this week?", from: { kind: "staff", uid: "d", name: "Sam Rivera, RD", role: "dietitian" }, createdAt: hoursAgo(30), email: "sent" },
          { id: "m2", body: "Great to hear. Let's keep it for another two weeks.", from: { kind: "staff", uid: "d", name: "Sam Rivera, RD", role: "dietitian" }, createdAt: hoursAgo(26), email: "sent" },
        ],
      })
    }
  }
  return store
}

const notify = (store) => store.topicListeners.forEach((listener) => listener())
const strip = ({ messages, ...topic }) => topic

// --- Reads -----------------------------------------------------------------

export function listenTopics(onChange, onError) {
  if (usingSeedData) {
    let store
    const push = () => onChange(store.topics.map(strip))
    demo().then((loaded) => {
      store = loaded
      store.topicListeners.add(push)
      push()
    }, onError)
    return () => store?.topicListeners.delete(push)
  }
  return onSnapshot(
    collectionGroup(requireDb(), TOPICS),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, chartId: entry.ref.parent.parent.id, ...entry.data() }))),
    onError,
  )
}

export function listenMessages(chartId, topicId, onChange, onError) {
  if (usingSeedData) {
    let store
    const push = () => onChange([...(store.topics.find((topic) => topic.id === topicId)?.messages ?? [])])
    demo().then((loaded) => {
      store = loaded
      store.topicListeners.add(push)
      push()
    }, onError)
    return () => store?.topicListeners.delete(push)
  }
  return onSnapshot(
    query(collection(requireDb(), PATIENTS_COLLECTION, chartId, TOPICS, topicId, MESSAGES), orderBy("createdAt", "asc")),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    onError,
  )
}

// --- Writes ----------------------------------------------------------------

async function recordEmail(ref, emailed) {
  if (emailed === "none") return
  if (!(await retryOnce(() => updateDoc(ref, { email: emailed })))) console.error("Could not record the message email result.")
}

export async function startTopic({ chartId, subject, body, to, email }, actor) {
  const from = staffFrom(actor)
  if (usingSeedData) {
    const store = await demo()
    const now = new Date()
    const message = { id: demoId(), body, from, createdAt: now, email: "none" }
    const topic = {
      id: demoId(),
      chartId,
      subject,
      status: "open",
      startedBy: "staff",
      createdAt: now,
      lastMessageAt: now,
      lastFrom: "staff",
      lastMessageId: message.id,
      patientReadAt: null,
      staffReadAt: now,
      closed: null,
      messages: [message],
    }
    store.topics.push(topic)
    message.email = await emailPatient(to, email)
    notify(store)
    return { topicId: topic.id, emailed: message.email }
  }
  const database = requireDb()
  const topicRef = doc(collection(database, PATIENTS_COLLECTION, chartId, TOPICS))
  const messageRef = doc(collection(topicRef, MESSAGES))
  const batch = writeBatch(database)
  batch.set(topicRef, {
    subject,
    status: "open",
    startedBy: "staff",
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastFrom: "staff",
    lastMessageId: messageRef.id,
    patientReadAt: null,
    staffReadAt: serverTimestamp(),
    closed: null,
  })
  batch.set(messageRef, { body, from, createdAt: serverTimestamp(), email: "none" })
  await batch.commit()
  const emailed = await emailPatient(to, email)
  await recordEmail(messageRef, emailed)
  return { topicId: topicRef.id, emailed }
}

export async function replyToTopic({ chartId, topicId, body, to, email }, actor) {
  const from = staffFrom(actor)
  if (usingSeedData) {
    const store = await demo()
    const topic = store.topics.find((entry) => entry.id === topicId)
    const now = new Date()
    const message = { id: demoId(), body, from, createdAt: now, email: "none" }
    topic.messages.push(message)
    Object.assign(topic, { lastMessageAt: now, lastFrom: "staff", lastMessageId: message.id, status: "open", closed: null, staffReadAt: now })
    message.email = await emailPatient(to, email)
    notify(store)
    return { emailed: message.email }
  }
  const database = requireDb()
  const topicRef = doc(database, PATIENTS_COLLECTION, chartId, TOPICS, topicId)
  const messageRef = doc(collection(topicRef, MESSAGES))
  const batch = writeBatch(database)
  batch.update(topicRef, {
    lastMessageAt: serverTimestamp(),
    lastFrom: "staff",
    lastMessageId: messageRef.id,
    status: "open",
    closed: null,
    staffReadAt: serverTimestamp(),
  })
  batch.set(messageRef, { body, from, createdAt: serverTimestamp(), email: "none" })
  await batch.commit()
  const emailed = await emailPatient(to, email)
  await recordEmail(messageRef, emailed)
  return { emailed }
}

export async function closeTopic(chartId, topicId, actor) {
  if (usingSeedData) {
    const store = await demo()
    Object.assign(store.topics.find((topic) => topic.id === topicId), {
      status: "closed",
      closed: { by: "staff", name: actor.name, at: new Date() },
    })
    notify(store)
    return
  }
  await updateDoc(doc(requireDb(), PATIENTS_COLLECTION, chartId, TOPICS, topicId), {
    status: "closed",
    closed: { by: "staff", name: actor.name, at: serverTimestamp() },
  })
}

export async function markTopicRead(chartId, topicId) {
  if (usingSeedData) {
    const store = await demo()
    const topic = store.topics.find((entry) => entry.id === topicId)
    if (topic) topic.staffReadAt = new Date()
    notify(store)
    return
  }
  await updateDoc(doc(requireDb(), PATIENTS_COLLECTION, chartId, TOPICS, topicId), { staffReadAt: serverTimestamp() })
}
```

- [x] **Step 2: `useTopics.js`:**

```js
import { useEffect, useState } from "react"
import { listenTopics } from "./topicStore"

// Every patient topic, live. The sidebar count and the Messages page each
// hold one listener.
export function useTopics({ enabled = true } = {}) {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!enabled) return
    return listenTopics(
      (next) => {
        setTopics(next)
        setError(null)
      },
      (cause) => {
        console.error("Could not load messages:", cause.code ?? cause.message)
        setError(cause.message ?? "error")
      },
    )
  }, [enabled])
  return { topics, error }
}
```

- [x] **Step 3: Verify.** `npm run lint` (no new errors), `npm run build`.

- [x] **Step 4: Commit**

```bash
git add src/admin/inbox/topicStore.js src/admin/inbox/useTopics.js
git commit -m "Messages: staff topic store (live topics and messages, start, reply, close, read) with demo data"
```

---

### Task 5: Admin Messages page, sidebar entry and route

**Files:**
- Create: `src/admin/inbox/MessagesPage.jsx`, `src/admin/inbox/TopicView.jsx`, `src/admin/inbox/NewTopicDialog.jsx`
- Modify: `src/admin/ui/icons.jsx` (`ChatIcon`), `src/admin/staff/roles.js` (`inbox: CLINICAL_ROLES`), `src/admin/staff/roles.check.js`, `src/admin/layout/Sidebar.jsx` (entry + count), `src/admin/AdminApp.jsx` (route; remove the `/admin/messages` redirect)
- Test: `<scratchpad>/inbox-check.mjs`

**Interfaces:**
- Consumes: Task 2 (`needsReply`, `unreadFor`, `topicCounts`, `byLatest`), Task 4 (store + `useTopics`), `loadCharts`, `loadIntakeRecord` (chartStore), `ROLE_LABELS`, `formatRelativeTime` (`../lib/relativeTime`), `formatStamp`, `inputClass`, `labelClass` (`../patients/noteUi`), `Modal`, `ConfirmDialog`, `portalEmailConfigured`, `usingSeedData`.
- Produces: route `/admin/messages` (query params `topic`, `patient`), page key `inbox`.

- [x] **Step 1: roles check first.** In `roles.check.js` add:

```js
assert.equal(canOpen("inbox", "dietitian"), true)
assert.equal(canOpen("inbox", "provider"), true)
assert.equal(canOpen("inbox", ""), false)
```

Run `npm run check` → FAIL. Add `inbox: CLINICAL_ROLES,` to `PAGE_ROLES` → PASS.

- [x] **Step 2: Browser check first.** `<scratchpad>/inbox-check.mjs`, same demo harness as `updates-check.mjs` (route `firebase.js` to force `usingSeedData`, `?demoRole=`, `addInitScript` for dark, fresh context per case). Open `/admin/messages` with client-side navigation from `/admin`. Cases:
  1. Sidebar shows "Messages" with a count of 1 (the seeded patient topic); Queries still present.
  2. The list (filter "Needs a reply") shows one row, bold, tagged "Needs a reply"; "All" shows two.
  3. Click the row → topic shows both patient messages on the left, the subject, the patient name linking to `/admin/patients/{id}`; afterwards the row is no longer bold (read).
  4. Reply "Keep going, and eat before your dose." with email ticked → message appears on the right with "Email sent"; the sidebar count drops to 0; "Needs a reply" list is empty: "Nothing needs a reply."
  5. With the failing emailjs stub (`**/src/lib/emailjs.js*`, as in `updates-check.mjs`): reply → "Email not sent".
  6. Close topic → confirm → header shows "Closed"; filter Closed lists it; Reopen focuses the reply box with "Write a reply to reopen".
  7. New message → choose a patient from the list, subject "Lab results", body → Send → the new topic opens.
  8. Message body `<b>x</b>` + a 300-character word → shown as text, no horizontal scroll at 390.
  9. `?patient={chartId}` filters to that patient's topics.
  10. Dietitian (`?demoRole=dietitian`) sees the page and can reply.
  11. Screenshots light, dark, 390 (list, then topic with Back). Read them.

Run: FAIL (no page).

- [x] **Step 3: `ChatIcon`** in `src/admin/ui/icons.jsx`, after `MailIcon`:

```jsx
export function ChatIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z" />
    </svg>
  )
}
```

- [x] **Step 4: `NewTopicDialog.jsx`:**

```jsx
import { useEffect, useState } from "react"
import { portalEmailConfigured } from "../../lib/emailjs"
import { usingSeedData } from "../lib/firebase"
import { loadCharts, loadIntakeRecord } from "../patients/chartStore"
import { inputClass, labelClass } from "../patients/noteUi"
import Modal from "../ui/Modal"
import { startTopic } from "./topicStore"

// Start a topic with a patient. Active charts only: an applicant has no chart
// and an inactive chart can't be messaged.
export default function NewTopicDialog({ actor, initialChartId = "", onClose, onStarted }) {
  const [charts, setCharts] = useState(null)
  const [chartId, setChartId] = useState(initialChartId)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [email, setEmail] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const canEmail = portalEmailConfigured || usingSeedData

  useEffect(() => {
    let live = true
    loadCharts()
      .then((all) => live && setCharts(all.filter((chart) => chart.status === "active").sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`))))
      .catch(() => live && setCharts([]))
    return () => {
      live = false
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (!chartId) return setError("Choose a patient.")
    if (!subject.trim()) return setError("Add a subject.")
    if (!body.trim()) return setError("Write a message first.")
    if (body.trim().length > 2000) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      const intake = await loadIntakeRecord(chartId).catch(() => null)
      const to = (intake?.demographics?.email ?? "").trim().toLowerCase()
      const { topicId } = await startTopic({ chartId, subject: subject.trim(), body: body.trim(), to, email: email && canEmail }, actor)
      onStarted({ chartId, topicId })
    } catch (cause) {
      setError(cause?.code === "permission-denied" ? "This chart can't be messaged." : "Couldn't send the message. Try again.")
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New message"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-sm text-brand-dark">
              {error}
            </p>
          )}
          <button
            type="submit"
            form="new-topic"
            disabled={busy || !charts}
            className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </>
      }
    >
      <form id="new-topic" onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={labelClass}>Patient</span>
          <select value={chartId} onChange={(event) => setChartId(event.target.value)} className={inputClass} disabled={!charts}>
            <option value="">{charts ? "Choose a patient" : "Loading patients…"}</option>
            {charts?.map((chart) => (
              <option key={chart.id} value={chart.id}>
                {`${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Subject</span>
          <input value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Message</span>
          <textarea value={body} rows={6} onChange={(event) => setBody(event.target.value)} className={`${inputClass} resize-y leading-relaxed`} />
        </label>
        <label className={`flex items-start gap-2 text-sm ${canEmail ? "cursor-pointer text-ink-950/80" : "text-ink-950/50"}`}>
          <input type="checkbox" checked={email && canEmail} disabled={!canEmail} onChange={(event) => setEmail(event.target.checked)} className="mt-0.5 size-4 accent-accent-dark" />
          <span>
            Email the patient that there's a new message
            {!canEmail && <span className="block text-xs">Email sending isn't set up yet.</span>}
          </span>
        </label>
        <p className="text-xs text-ink-950/55">The patient sees your name and role. The email doesn't include the message.</p>
      </form>
    </Modal>
  )
}
```

- [x] **Step 5: `TopicView.jsx`:**

```jsx
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { portalEmailConfigured } from "../../lib/emailjs"
import { unreadFor } from "../../lib/messageMath"
import { usingSeedData } from "../lib/firebase"
import { loadIntakeRecord } from "../patients/chartStore"
import { formatStamp, inputClass } from "../patients/noteUi"
import { ROLE_LABELS } from "../staff/roles"
import ConfirmDialog from "../ui/ConfirmDialog"
import { ChevronLeftIcon } from "../ui/icons"
import { closeTopic, listenMessages, markTopicRead, replyToTopic } from "./topicStore"

const MAX = 2000
const EMAIL_WORDS = { sent: "Email sent", failed: "Email not sent", none: "Not emailed" }

// One topic: messages oldest first, the reply box, Close. Opening it (and
// each new patient message while it's open) marks it read for staff.
export default function TopicView({ topic, chart, actor, onBack }) {
  const [messages, setMessages] = useState(null)
  const [failed, setFailed] = useState(false)
  const [to, setTo] = useState("")
  const [body, setBody] = useState("")
  const [email, setEmail] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [closing, setClosing] = useState(false)
  const [hint, setHint] = useState(null)
  const replyRef = useRef(null)
  const canEmail = (portalEmailConfigured || usingSeedData) && Boolean(to)
  const active = chart?.status === "active"

  useEffect(
    () =>
      listenMessages(topic.chartId, topic.id, setMessages, (cause) => {
        console.error("Could not load the topic:", cause.code ?? cause.message)
        setFailed(true)
      }),
    [topic.chartId, topic.id],
  )

  useEffect(() => {
    let live = true
    loadIntakeRecord(topic.chartId)
      .then((intake) => live && setTo((intake?.demographics?.email ?? "").trim().toLowerCase()))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [topic.chartId])

  const unread = unreadFor(topic, "staff")
  useEffect(() => {
    if (unread) markTopicRead(topic.chartId, topic.id).catch((cause) => console.error("Could not mark read:", cause.code ?? cause.message))
  }, [unread, topic.chartId, topic.id])

  const send = async (event) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return setError("Write a message first.")
    if (text.length > MAX) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      await replyToTopic({ chartId: topic.chartId, topicId: topic.id, body: text, to, email: email && canEmail }, actor)
      setBody("")
      setHint(null)
    } catch (cause) {
      setError(cause?.code === "permission-denied" ? "This chart can't be messaged." : "Couldn't send. Try again.")
    }
    setBusy(false)
  }

  const name = chart ? `${chart.firstName} ${chart.lastName}`.trim() : "Patient"

  return (
    <section aria-label={topic.subject} className="flex min-h-0 flex-col rounded-2xl border border-ink-950/10 bg-white">
      <header className="border-b border-ink-950/10 p-4 sm:p-5">
        <button type="button" onClick={onBack} className="mb-2 inline-flex cursor-pointer items-center gap-1 text-sm text-ink-950/60 transition-colors hover:text-ink-950 lg:hidden">
          <ChevronLeftIcon className="size-4" />
          Messages
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold wrap-break-word text-ink-950">{topic.subject}</h2>
            <p className="mt-0.5 text-sm text-ink-950/60">
              <Link to={`/admin/patients/${topic.chartId}`} className="font-medium text-accent-text hover:underline">
                {name}
              </Link>
              {" · "}
              {topic.status === "closed" ? `Closed by ${topic.closed?.by === "patient" ? "the patient" : topic.closed?.name} on ${formatStamp(topic.closed?.at)}` : "Open"}
            </p>
          </div>
          {active &&
            (topic.status === "open" ? (
              <button type="button" onClick={() => setClosing(true)} className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-950/70 ring-1 ring-ink-950/15 transition-colors hover:bg-ink-950/5">
                Close topic
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setHint("Write a reply to reopen.")
                  replyRef.current?.focus()
                }}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-950/70 ring-1 ring-ink-950/15 transition-colors hover:bg-ink-950/5"
              >
                Reopen
              </button>
            ))}
        </div>
      </header>

      <ol className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {failed ? (
          <li className="text-sm text-brand-dark">Couldn't load this topic.</li>
        ) : !messages ? (
          <li className="text-sm text-ink-950/50">Loading…</li>
        ) : (
          messages.map((message) => {
            const staff = message.from?.kind === "staff"
            return (
              <li key={message.id} className={`flex ${staff ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${staff ? "bg-accent-dark/10" : "bg-paper-100"}`}>
                  <p className="text-xs text-ink-950/55">
                    {staff ? `${message.from.name} (${ROLE_LABELS[message.from.role] ?? message.from.role})` : name}, {formatStamp(message.createdAt)}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-line wrap-anywhere text-ink-950">{message.body}</p>
                  {staff && <p className="mt-1 text-xs text-ink-950/45">{EMAIL_WORDS[message.email] ?? EMAIL_WORDS.none}</p>}
                </div>
              </li>
            )
          })
        )}
      </ol>

      {active ? (
        <form onSubmit={send} className="border-t border-ink-950/10 p-4 sm:p-5">
          <label className="sr-only" htmlFor="topic-reply">
            Reply
          </label>
          <textarea
            id="topic-reply"
            ref={replyRef}
            value={body}
            rows={3}
            placeholder={hint ?? "Write a reply"}
            onChange={(event) => setBody(event.target.value)}
            className={`${inputClass} resize-y leading-relaxed`}
          />
          {body.length > MAX - 200 && (
            <p className={`mt-1 text-right text-xs ${body.length > MAX ? "text-brand-dark" : "text-ink-950/55"}`}>
              {body.length} / {MAX}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className={`flex items-start gap-2 text-sm ${canEmail ? "cursor-pointer text-ink-950/80" : "text-ink-950/50"}`}>
              <input type="checkbox" checked={email && canEmail} disabled={!canEmail} onChange={(event) => setEmail(event.target.checked)} className="mt-0.5 size-4 accent-accent-dark" />
              <span>
                Email the patient that there's a new message
                {!(portalEmailConfigured || usingSeedData) && <span className="block text-xs">Email sending isn't set up yet.</span>}
                {(portalEmailConfigured || usingSeedData) && !to && <span className="block text-xs">There's no email on this intake.</span>}
              </span>
            </label>
            <div className="flex items-center gap-3">
              {error && (
                <p role="alert" className="text-sm text-brand-dark">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="cursor-pointer rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50">
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="border-t border-ink-950/10 p-4 text-sm text-ink-950/60 sm:p-5">This chart is inactive, so messaging is closed.</p>
      )}

      <ConfirmDialog
        open={closing}
        title="Close this topic?"
        description="It moves to Closed. A new message from either side reopens it."
        confirmLabel="Close topic"
        onConfirm={async () => {
          setClosing(false)
          await closeTopic(topic.chartId, topic.id, actor).catch(() => setError("Couldn't close the topic. Try again."))
        }}
        onCancel={() => setClosing(false)}
      />
    </section>
  )
}
```

- [x] **Step 6: `MessagesPage.jsx`:**

```jsx
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { byLatest, needsReply, topicCounts, unreadFor } from "../../lib/messageMath"
import PageHeader from "../layout/PageHeader"
import { formatRelativeTime } from "../lib/relativeTime"
import { loadCharts } from "../patients/chartStore"
import { formatDay } from "../patients/noteUi"
import { SearchIcon } from "../ui/icons"
import NewTopicDialog from "./NewTopicDialog"
import TopicView from "./TopicView"
import { useTopics } from "./useTopics"

const FILTERS = [
  ["needsReply", "Needs a reply"],
  ["open", "Open"],
  ["closed", "Closed"],
  ["all", "All"],
]
const EMPTY = {
  needsReply: "Nothing needs a reply.",
  open: "No open topics.",
  closed: "No closed topics.",
  all: "No messages yet. Patients' messages and your replies show here.",
}
const asIso = (value) => (typeof value?.toDate === "function" ? value.toDate().toISOString() : value ? new Date(value).toISOString() : null)
const when = (value, now) => {
  const iso = asIso(value)
  if (!iso) return ""
  return now - new Date(iso).getTime() < 86_400_000 ? formatRelativeTime(iso, now) : formatDay(iso)
}

// The care team's shared inbox (spec 2026-10-06-portal-messages-design).
// ?topic= opens one; ?patient= narrows the list to one chart.
export default function MessagesPage({ actor }) {
  const { topics, error } = useTopics()
  const [charts, setCharts] = useState(new Map())
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState(params.get("patient") ? "all" : "needsReply")
  const [search, setSearch] = useState("")
  const [composing, setComposing] = useState(false)
  const [now] = useState(() => Date.now())
  const selectedId = params.get("topic")
  const patient = params.get("patient")

  useEffect(() => {
    loadCharts()
      .then((all) => setCharts(new Map(all.map((chart) => [chart.id, chart]))))
      .catch((cause) => console.error("Could not load patients:", cause.code ?? cause.message))
  }, [])

  const nameOf = (chartId) => {
    const chart = charts.get(chartId)
    return chart ? `${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient" : "Patient"
  }

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (topics ?? [])
      .filter((topic) => !patient || topic.chartId === patient)
      .filter((topic) => (filter === "needsReply" ? needsReply(topic) : filter === "all" ? true : topic.status === filter))
      .filter((topic) => !needle || nameOf(topic.chartId).toLowerCase().includes(needle))
      .sort(byLatest)
    // nameOf reads charts, which is in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, filter, search, patient, charts])

  const counts = topicCounts(topics ?? [])
  const selected = topics?.find((topic) => topic.id === selectedId) ?? null
  const open = (topic) => {
    const next = new URLSearchParams(params)
    next.set("topic", topic.id)
    setParams(next)
  }
  const back = () => {
    const next = new URLSearchParams(params)
    next.delete("topic")
    setParams(next)
  }

  return (
    <div className="flex h-full flex-col pb-6">
      <PageHeader title="Messages" />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section aria-label="Topics" className={`flex min-h-0 flex-col rounded-2xl border border-ink-950/10 bg-white ${selected ? "hidden lg:flex" : "flex"}`}>
          <div className="space-y-3 border-b border-ink-950/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink-950">{patient ? `Messages with ${nameOf(patient)}` : "All patients"}</h2>
              <button type="button" onClick={() => setComposing(true)} className="cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark">
                New message
              </button>
            </div>
            <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                    filter === value ? "bg-accent-dark text-oncolor" : "bg-paper-100 text-ink-950/70 hover:bg-ink-950/10"
                  }`}
                >
                  {label}
                  {value === "needsReply" && counts.needsReply > 0 ? ` (${counts.needsReply})` : ""}
                </button>
              ))}
            </div>
            <label className="relative block">
              <span className="sr-only">Search by patient</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-950/40" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by patient"
                className="w-full rounded-lg border border-ink-950/15 bg-paper-50 py-2 pr-3 pl-9 text-sm text-ink-950 outline-none placeholder:text-ink-950/40 focus:border-ink-950/40"
              />
            </label>
            {patient && (
              <button type="button" onClick={() => setParams(new URLSearchParams())} className="cursor-pointer text-xs font-semibold text-accent-text hover:underline">
                Show all patients
              </button>
            )}
          </div>
          <ol className="min-h-0 flex-1 divide-y divide-ink-950/10 overflow-y-auto">
            {error ? (
              <li className="p-4 text-sm text-brand-dark">Couldn't load messages.</li>
            ) : !topics ? (
              <li className="p-4 text-sm text-ink-950/50">Loading…</li>
            ) : shown.length === 0 ? (
              <li className="p-6 text-center text-sm text-ink-950/55">{EMPTY[filter]}</li>
            ) : (
              shown.map((topic) => {
                const unread = unreadFor(topic, "staff")
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      onClick={() => open(topic)}
                      aria-current={topic.id === selectedId ? "true" : undefined}
                      className={`block w-full cursor-pointer px-4 py-3 text-left transition-colors duration-150 hover:bg-paper-50 ${topic.id === selectedId ? "bg-paper-100" : ""}`}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`truncate text-sm ${unread ? "font-semibold text-ink-950" : "text-ink-950/80"}`}>{nameOf(topic.chartId)}</span>
                        <span className="shrink-0 text-xs text-ink-950/50">{when(topic.lastMessageAt, now)}</span>
                      </span>
                      <span className={`mt-0.5 block truncate text-sm ${unread ? "font-semibold text-ink-950" : "text-ink-950/70"}`}>{topic.subject}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {needsReply(topic) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Needs a reply</span>}
                        {topic.status === "closed" && <span className="rounded-full bg-ink-950/10 px-2 py-0.5 text-xs font-medium text-ink-950/60">Closed</span>}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ol>
        </section>

        <div className={selected ? "min-h-0" : "hidden lg:block"}>
          {selected ? (
            <TopicView key={selected.id} topic={selected} chart={charts.get(selected.chartId)} actor={actor} onBack={back} />
          ) : (
            <div className="grid h-full min-h-60 place-items-center rounded-2xl border border-dashed border-ink-950/15 p-6 text-center text-sm text-ink-950/55">
              Choose a topic to read it.
            </div>
          )}
        </div>
      </div>

      {composing && (
        <NewTopicDialog
          actor={actor}
          initialChartId={patient ?? ""}
          onClose={() => setComposing(false)}
          onStarted={({ topicId }) => {
            setComposing(false)
            setFilter("all")
            const next = new URLSearchParams(params)
            next.set("topic", topicId)
            setParams(next)
          }}
        />
      )}
    </div>
  )
}
```

(The list's message preview is left out: the topic document doesn't hold the last message's text, and reading every topic's messages for the list would be one read per topic. Subject + time is enough to triage. Ledger this as a ruling.)

- [x] **Step 7: Sidebar and route.**

`Sidebar.jsx`: import `ChatIcon` and `useTopics` (`../inbox/useTopics`) and `needsReply` (`../../lib/messageMath`). Add after the Patients item:

```js
  { label: "Messages", icon: ChatIcon, to: "/admin/messages", page: "inbox" },
```

Below the contact-messages count:

```js
  const { topics } = useTopics({ enabled: canOpen("inbox", role) })
  const needsReplyCount = topics?.filter(needsReply).length ?? 0
```

and change the count line to:

```js
              const count = item.to === "/admin/queries" ? newMessageCount : item.to === "/admin/messages" ? needsReplyCount : 0
```

`AdminApp.jsx`: import `PatientMessages from "./inbox/MessagesPage"`; replace the `/admin/messages` redirect line (and its comment) with:

```jsx
      <Route path="/admin/messages" element={guard("inbox", <PatientMessages actor={actor} />)} />
```

- [x] **Step 8: Run the browser check** → all pass; read screenshots. `npm run lint`, `npm run build`, `npm run check`.

- [x] **Step 9: Commit**

```bash
git add src/admin
git commit -m "Admin: Messages page (shared inbox, topics, replies with email, close, new topic) and sidebar count"
```

---

### Task 6: Chart page "Messages" line

**Files:**
- Modify: `src/admin/patients/PatientChart.jsx`
- Test: extend `<scratchpad>/inbox-check.mjs`

**Interfaces:**
- Consumes: `useTopics`, `needsReply`.

- [x] **Step 1: Check first.** Add to `inbox-check.mjs`: open the seeded patient's chart → a "Messages" region shows "1 topic, 1 needs a reply" and a link to `/admin/messages?patient={id}`; a chart with none shows "No messages yet". Run → FAIL.

- [x] **Step 2: Implement.** In `PatientChart.jsx` import `useTopics` from `../inbox/useTopics` and `needsReply` from `../../lib/messageMath`. In the component body:

```js
  const { topics: allTopics } = useTopics()
  const chartTopics = allTopics?.filter((topic) => topic.chartId === chartId) ?? []
  const waiting = chartTopics.filter(needsReply).length
```

Under `<UpdatesCard … />`, before `<ProgressCard … />`:

```jsx
          <section aria-labelledby="chart-messages-heading" className="rounded-2xl border border-ink-950/10 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="chart-messages-heading" className="text-sm font-semibold text-ink-950">
                Messages
              </h2>
              <Link to={`/admin/messages?patient=${chart.id}`} className="text-xs font-semibold text-accent-text hover:underline">
                Open messages
              </Link>
            </div>
            <p className="mt-3 text-sm text-ink-950/70">
              {!allTopics
                ? "Loading…"
                : chartTopics.length === 0
                  ? "No messages yet"
                  : `${chartTopics.length} ${chartTopics.length === 1 ? "topic" : "topics"}${waiting ? `, ${waiting} ${waiting === 1 ? "needs" : "need"} a reply` : ""}`}
            </p>
          </section>
```

(`useTopics` must be called before the component's early returns, next to the other hooks.)

- [x] **Step 3: Run** the check → pass. Lint, build.

- [x] **Step 4: Commit**

```bash
git add src/admin/patients/PatientChart.jsx
git commit -m "Chart: Messages line linking to the patient's topics"
```

---

### Task 7: Portal router (`PortalApp`)

**Files:**
- Create: `src/portal/PortalApp.jsx`
- Modify: `src/portal/PortalHome.jsx` (keeps only the linked view, takes `{ user, link }`), `src/App.jsx` (`/account/*` → `PortalApp`), `src/portal/lib/patientAuth.js` (export `db`)
- Test: `<scratchpad>/portal-updates-check.mjs`, `<scratchpad>/portal-progress-check.mjs` (stubs gain `export const db = null`) — both must still pass unchanged otherwise

**Interfaces:**
- Produces: `PortalApp` (default export) handling sign-in states and routes; `PortalHome({ user, link })`; `export { db }` from `patientAuth.js`. Task 8 adds `messages` routes under it.

- [x] **Step 1: Stubs first.** Add `export const db = null` to the stubs in both portal checks. Run both → still ALL PASS (nothing reads `db` yet).

- [x] **Step 2: `PortalApp.jsx`.** Move everything from `PortalHome.jsx` except the `state === "linked"` block, `COMING_SOON` and `sideCard`, into a new `PortalApp`:

```jsx
import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, Route, Routes } from "react-router-dom"
import LoginPanel from "../components/LoginPanel"
import { ChevronRightIcon } from "../components/icons"
import { SUPPORT_PHONE } from "../lib/siteContact"
import { getMyPortalLink, signOutPatient, watchPatientUser } from "./lib/patientAuth"
import PortalHome from "./PortalHome"

const cardClass = "rounded-3xl border border-ink-950/10 bg-white p-8"
const primaryButton =
  "inline-flex rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
const secondaryButton =
  "rounded-full border border-ink-950/15 px-6 py-3 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-paper-100"
const inlineLink = "font-medium text-ink-950 underline underline-offset-2"

// The patient portal (/account/*). Invite-only (Louie, 2026-10-02): a login
// only opens the portal once patientAccounts/{uid} links it to an intake
// record. This handles signing in and the link once; the pages under it get
// { user, link }.
export default function PortalApp() {
  // (the state hooks, the getMyPortalLink effect, `current`, `link`, `state`
  // and `signOutButton` exactly as they are in PortalHome.jsx today)

  return (
    <section className={`mx-auto px-4 py-20 sm:px-6 ${state === "linked" ? "max-w-5xl" : "max-w-3xl"}`}>
      <Helmet>
        <title>Patient portal | CorePhia</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* the signedOut, error and notLinked blocks exactly as they are today */}

      {state === "linked" && (
        <Routes>
          <Route index element={<PortalHome user={user} link={link} />} />
        </Routes>
      )}

      <LoginPanel open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  )
}
```

Fill the two comment placeholders by moving the existing code verbatim from `PortalHome.jsx` (lines 30–76 and 85–139 of today's file); nothing in it changes.

`PortalHome.jsx` becomes:

```jsx
import { BadgeCheckIcon, MailIcon, PhoneIcon } from "../components/icons"
import { SUPPORT_PHONE } from "../lib/siteContact"
import { signOutPatient } from "./lib/patientAuth"
import PortalProgress from "./progress/PortalProgress"
import PortalUpdates from "./updates/PortalUpdates"

// (COMING_SOON and sideCard as today)

// The portal's home page for a linked patient (PortalApp handles signing in).
export default function PortalHome({ user, link }) {
  return (
    <div>
      {/* today's linked block from <header> to the closing grid </div>, unchanged */}
    </div>
  )
}
```

`patientAuth.js`: change `const db = app ? getFirestore(app) : null` to `export const db = app ? getFirestore(app) : null`.

`App.jsx`: `const PortalApp = lazy(() => import("./portal/PortalApp"))` replaces the `PortalHome` lazy import; the route becomes `path="/account/*"` with `<PortalApp />`. Update the comment above the lazy import to say "the portal".

- [x] **Step 3: Run** both portal checks → ALL PASS (no behaviour change). Lint, build.

- [x] **Step 4: Commit**

```bash
git add src/portal src/App.jsx
git commit -m "Portal: PortalApp handles sign-in and routes /account/*; PortalHome is the linked home page"
```

---

### Task 8: Portal Messages

**Files:**
- Create: `src/portal/lib/messageStore.js`, `src/portal/messages/MessagesBox.jsx`, `src/portal/messages/MessagesPage.jsx`, `src/portal/messages/ConversationView.jsx`, `src/portal/messages/NewConversationForm.jsx`
- Modify: `src/portal/PortalApp.jsx` (routes `messages`, `messages/:topicId`), `src/portal/PortalHome.jsx` (box under Updates; Messages off `COMING_SOON`)
- Test: `<scratchpad>/portal-messages-check.mjs`; `portal-updates-check.mjs` and `portal-progress-check.mjs` (route `**/src/portal/lib/messageStore.js*` to an empty stub; coming-soon now one item)

**Interfaces:**
- Consumes: `db` (Task 7), `notifiesStaff`, `unreadFor`, `byLatest`, `patientRoleLabel` (Task 2), `sendEmail`, `STAFF_TEMPLATE_ID`, `staffEmailConfigured` (Task 3), `SUPPORT_PHONE`.
- Produces (`messageStore.js`):
  - `listenMyTopics(intakeId, onChange, onError) → unsubscribe`
  - `listenMyMessages(intakeId, topicId, onChange, onError) → unsubscribe`
  - `getMyChartStatus(intakeId) → Promise<"active"|"inactive">`
  - `startConversation(intakeId, uid, { subject, body }) → Promise<topicId>`
  - `replyInConversation(intakeId, uid, topic, body) → Promise<void>` (`topic` is the topic before sending, for `notifiesStaff`)
  - `closeConversation(intakeId, topicId) → Promise<void>`
  - `markConversationRead(intakeId, topicId) → Promise<void>`

- [x] **Step 1: Browser check first.** `<scratchpad>/portal-messages-check.mjs`: stub `**/src/portal/lib/patientAuth.js*` (as `portal-progress-check.mjs`, plus `export const db = null`) and `**/src/portal/lib/messageStore.js*` with an in-page store:

```js
const messagesStub = (mode) => `
const now = Date.now()
const t = (h) => new Date(now - h * 3600000)
let topics = [
  { id: "t1", subject: "Dizzy in the mornings", status: "open", startedBy: "patient", createdAt: t(30), lastMessageAt: t(3), lastFrom: "staff", lastMessageId: "m2", patientReadAt: t(20), staffReadAt: t(3), closed: null },
  { id: "t2", subject: "Old question", status: "closed", startedBy: "patient", createdAt: t(300), lastMessageAt: t(290), lastFrom: "staff", lastMessageId: "x", patientReadAt: t(280), staffReadAt: t(290), closed: { by: "patient", name: "", at: t(280) } },
]
let messages = {
  t1: [
    { id: "m1", body: "I feel dizzy in the mornings.", from: { kind: "patient", uid: "u" }, createdAt: t(30) },
    { id: "m2", body: "Eat before your dose and tell us how it goes.", from: { kind: "staff", uid: "s", name: "Dr. Antonious", role: "admin" }, createdAt: t(3) },
  ],
  t2: [{ id: "x", body: "Answered.", from: { kind: "staff", uid: "s", name: "Sam Rivera, RD", role: "dietitian" }, createdAt: t(290) }],
}
if ("${mode}" === "empty") { topics = []; messages = {} }
window.__staffNotices = 0
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())
const notifies = (before) => !before || before.lastFrom === "staff" || before.status === "closed"
export function listenMyTopics(intakeId, onChange, onError) {
  if ("${mode}" === "error") { queueMicrotask(() => onError(new Error("denied"))); return () => {} }
  const fn = () => onChange(topics.map((x) => ({ ...x })))
  listeners.add(fn); queueMicrotask(fn); return () => listeners.delete(fn)
}
export function listenMyMessages(intakeId, topicId, onChange) {
  const fn = () => onChange([...(messages[topicId] ?? [])])
  listeners.add(fn); queueMicrotask(fn); return () => listeners.delete(fn)
}
export async function getMyChartStatus() { return "${mode}" === "inactive" ? "inactive" : "active" }
export async function startConversation(intakeId, uid, { subject, body }) {
  if ("${mode}" === "sendFails") throw new Error("offline")
  const id = "n" + topics.length
  topics.push({ id, subject, status: "open", startedBy: "patient", createdAt: new Date(), lastMessageAt: new Date(), lastFrom: "patient", lastMessageId: "a", patientReadAt: new Date(), staffReadAt: null, closed: null })
  messages[id] = [{ id: "a", body, from: { kind: "patient", uid }, createdAt: new Date() }]
  window.__staffNotices += 1; emit(); return id
}
export async function replyInConversation(intakeId, uid, topic, body) {
  if ("${mode}" === "sendFails") throw new Error("offline")
  if (notifies(topic)) window.__staffNotices += 1
  const target = topics.find((x) => x.id === topic.id)
  Object.assign(target, { lastMessageAt: new Date(), lastFrom: "patient", status: "open", closed: null, patientReadAt: new Date() })
  messages[topic.id].push({ id: "r" + Math.random(), body, from: { kind: "patient", uid }, createdAt: new Date() })
  emit()
}
export async function closeConversation(intakeId, topicId) {
  Object.assign(topics.find((x) => x.id === topicId), { status: "closed", closed: { by: "patient", name: "", at: new Date() } }); emit()
}
export async function markConversationRead(intakeId, topicId) {
  topics.find((x) => x.id === topicId).patientReadAt = new Date(); emit()
}
`
```

Cases (fresh context each):
1. `/account`: a Messages box under Updates; shows "Dizzy in the mornings" with "New reply"; **New message** and **All messages**; "Coming to your portal" lists only Membership.
2. `/account/messages`: Open tab lists t1 with New reply; Closed tab lists t2.
3. Open t1: patient message on the right labelled "You", staff on the left "Dr. Antonious (Provider)"; after opening, back on the list New reply is gone.
4. Reply twice in t1 → both appear; `window.__staffNotices` is 1 (only the first made it need a reply).
5. Close conversation → confirm → "Closed by you on …"; reply → reopens (status shows open again), `__staffNotices` +1.
6. New message: subject "Question about snacks", body → Send → the conversation opens; `__staffNotices` +1. The urgent line is visible on the form: "For anything urgent, call us at (000) 123-4567. In an emergency, call 911."
7. Empty subject → "Add a subject."; empty body → "Write a message first."
8. `sendFails`: reply → "Couldn't send your message. Try again." and the text is kept.
9. `inactive`: conversation readable, compose replaced by "Messaging is closed. Call us at (000) 123-4567 or email info@corephia.com."; **New message** hidden.
10. `empty`: box says "Questions about your care? Send your care team a message."
11. `error`: "We couldn't load your messages." with Try again.
12. Body `<b>x</b>` and a 300-character word → shown as text; no horizontal scroll at 390; screenshots 1280 and 390 (list, conversation). Read them.

Also add `await page.route("**/src/portal/lib/messageStore.js*", …)` with an empty-store stub (`mode = "empty"` of the same stub) to `portal-updates-check.mjs` and `portal-progress-check.mjs`, and change their coming-soon expectations to one item (Membership).

Run: FAIL.

- [x] **Step 2: `messageStore.js`:**

```js
// Patient messages from the portal side (spec 2026-10-06-portal-messages-design).
// Each write is one batch firestore.rules ties together. After a patient
// message that makes the topic newly need a reply, info@ gets a content-free
// staff notice; its failure is logged, never shown (the message is saved).
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore"
import { STAFF_TEMPLATE_ID, sendEmail, staffEmailConfigured } from "../../lib/emailjs"
import { notifiesStaff } from "../../lib/messageMath"
import { db } from "./patientAuth"

const topicsOf = (intakeId) => collection(db, "patients", intakeId, "topics")

function notifyStaff() {
  if (!staffEmailConfigured) return
  sendEmail({ admin_link: `${window.location.origin}/admin/messages` }, STAFF_TEMPLATE_ID).catch((cause) =>
    console.error("Could not send the staff notice:", cause.message),
  )
}

export function listenMyTopics(intakeId, onChange, onError) {
  if (!db) {
    onChange([])
    return () => {}
  }
  return onSnapshot(topicsOf(intakeId), (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))), onError)
}

export function listenMyMessages(intakeId, topicId, onChange, onError) {
  if (!db) {
    onChange([])
    return () => {}
  }
  return onSnapshot(
    query(collection(db, "patients", intakeId, "topics", topicId, "messages"), orderBy("createdAt", "asc")),
    (snapshot) => onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    onError,
  )
}

export async function getMyChartStatus(intakeId) {
  if (!db) return "inactive"
  const snap = await getDoc(doc(db, "patients", intakeId))
  return snap.data()?.status === "active" ? "active" : "inactive"
}

export async function startConversation(intakeId, uid, { subject, body }) {
  const topicRef = doc(topicsOf(intakeId))
  const messageRef = doc(collection(topicRef, "messages"))
  const batch = writeBatch(db)
  batch.set(topicRef, {
    subject,
    status: "open",
    startedBy: "patient",
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastFrom: "patient",
    lastMessageId: messageRef.id,
    patientReadAt: serverTimestamp(),
    staffReadAt: null,
    closed: null,
  })
  batch.set(messageRef, { body, from: { kind: "patient", uid }, createdAt: serverTimestamp(), email: "none" })
  await batch.commit()
  notifyStaff()
  return topicRef.id
}

export async function replyInConversation(intakeId, uid, topic, body) {
  const topicRef = doc(topicsOf(intakeId), topic.id)
  const messageRef = doc(collection(topicRef, "messages"))
  const batch = writeBatch(db)
  batch.update(topicRef, {
    lastMessageAt: serverTimestamp(),
    lastFrom: "patient",
    lastMessageId: messageRef.id,
    status: "open",
    closed: null,
    patientReadAt: serverTimestamp(),
  })
  batch.set(messageRef, { body, from: { kind: "patient", uid }, createdAt: serverTimestamp(), email: "none" })
  await batch.commit()
  if (notifiesStaff(topic)) notifyStaff()
}

export async function closeConversation(intakeId, topicId) {
  await updateDoc(doc(topicsOf(intakeId), topicId), { status: "closed", closed: { by: "patient", name: "", at: serverTimestamp() } })
}

export async function markConversationRead(intakeId, topicId) {
  await updateDoc(doc(topicsOf(intakeId), topicId), { patientReadAt: serverTimestamp() })
}
```

- [x] **Step 3: `NewConversationForm.jsx`:**

```jsx
import { useState } from "react"
import { SUPPORT_PHONE } from "../../lib/siteContact"
import { startConversation } from "../lib/messageStore"

const field =
  "w-full rounded-xl border border-ink-950/15 bg-white px-3 py-2.5 text-ink-950 outline-none transition-colors duration-200 focus:border-ink-950/45"

export function UrgentLine() {
  return (
    <p className="text-sm text-ink-950/65">
      For anything urgent, call us at {SUPPORT_PHONE}. In an emergency, call 911.
    </p>
  )
}

export default function NewConversationForm({ intakeId, uid, onStarted, onCancel }) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    if (!subject.trim()) return setError("Add a subject.")
    if (!body.trim()) return setError("Write a message first.")
    if (body.trim().length > 2000) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      onStarted(await startConversation(intakeId, uid, { subject: subject.trim(), body: body.trim() }))
    } catch {
      setError("Couldn't send your message. Try again.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-paper-100 p-5">
      <UrgentLine />
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-950/75">Subject</span>
        <input value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-950/75">Message</span>
        <textarea value={body} rows={5} onChange={(event) => setBody(event.target.value)} className={`${field} resize-y leading-relaxed`} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-brand-dark">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-ink-900 disabled:opacity-60">
          {busy ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={onCancel} className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold text-ink-950/70 transition-colors duration-200 hover:bg-paper-200">
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [x] **Step 4: `ConversationView.jsx`:**

```jsx
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { patientRoleLabel, unreadFor } from "../../lib/messageMath"
import { SUPPORT_PHONE } from "../../lib/siteContact"
import { closeConversation, listenMyMessages, markConversationRead, replyInConversation } from "../lib/messageStore"
import { UrgentLine } from "./NewConversationForm"

const stamp = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""
}
const day = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""
}

export default function ConversationView({ intakeId, uid, topic, canWrite }) {
  const [messages, setMessages] = useState(null)
  const [failed, setFailed] = useState(false)
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const dialogRef = useRef(null)

  useEffect(() => listenMyMessages(intakeId, topic.id, setMessages, () => setFailed(true)), [intakeId, topic.id])
  const unread = unreadFor(topic, "patient")
  useEffect(() => {
    if (unread) markConversationRead(intakeId, topic.id).catch(() => {})
  }, [unread, intakeId, topic.id])

  const send = async (event) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return setError("Write a message first.")
    if (text.length > 2000) return setError("Keep it to 2,000 characters.")
    setBusy(true)
    setError(null)
    try {
      await replyInConversation(intakeId, uid, topic, text)
      setBody("")
    } catch {
      setError("Couldn't send your message. Try again.")
    }
    setBusy(false)
  }

  return (
    <section aria-labelledby="conversation-heading" className="rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <Link to="/account/messages" className="text-sm font-medium text-ink-950/60 transition-colors hover:text-ink-950">
        All messages
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 id="conversation-heading" className="font-serif text-2xl wrap-break-word text-ink-950">
          {topic.subject}
        </h1>
        {canWrite && topic.status === "open" && (
          <button type="button" onClick={() => dialogRef.current?.showModal()} className="cursor-pointer rounded-full border border-ink-950/15 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-paper-100">
            Close conversation
          </button>
        )}
      </div>
      {topic.status === "closed" && (
        <p className="mt-2 text-sm text-ink-950/60">
          Closed by {topic.closed?.by === "patient" ? "you" : "your care team"} on {day(topic.closed?.at)}. Write below to reopen it.
        </p>
      )}

      <ol className="mt-6 space-y-3">
        {failed ? (
          <li className="text-ink-950/70">We couldn't load your messages.</li>
        ) : !messages ? (
          <li className="text-sm text-ink-950/60">Loading…</li>
        ) : (
          messages.map((message) => {
            const mine = message.from?.kind === "patient"
            return (
              <li key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "bg-accent/15" : "bg-paper-100"}`}>
                  <p className="text-xs text-ink-950/55">
                    {mine ? "You" : `${message.from.name} (${patientRoleLabel(message.from.role)})`}, {stamp(message.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-line wrap-anywhere text-ink-950">{message.body}</p>
                </div>
              </li>
            )
          })
        )}
      </ol>

      {canWrite ? (
        <form onSubmit={send} className="mt-6 space-y-3">
          <UrgentLine />
          <label className="sr-only" htmlFor="conversation-reply">
            Reply
          </label>
          <textarea
            id="conversation-reply"
            value={body}
            rows={4}
            placeholder="Write a reply"
            onChange={(event) => setBody(event.target.value)}
            className="w-full resize-y rounded-xl border border-ink-950/15 bg-white px-3 py-2.5 leading-relaxed text-ink-950 outline-none focus:border-ink-950/45"
          />
          {error && (
            <p role="alert" className="text-sm text-brand-dark">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors hover:bg-ink-900 disabled:opacity-60">
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
      ) : (
        <p className="mt-6 rounded-2xl bg-paper-100 p-4 text-sm text-ink-950/70">
          Messaging is closed. Call us at {SUPPORT_PHONE} or email info@corephia.com.
        </p>
      )}

      <dialog ref={dialogRef} aria-labelledby="close-conversation-title" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white p-6 shadow-2xl backdrop:bg-ink-950/50">
        <p id="close-conversation-title" className="font-serif text-xl text-ink-950">
          Close this conversation?
        </p>
        <p className="mt-2 text-sm text-ink-950/70">You can still read it, and writing again reopens it.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-ink-950/70 hover:bg-paper-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              dialogRef.current?.close()
              await closeConversation(intakeId, topic.id).catch(() => setError("Couldn't close the conversation. Try again."))
            }}
            className="cursor-pointer rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-paper-50 hover:bg-ink-900"
          >
            Close conversation
          </button>
        </div>
      </dialog>
    </section>
  )
}
```

- [x] **Step 5: `MessagesPage.jsx`** (`/account/messages` and `/account/messages/:topicId`) and **`MessagesBox.jsx`** (home):

```jsx
// MessagesPage.jsx
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { byLatest, unreadFor } from "../../lib/messageMath"
import { getMyChartStatus, listenMyTopics } from "../lib/messageStore"
import ConversationView from "./ConversationView"
import NewConversationForm from "./NewConversationForm"

const when = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
}

export function useMyTopics(intakeId) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ topics: null, failed: false })
  useEffect(
    () =>
      listenMyTopics(
        intakeId,
        (topics) => setState({ topics: [...topics].sort(byLatest), failed: false }),
        (cause) => {
          console.error("Could not load messages:", cause.code ?? cause.message)
          setState({ topics: null, failed: true })
        },
      ),
    [intakeId, attempt],
  )
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}

export function useCanWrite(intakeId) {
  const [canWrite, setCanWrite] = useState(true)
  useEffect(() => {
    let live = true
    getMyChartStatus(intakeId)
      .then((status) => live && setCanWrite(status === "active"))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [intakeId])
  return canWrite
}

export default function MessagesPage({ user, link }) {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const { topics, failed, retry } = useMyTopics(link.intakeId)
  const canWrite = useCanWrite(link.intakeId)
  const [tab, setTab] = useState("open")
  const [composing, setComposing] = useState(false)
  const topic = topicId ? topics?.find((entry) => entry.id === topicId) : null

  if (topicId) {
    if (!topics) return <p className="text-ink-950/60">{failed ? "We couldn't load your messages." : "Loading…"}</p>
    if (!topic) return <p className="text-ink-950/70">That conversation couldn't be found. <Link to="/account/messages" className="underline">All messages</Link></p>
    return <ConversationView intakeId={link.intakeId} uid={user.uid} topic={topic} canWrite={canWrite} />
  }

  const listed = (topics ?? []).filter((entry) => entry.status === tab)
  return (
    <section aria-labelledby="messages-heading" className="rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <Link to="/account" className="text-sm font-medium text-ink-950/60 transition-colors hover:text-ink-950">
        Back to your portal
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 id="messages-heading" className="font-serif text-3xl text-ink-950">
          Messages
        </h1>
        {canWrite && !composing && (
          <button type="button" onClick={() => setComposing(true)} className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors hover:bg-ink-900">
            New message
          </button>
        )}
      </div>
      {composing && (
        <div className="mt-6">
          <NewConversationForm intakeId={link.intakeId} uid={user.uid} onCancel={() => setComposing(false)} onStarted={(id) => navigate(`/account/messages/${id}`)} />
        </div>
      )}
      <div role="tablist" aria-label="Conversations" className="mt-6 flex gap-2">
        {[
          ["open", "Open"],
          ["closed", "Closed"],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            type="button"
            onClick={() => setTab(value)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === value ? "bg-ink-950 text-paper-50" : "bg-paper-100 text-ink-950/70 hover:bg-paper-200"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {failed ? (
        <div className="mt-6">
          <p className="text-ink-950/75">We couldn't load your messages.</p>
          <button type="button" onClick={retry} className="mt-4 cursor-pointer rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-paper-100">
            Try again
          </button>
        </div>
      ) : !topics ? (
        <p className="mt-6 text-sm text-ink-950/60">Loading…</p>
      ) : listed.length === 0 ? (
        <p className="mt-6 text-ink-950/70">{tab === "open" ? "No open conversations." : "No closed conversations."}</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-950/10">
          {listed.map((entry) => (
            <li key={entry.id}>
              <Link to={`/account/messages/${entry.id}`} className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-accent-dark">
                <span className="min-w-0 truncate font-medium text-ink-950">{entry.subject}</span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-ink-950/60">
                  {unreadFor(entry, "patient") && <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-ink-950">New reply</span>}
                  {when(entry.lastMessageAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

```jsx
// MessagesBox.jsx
import { Link } from "react-router-dom"
import { unreadFor } from "../../lib/messageMath"
import { useCanWrite, useMyTopics } from "./MessagesPage"

// The portal home's Messages box: the 3 latest conversations.
export default function MessagesBox({ intakeId }) {
  const { topics, failed, retry } = useMyTopics(intakeId)
  const canWrite = useCanWrite(intakeId)
  const latest = topics?.slice(0, 3) ?? []
  return (
    <section id="messages" aria-labelledby="messages-box-heading" className="scroll-mt-24 rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="messages-box-heading" className="font-serif text-2xl text-ink-950">
          Messages
        </h2>
        <div className="flex gap-2">
          {canWrite && (
            <Link to="/account/messages?new=1" className="rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors hover:bg-ink-900">
              New message
            </Link>
          )}
          <Link to="/account/messages" className="rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-paper-100">
            All messages
          </Link>
        </div>
      </div>
      {failed ? (
        <div className="mt-6">
          <p className="text-ink-950/75">We couldn't load your messages.</p>
          <button type="button" onClick={retry} className="mt-4 cursor-pointer rounded-full border border-ink-950/15 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-paper-100">
            Try again
          </button>
        </div>
      ) : !topics ? (
        <p className="mt-6 text-sm text-ink-950/60">Loading your messages…</p>
      ) : latest.length === 0 ? (
        <p className="mt-6 text-ink-950/70">Questions about your care? Send your care team a message.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-950/10">
          {latest.map((topic) => (
            <li key={topic.id}>
              <Link to={`/account/messages/${topic.id}`} className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-accent-dark">
                <span className="min-w-0 truncate text-ink-950">{topic.subject}</span>
                {unreadFor(topic, "patient") && <span className="shrink-0 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-ink-950">New reply</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

In `MessagesPage`, open the form when `?new=1`: `const [params] = useSearchParams()` and `useState(params.get("new") === "1")` for `composing`.

- [x] **Step 6: Wire it.** `PortalApp.jsx` routes:

```jsx
        <Routes>
          <Route index element={<PortalHome user={user} link={link} />} />
          <Route path="messages" element={<MessagesPage user={user} link={link} />} />
          <Route path="messages/:topicId" element={<MessagesPage user={user} link={link} />} />
        </Routes>
```

`PortalHome.jsx`: import `MessagesBox`; add `<MessagesBox intakeId={link.intakeId} />` after `<PortalUpdates … />`; remove the Messages row from `COMING_SOON` (and `MailIcon` if now unused there; the care-team box still uses it).

- [x] **Step 7: Run** `portal-messages-check.mjs` (all pass), `portal-updates-check.mjs` and `portal-progress-check.mjs` (with the messageStore stub; all pass). Read screenshots. `humanizer` over the new copy. `npm run lint`, `npm run build`.

- [x] **Step 8: Commit**

```bash
git add src/portal
git commit -m "Portal: Messages (home box, conversations page, start, reply, close; staff notice to info@)"
```

---

### Task 9: Docs and verification

**Files:**
- Modify: `docs/client-portal.md` ("Where we left off": Messages built; setup and deploy notes)

- [x] **Step 1:** In "Where we left off", add: Messages is built (spec and plan paths), two sentences on what it does, the two EmailJS templates to set up (portal notice, staff notice with info@ fixed in the template), and that the rules must be deployed before hosting (the new rules also let a patient read their own chart record). Mark nothing else.
- [x] **Step 2:** Load `superpowers:verification-before-completion`. Run and report: `npm run test:rules`, `npm run check`, `npm run lint`, `npm run build`, every scratchpad browser check (`inbox-check`, `portal-messages-check`, `portal-progress-check`, `portal-updates-check`, `updates-check`, `progress-chart-check`, `portal-active-check`).
- [x] **Step 3: Commit**

```bash
git add docs/client-portal.md docs/superpowers/plans/2026-10-06-portal-messages.md
git commit -m "Docs: Messages built; where we left off"
```
