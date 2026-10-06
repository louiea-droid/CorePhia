# Client portal: Messages — design

2026-10-06. Decisions are Louie's, made in conversation the same day. Third portal
section (`docs/client-portal.md`, order Updates → Track progress → Messages). Builds on the
invite-only login: a patient's login is linked to their chart by
`patientAccounts/{uid}.intakeId`, and the chart id is the intake id.

## What and why

The portal doc scoped it as "two-way messages, a staff inbox in the admin, 'new message'
email alerts". Patients write to their care team about their care; staff answer from a new
admin page.

Decisions:
- **One shared care-team inbox.** Every clinical role (dietitian included) sees every
  topic; whoever replies is shown to the patient by name and role.
- **Separate topics** with a subject, like email threads. Staff can start one too.
- **Either side can close a topic**; writing in it again reopens it.
- **Staff learn of a patient message** from a sidebar count and an email to
  info@corephia.com ("a patient sent a message"), nothing more.
- **The patient learns of a staff message** by email when a tick box (on by default) is
  left ticked.
- **A new admin page**, `/admin/messages`, not part of the chart page.

Out of scope: attachments, editing or deleting messages, assigning topics to a person,
typing indicators, read receipts shown to the other side, a promised reply time, push or
SMS notifications, telemedicine.

## Constraints

- Messages are PHI: same BAA note as charts, updates and progress. Emails never carry a
  name, subject or text.
- Messages and topics are never edited or deleted (medical record), like signed notes.
- Patient copy: "CorePhia", no em dashes, plain words; patients see "conversation", staff
  see "topic". Every compose box shows: "For anything urgent, call us at {SUPPORT_PHONE}.
  In an emergency, call 911."
- No new dependencies. Admin tokens and dark mode on the admin page; site tokens in the
  portal. Hover = colour only.
- Store pattern with the demo branch (`getDemoStore()`, `demoId()`) on the staff side.
- Only an active chart can start or add to topics; an inactive chart's topics stay
  readable.

## Data

**Topic** `patients/{chartId}/topics/{topicId}`:
```
{ subject, status: 'open'|'closed', startedBy: 'patient'|'staff', createdAt,
  lastMessageAt, lastFrom: 'patient'|'staff', lastMessageId,
  patientReadAt, staffReadAt, closed: null | { by: 'patient'|'staff', name, at } }
```
`subject` 1–120 characters. `patientReadAt` / `staffReadAt` are null until that side opens
it. `closed.name` is the staff member's name, or "" when the patient closed it.

**Message** `patients/{chartId}/topics/{topicId}/messages/{messageId}`:
```
{ body, from: { kind: 'patient', uid } | { kind: 'staff', uid, name, role },
  createdAt, email: 'none'|'sent'|'failed' }
```
`body` 1–2000 characters. Patient messages are always `email: 'none'` (their notice goes
to info@ and isn't recorded per message).

## Rules

Helpers: `isLinkedPatient()` (as in progress: `patientAccounts/{uid}.intakeId ==
chartId`), `chartIsActive()` (`patients/{chartId}.status == 'active'`), and
`myKind()` = `'staff'` if `isClinical()` else `'patient'` when `isLinkedPatient()`.

**Topic create** (by the linked patient or `isClinical()`, chart active): exact keys;
subject length; `status == 'open'`; `startedBy == lastFrom == myKind()`; `createdAt ==
lastMessageAt == request.time`; `closed == null`; the sender's own read time is
`request.time` and the other side's is null; `existsAfter` the message at
`lastMessageId`. So a topic is only ever created together with its first message.

**Message create** (same people, chart active): exact keys; body length; `from` is the
sender (patient: `{ kind: 'patient', uid: me }`; staff: `{ kind: 'staff', uid: me, name:
myName(), role: role() }`); `createdAt == request.time`; `email == 'none'`; and
`getAfter` of the topic shows `lastMessageId == messageId` and `lastMessageAt ==
request.time`. So every message moves the topic in the same save.

**Topic update**, exactly one of:
- *New message:* only `lastMessageAt`, `lastFrom`, `lastMessageId`, `status`, `closed` and
  the sender's own read time change; `lastFrom == myKind()`; `lastMessageAt ==
  request.time`; `status == 'open'`; `closed == null`; the sender's read time ==
  request.time; `existsAfter` the message at `lastMessageId` and it didn't exist before.
- *Read:* only `patientReadAt` (linked patient) or only `staffReadAt` (clinical) changes,
  to `request.time`.
- *Close:* only `status` and `closed` change, from `'open'` to `'closed'` and `{ by:
  myKind(), name: myName() or '', at: request.time }`.

**Message update:** only `email`, from `'none'` to `'sent'` or `'failed'`, by the staff
member who wrote it.

**Delete:** never.

**Read:** `isClinical()`, or the linked patient for their own chart. Plus a collection-group
rule `match /{path=**}/topics/{topicId}` allowing `isClinical()` to read, for the inbox
query across charts.

## Staff: the Messages page

- **Sidebar:** "Messages" right under Patients, all clinical roles (page key `inbox`; the
  existing `messages` key stays with Queries). Its count = open topics whose `lastFrom ==
  'patient'`. The old `/admin/messages` → `/admin/queries` redirect is removed; the new page
  takes the address.
- **Layout:** list left, topic right on desktop; list then topic with Back on a phone.
- **List:** filters Needs a reply (default) / Open / Closed / All; search by patient name.
  Row: patient name, subject, start of the latest message, relative time; bold when
  `staffReadAt` is before `lastMessageAt`; "Needs a reply" tag when `lastFrom ==
  'patient'` and open. Empty states per filter ("Nothing needs a reply.").
- **New message:** picks a patient (existing `PatientPicker`, active charts only), subject,
  message, email tick box; Send.
- **Topic:** header with subject, patient name (link to the chart), status, Close topic /
  Reopen (Reopen = a new message; no separate action, so the button focuses the reply box
  with a hint "Write a reply to reopen"). Messages oldest first: patient left, staff right
  with "{name} ({role label})"; date and time; staff messages show Email sent / Email not
  sent / Not emailed. Reply box: 2000 characters, counter near the limit, "Email the
  patient that there's a new message" ticked by default (disabled with "Email sending
  isn't set up yet." or "There's no email on this intake."), Send / "Sending…"; errors
  inline, text kept. Opening a topic sets `staffReadAt`. Inactive chart: read-only, with
  "This chart is inactive, so messaging is closed."
- **Live:** the list and the open topic use Firestore listeners (`onSnapshot`); demo mode
  polls the in-memory store.
- **Chart page:** a "Messages" line in the summary column ("3 topics, 1 needs a reply" or
  "No messages yet") linking to `/admin/messages?patient={chartId}`, which filters the list
  to that patient.

## Patient: the portal

- **Routing:** `src/portal/PortalApp.jsx` routes `/account` (PortalHome) and
  `/account/messages` (+ `/account/messages/:topicId`). App.jsx's `/account` becomes
  `/account/*`. `/portal/setup` and `/portal/reset` are unchanged.
- **Portal page:** a Messages box under Updates: the 3 most recent conversations
  (subject, relative time, "New reply" when `lastFrom == 'staff'` and `patientReadAt` is
  before `lastMessageAt`), **New message** and **All messages**. Empty: "Questions about
  your care? Send your care team a message." Messages comes off `COMING_SOON`.
- **Messages page:** Open / Closed tabs; rows with subject, last activity, New reply.
  **New message** form: subject (120), message (2000), the urgent line, Send / "Sending…".
- **Conversation:** patient's messages right ("You"), care team's left with name and
  patient-facing role (Provider / Dietitian / Care team, as Updates); date and time; reply
  box with the urgent line; **Close conversation** behind a confirm; closed shows "Closed
  by you on {date}" or "Closed by your care team on {date}", and a reply reopens it.
  Opening sets `patientReadAt`. Live via `onSnapshot`.
- **Errors:** send failure keeps the text: "Couldn't send your message. Try again."; load
  failure: "We couldn't load your messages." with Try again.
- **Inactive chart:** read-only; the compose areas are replaced by "Messaging is closed.
  Call us at {SUPPORT_PHONE} or email info@corephia.com."
- Phone: list, then conversation full width with Back.

## Emails

EmailJS, as invites and updates. `emailjs.js` moves from `src/admin/lib/` to `src/lib/` so
the portal can use it without loading admin code.

- **One "portal notice" template** for Updates and Messages: To `{{to_email}}`, Subject
  `{{subject}}`, body `{{notice}}`, button **Open your portal** → `{{portal_link}}`.
  Env `VITE_EMAILJS_PORTAL_TEMPLATE_ID` replaces `VITE_EMAILJS_UPDATE_TEMPLATE_ID` (not set
  up yet). Updates send notice "Your CorePhia care team posted an update. Log in to your
  portal to read it." and link `/account`; Messages send subject "You have a new message
  from CorePhia", notice "Your CorePhia care team sent you a message. Log in to your portal
  to read it." and link `/account/messages`. Sent to the intake's `demographics.email`.
- **Staff notice template:** To **info@corephia.com, fixed in the template** (never a
  parameter), Subject "New patient message", body "A patient sent a message in the
  CorePhia portal. Log in to the admin to read it.", button → `{{admin_link}}`
  (`${origin}/admin/messages`). Env `VITE_EMAILJS_STAFF_TEMPLATE_ID`. Sent from the
  patient's browser only when the patient's message makes the topic newly need a reply: a
  new topic, or a message when `lastFrom` was `'staff'`. Failure is logged, never shown;
  the message is already saved.
- Without the keys, nothing is emailed; the admin box says "Email sending isn't set up
  yet."; the patient sees no difference.

## Code layout

- `src/lib/messageMath.js` (pure; `messageMath.check.js` in `npm run check`):
  `needsReply(topic)`, `unreadFor(topic, side)`, `notifiesStaff(topicBefore)`,
  `topicCounts(topics)`, `PATIENT_ROLE_LABELS` (moved from Updates' `AUTHOR_ROLES`).
- `src/lib/emailjs.js` (moved); `PORTAL_TEMPLATE_ID`, `STAFF_TEMPLATE_ID`,
  `portalEmailConfigured`, `staffEmailConfigured`.
- `src/admin/inbox/`: `topicStore.js` (list/listen, load topic, start topic, reply, close,
  mark read, email result; demo branch), `MessagesPage.jsx`, `TopicList.jsx`,
  `TopicView.jsx`, `NewTopicDialog.jsx`. Sidebar entry, `roles.js` page key `inbox`,
  AdminApp route, PatientChart "Messages" line.
- `src/portal/PortalApp.jsx`; `src/portal/lib/messageStore.js` (patient listen, start,
  reply, close, mark read, staff notice); `src/portal/messages/`: `MessagesBox.jsx`,
  `MessagesPage.jsx`, `ConversationView.jsx`, `NewConversationForm.jsx`.
- `src/admin/patients/updateStore.js`: send through the portal notice template.

## Testing

- `npm run test:rules`: topic + first message together (patient ok; staff ok; topic alone
  refused; message alone refused; inactive chart refused; other chart refused; staff with
  a fake name refused); reply (moves the topic; reply without moving the topic refused;
  reply in a closed topic reopens it); read markers (each side only its own; other fields
  refused); close (either side; wrong name refused; closing twice refused); email result
  (author only, none → sent/failed); no edits or deletes; reads (patient own only; signed
  out refused; collection-group read by staff ok, by a patient refused).
- `npm run check`: `messageMath`.
- Browser (Playwright, stubs as before): admin inbox (filters, needs-a-reply count, open a
  topic marks it read, reply with email failed, close and reopen, new topic, inactive
  chart read-only, light/dark, 390 px); portal (box on the home page, new conversation,
  reply, close, New reply tag, inactive account, 390 px).
