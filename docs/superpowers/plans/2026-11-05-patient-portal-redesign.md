# Patient Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Once signed in, the patient portal is its own calm space (sidebar on computers, tab bar on phones, no website frame), with a "What's next" reminders card and the patient's own booked visits.

**Architecture:** `App.jsx` branches the portal paths out of the website frame, like `/admin`. A new `PortalShell` wraps the existing portal state machine and pages. The reminders come from one pure function (`whatsNext`). Visits reach patients through a server-written, patient-safe copy (`patients/{id}/visits/{id}`) made by Cloud Functions, so the staff-only appointment note never leaves the staff side.

**Tech Stack:** React 19, Tailwind v4 tokens in `src/index.css`, react-router v7, Firebase Firestore and rules (emulator tests), Cloud Functions v2 (Node 22, us-central1).

**Spec:** `docs/superpowers/specs/2026-11-05-patient-portal-redesign-design.md`. Mockup: `.superpowers/brainstorm/2305-1793905472/content/portal-preview.html` (open it in a browser and match it).

## Global Constraints

- Colours and fonts: site tokens only (`ink-950`, `paper-50`, `accent`, `accent-dark`, `brand`, Fraunces headings with `font-serif`, Inter body). No portal dark mode.
- Staff are named by role, never by name: "your provider", "your dietitian", "your care team" (`PATIENT_ROLE_LABELS` in `src/lib/messageMath.js`).
- No medication reminders or wording. No "follow-up due" dates.
- Visitor-facing copy: no em dashes; "form" not "intake"; load the `humanizer` skill for new lines.
- Hover changes colour only, never position. Visible keyboard focus everywhere.
- No overlapping or clipped text at 375, 768, 1100 and 1440 px.
- Visit times in Tampa time (`TIME_ZONE`, `tampaParts`, `todayInTampa` in `src/admin/calendar/calendarMath.js`).
- `/account`, `/portal/*` stay out of analytics (`googleAnalytics.check.js` must keep passing).
- UI tasks load `frontend-design`, `ui-ux-pro-max` (checklist by hand, no Python), `react-best-practices`, `senior-frontend` first.
- `functions/emails.js` and `functions/emails.check.js` hold the user's uncommitted edits: never stage them.

## Review Focus

1. **A visit later today, or one whose start is past but end is not.** Row 2 shows until `start + minutes`, then the next row wins (Task 1 test).
2. **A patient with several topics, one unread.** "New reply from your care team" shows once, not once per topic (Task 1 test).
3. **A long staff role or plan name on a 375 px phone.** The card wraps without overlapping the action button (Task 4 browser check at 375 px).
4. **A patient reading another patient's visits by guessing a chart id.** Refused (Task 2 rules test).
5. **An appointment deleted, or moved to another day.** Its visit copy is removed or updated, not left stale (Task 2: `visitFromAppointment` returns null for a missing appointment, and the mirror deletes on null).

---

### Task 1: `whatsNext` reminders logic

**Files:**
- Create: `src/portal/lib/whatsNext.js` (pure, no imports except `calendarMath` and `messageMath`)
- Create: `src/portal/lib/whatsNext.check.js`
- Modify: `package.json` `check` script (append `&& node src/portal/lib/whatsNext.check.js`)

**Interfaces:**
- Produces: `whatsNext({ membership, visits, topics, updates, lastSeenUpdateId, progress, now }) → { main: Reminder, more: Reminder[] }` (`more.length ≤ 2`)
  - `Reminder = { kind, title, detail?, action: "billing" | "messages" | "message-us" | "updates" | "log-weight" }`
  - `visits`: `[{ id, start: Date, minutes, discipline, staffRole, status }]`
  - `topics`: the patient's topics (use `unreadFor(topic, "patient")`)
  - `updates`: newest first, `[{ id }]`
  - `progress`: `[{ date: "YYYY-MM-DD", weightLb }]`, weigh-ins and visit weights together
  - `now: Date`
- Kinds, in priority order:

  | Kind | Title |
  |---|---|
  | `pastDue` | "We couldn't take your last payment. Update your card." |
  | `visitToday` | "Your visit is today at {h:mm AM} with your {role}" |
  | `newReply` | "New reply from your care team" |
  | `nextVisit` | "Your next visit: {Thursday, November 12} at {10:30 AM} with your {role}" |
  | `newUpdate` | "Your care team posted an update" |
  | `weighIn` | "Time for a weigh-in. Your last one was {n} days ago." |
  | `ending` | "Your membership ends on {November 27, 2026}" |
  | `firstVisit` | "Our team will contact you to book your first visit." |
  | `nextVisitUnbooked` | "Our team will contact you when it's time for your next visit." |

  `firstVisit` applies when no visit, scheduled or completed, exists. `nextVisitUnbooked` applies otherwise. One of the two is always the fallback when nothing else applies, and the fallback is never in `more`.
- Role words come from `staffRole`: `provider` and `admin` → "provider", `dietitian` → "dietitian", anything else → "care team".

- [ ] **Step 1: Write the self-check** (`node:assert/strict`, print `whatsNext: ok`). Cases:
  - Past due beats everything, and the next two applicable reminders show in `more`.
  - A visit today at 10:30 Tampa time for 30 minutes:
    - at 10:45 it is `visitToday`
    - at 11:01 it is not, and it falls to `nextVisit`/fallback
    - a `cancelled`, `completed` or `noShow` visit is ignored
  - Two topics, one unread, give exactly one `newReply`.
  - `newUpdate` shows when `updates[0].id !== lastSeenUpdateId` and updates exist. It doesn't show when they're equal, or when there are no updates.
  - The weigh-in boundary: the latest entry 7 days ago gives no reminder, and 8 days ago gives `weighIn` with n=8. No progress at all gives no `weighIn`.
  - `ending` shows only for an active membership with `cancelAtPeriodEnd`.
  - With nothing applicable, `main.kind` is `firstVisit` when there are no visits ever, and `nextVisitUnbooked` after a completed visit.
  - `more` never exceeds 2.
- [ ] **Step 2: Run** `node src/portal/lib/whatsNext.check.js`. Expected: it fails (module missing).
- [ ] **Step 3: Implement** `whatsNext` in `src/portal/lib/whatsNext.js`.
- [ ] **Step 4: Run** `npm run check`. Expected: every check passes, including `whatsNext: ok`.
- [ ] **Step 5: Commit** `feat(portal): what's next reminders logic`.

### Task 2: Patient-safe visits (functions, rules, portal reader)

**Files:**
- Create: `functions/visits.js` (pure) and `functions/visits.check.js`, and add it to `npm run check`
- Modify: `functions/index.js` (two triggers), `firestore.rules` (the `visits` match), `tests/firestore.rules.test.js`
- Create: `src/portal/lib/visitStore.js`

**Interfaces:**
- `visitFromAppointment(appointment, staffRole) → { start, minutes, discipline, staffRole, status } | null` (null when `appointment` is missing). It copies nothing else: no note, no names, no `addedBy`.
- `mirrorVisit`: `onDocumentWritten("appointments/{id}")`.
  - If the chart `patients/{intakeId}` doesn't exist, it does nothing.
  - Otherwise it reads `user/{staffUid}.role` and sets `patients/{intakeId}/visits/{id}` to `{ ...visitFromAppointment(...), updatedAt: serverTimestamp() }`.
  - When the appointment is deleted, it deletes the copy.
- `copyVisitsOnChartCreate`: `onDocumentCreated("patients/{chartId}")`. It copies every `appointments` doc where `intakeId == chartId`.
- Rules: `match /patients/{chartId}/visits/{visitId} { allow read: if isLinkedTo(chartId) || isClinical(); allow write: if false; }`
- `listenMyVisits(intakeId, onChange) → unsubscribe`. It gives `[{ id, start: Date, minutes, discipline, staffRole, status }]`, and gives `[]` on any error without logging noise (the spec says fail silently).

- [ ] **Step 1: Write the tests.**
  - `visits.check.js`: the copy has exactly the 5 keys, and an appointment carrying `note`, `patientName` and `staffName` produces a copy without them.
  - Rules tests:
    - the linked patient (`patient1` → `chart1`) reads `patients/chart1/visits/v1`
    - `patient2` reading it is refused
    - a patient's write is refused
    - a provider's write is refused
    - a provider's read is allowed
- [ ] **Step 2: Run** `node functions/visits.check.js` and `npm run test:rules`. Expected: the new tests fail.
- [ ] **Step 3: Implement** `visits.js`, both triggers (same `OPTIONS` region as the other functions, no secrets), the rules block (keep the BOM rule and never edit it via `String.prototype.replace`; see CLAUDE.md), and `visitStore.js`.
- [ ] **Step 4: Run** `npm run check`, `npm run test:rules`, `node --check functions/index.js` and a node import smoke test of `functions/index.js`. Expected: all pass, and the two new exports exist. Do not deploy.
- [ ] **Step 5: Commit** `feat(visits): patient-safe visit copies for the portal`.

### Task 3: Portal shell and routing

**Files:**
- Modify: `src/App.jsx` (branch `/account`, `/portal/setup`, `/portal/reset` out of the website frame, next to the `/admin` branch, with no Header, Footer, CookieBanner or SiteAnalytics)
- Create: `src/portal/PortalShell.jsx`
- Modify: `src/portal/PortalApp.jsx`, `src/portal/PortalLayout.jsx` (replaced by the shell; delete it if nothing else uses it), `src/portal/PortalSetup.jsx`, `src/portal/PortalReset.jsx`
- Create: `src/portal/membership/MembershipPage.jsx` (route `/account/membership`, built from `MembershipCard`'s content) and `src/portal/AccountPage.jsx` (route `/account/account`: name, email, Membership summary link, Privacy policy, Terms, Back to corephia.com, Sign out)

**Interfaces:**
- `PortalShell({ user, link, nav = true, newReplies = 0, children })`
  - **Computer (≥ lg):** a white sidebar 236px wide with the logo ("CorePhia" + "Portal" in `brand`). The nav (Overview `/account`, Progress, Messages with a count, Updates, Membership) uses `NavLink`. At the foot: initials avatar, first name and email, "Back to corephia.com", "Privacy policy" (`/privacy`), "Terms" (`/terms`), "Sign out".
  - **Phone:** a top bar with the logo and the initials. A fixed bottom tab bar (Overview, Progress, Messages with a dot, Updates, Account) with `env(safe-area-inset-bottom)` padding, and page padding so content never hides under it.
  - **`nav=false`:** for before payment, closed and errors. Logo, name, Back to corephia.com and Sign out only, with no section links.
- Signed-out, not-linked, setup and reset screens use `PortalShell` with `nav={false}` and no user block (logo, Back to corephia.com).

- [ ] **Step 1: Load the UI skills.** Open the mockup and match the sidebar, tab bar, spacing, radii (cards 22px, phone cards 20px) and type.
- [ ] **Step 2: Implement the routing branch and `PortalShell`.**
  - Keep `PortalApp`'s whole state machine, the idle sign-out, the `IdleWarningModal` and the portal demo bar (`PortalDemoBar`, `?demoPortal=`).
  - Move `/account/progress`, `/messages`, `/messages/:topicId` and `/updates` under the shell unchanged.
  - Add `/account/membership` and `/account/account`.
  - Unknown `/account/*` paths go to `/account`.
- [ ] **Step 3: Verify in the browser** with the portal demo (own Vite server on a free port with empty `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID`; see CLAUDE.md). Check every `?demoPortal=` scenario and each tab at 375, 768, 1100 and 1440 px:
  - no website header, footer or cookie banner
  - the tab bar never covers content
  - focus is visible
  - Back to corephia.com goes to `/`

  Signed out at `/account` shows the minimal shell. Then run `npm run check`, `npm run lint` and `npm run build`. Stop your server and run `git clean -fdq .playwright-mcp`.
- [ ] **Step 4: Commit** `feat(portal): own shell, sidebar and tab bar`.

### Task 4: Overview with the "What's next" card, plus demo data

**Files:**
- Create: `src/portal/WhatsNextCard.jsx`
- Modify: `src/portal/PortalHome.jsx`, `src/portal/progress/PortalProgress.jsx` (compact mode: the stats plus the soft wave line on the card's bottom edge, like the mockup, never behind text), `src/portal/updates/UpdatesPage.jsx` (store the newest update id in `localStorage` key `corephia-portal-seen-update` on open, wrapped in try/catch)
- Modify: `src/portal/lib/portalDemo.js` and the portal readers (`getMyUpdates`, `getMyProgress`, `listenMyTopics`, `listenMyVisits`) so the demo returns sample data. The sample data: one booked visit 3 days out with a provider, one unread topic, one update, and 3 weights across 6 weeks. Add a demo scenario "Member, nothing booked" with no visits.

**Interfaces:**
- Consumes: `whatsNext` (Task 1), `listenMyVisits` (Task 2), `PortalShell` (Task 3), `isMember` (chartMath), `useMyTopics`, `getMyUpdates`, `getMyProgress`.
- `WhatsNextCard({ reminders, onAction })`.
  - The pill names the kind ("Next: your visit", "Payment", "New message", …).
  - The heading is `main.title` in Fraunces, with the action button on the right on computers and below on phones.
  - `more` shows as up to two small lines with links.
  - Actions route to `/account/membership` (billing), `/account/messages`, `/account/updates` or `/account/progress`. "message-us" opens `/account/messages`.

- [ ] **Step 1: Load the UI skills and `humanizer`.** Build the card and the Overview order:
  1. "Good morning/afternoon/evening, {first name}" (Tampa time), with the subline "Here's where things stand with your program."
  2. The What's next card with the progress stats and wave
  3. Messages and Membership side by side (stacked on phones)
  4. The latest update
- [ ] **Step 2: Browser-verify with the portal demo.**
  - Each main reminder appears for its scenario: past due, a booked visit, a new reply, a new update after opening and closing Updates, nothing booked (first visit vs later), ending.
  - No text overlaps the wave or the buttons at 375, 768, 1100 and 1440 px.
  - Then run `npm run check`, `npm run lint` and `npm run build`, and clean up as in Task 3.
- [ ] **Step 3: Commit** `feat(portal): overview with what's next`.

### Task 5: Docs

**Files:** `CLAUDE.md` (the Client portal section: the shell, routes, the What's next rules, visits mirrored by functions with the note kept private, the portal demo `?demoPortal=` scenarios), `docs/client-portal.md` "Where we left off", and the admin Help topic on calendar booking (patients now see their booked visits, never the note).

- [ ] **Step 1:** Update all three. Keep CLAUDE.md in the file's existing style, and say what is not deployed (the visits functions go out with the Stripe functions).
- [ ] **Step 2:** Run `npm run build`. Expected: it passes.
- [ ] **Step 3: Commit** `docs: portal redesign`.
