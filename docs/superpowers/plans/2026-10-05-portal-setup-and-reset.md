# Portal setup and forgot password — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The invite link works: a patient opens `/portal/setup`, chooses a password, and lands in their portal; a patient who forgets their password resets it from the login panel through a CorePhia `/portal/reset` page.

**Architecture:** No server. `/portal/setup` reads the sent invite by id, creates the Firebase Auth login (or signs in to an existing one) and writes the patient's own `patientAccounts/{uid}` link; the rules accept that write only against a sent, unexpired invite to the same email. Forgot password uses Firebase's own reset email (only Firebase can make the reset code) with a continue URL; `/portal/reset` verifies and applies the code.

**Tech Stack:** React 19, react-router-dom v7, Tailwind v4 site tokens, Firebase Auth + Firestore v12, `@firebase/rules-unit-testing`, Playwright (scratchpad) with the auth module stubbed.

**Spec:** `docs/superpowers/specs/2026-10-05-portal-invites-emailjs-design.md`, sections "Patient: /portal/setup", "Forgot password (option A)", and the `patientAccounts` part of "Rules". Builds on the admin plan `2026-10-05-portal-invites-admin.md` (invites exist and are sent).

## Global Constraints

- No new dependencies. Site tokens only; hover = colour; copy: "CorePhia", no em dashes, no provider name, "Log in" wording in the panel (Louie 2026-10-05).
- Passwords: minimum 8 characters, Confirm must match, show/hide toggle.
- Never reveal whether an email has an account: the reset request always answers "If that email has a portal login, we've sent a link to reset your password."
- `INVITE_DAYS` (7) and `isInviteUsable` come from `src/lib/inviteMath.js`; don't redefine them.
- The reset continue URL must not break sending if the domain isn't authorised: on `auth/unauthorized-continue-uri` retry without it.
- New pages are lazy routes (they pull in Firebase) and `noindex, nofollow`.
- Load UI skills before UI tasks; don't start or stop the dev server.

## Review Focus

1. **Invite link opened after 7 days, or a made-up id** → "This invite link has expired or isn't valid" with contact details, never a form. → Task 3 browser cases `expired`, `missing`.
2. **Patient already has a login with that email** → "You already have a login…" then Log in and connect; wrong password shows an error and keeps the form. → Task 3 cases `exists`, `existsWrong`.
3. **Signed in as someone else when opening the link** → "You're signed in as {other}. Log out to set up this invite." → Task 3 case `other`.
4. **Passwords too short or not matching** → inline message, nothing created. → Task 3 case `mismatch`.
5. **Reset link already used or expired** → "This reset link has expired or was already used." + Send a new link. → Task 4 case `badCode`.

---

### Task 1: Rules — a patient links their own login to a sent invite

**Files:** `firestore.rules` (`patientAccounts` create; signed-out invite `get` gets the 7-day limit), `tests/firestore.rules.test.js`.

- [ ] Tests first (`describe("portal setup links")`), with `sent1` (sent now, to `pat@x.co`, firstName `Pat`) from the existing seed, plus `old1` (sent 8 days ago) and `ready1`:
  - patient `p1` with token email `pat@x.co` creates `patientAccounts/p1` `{ email: "pat@x.co", intakeId: "chart1", firstName: "Pat", inviteId: "sent1", linkedAt: serverTimestamp() }` → succeeds.
  - refused: token email `other@x.co`; `inviteId: "old1"`; `inviteId: "ready1"`; `firstName: "Sam"`; writing `patientAccounts/someoneElse`; missing `inviteId`; a second create on an existing link (seed `patientAccounts/p2` first).
  - signed-out `get` of `old1` refused (expired); of `sent1` still allowed.
  - Update the "a patient can't create, change or delete a link doc" test: its second write (no `inviteId`) stays refused; nothing else changes.
- [ ] Run `npm run test:rules` → new allow case fails, expired-read case fails.
- [ ] Rules:

```
    match /patientAccounts/{uid} {
      // A patient links their own login from /portal/setup: only against a
      // sent, unexpired invite to the same email, copying its name. Knowing
      // the invite's id (from the emailed link) is the proof.
      function isOwnInviteLink() {
        let data = request.resource.data;
        let invite = get(/databases/$(database)/documents/patients/$(data.intakeId)/invites/$(data.inviteId)).data;
        return request.auth != null
          && request.auth.uid == uid
          && data.keys().hasAll(['email', 'intakeId', 'firstName', 'inviteId', 'linkedAt'])
          && data.keys().hasOnly(['email', 'intakeId', 'firstName', 'inviteId', 'linkedAt'])
          && data.intakeId is string && data.inviteId is string
          && data.email == request.auth.token.email
          && data.linkedAt == request.time
          && invite.status == 'sent'
          && invite.to == request.auth.token.email
          && request.time < invite.sentAt + duration.value(7, 'd')
          && data.firstName == invite.firstName;
      }
      allow read: if (request.auth != null && request.auth.uid == uid) || isClinical();
      allow create: if isOwnInviteLink();
      allow update, delete: if false;
    }
```
  and the invite read becomes `allow get: if isClinical() || (resource.data.status == 'sent' && request.time < resource.data.sentAt + duration.value(7, 'd'));`. Update both comments.
- [ ] Green; update the count line; commit "Rules: patients link their login to a sent invite".

---

### Task 2: Patient auth functions

**Files:** `src/lib/patientAuth.js`; `src/admin/lib/firebase.js` (`resetAdminPassword`), `src/admin/patients/chartStore.js` (`addStaff`).

**Produces** (all async; throw Firebase errors unless noted):
- `getInvite(chartId, inviteId) → { to, firstName, sentAt, status } | null` — null when missing, refused (permission-denied: not sent or expired) or not usable per `isInviteUsable`.
- `createPortalLogin(ref, password) → user` where `ref = { chartId, inviteId, invite }`: `createUserWithEmailAndPassword(invite.to, password)` then `linkInvite`.
- `connectExistingLogin(ref, password) → user`: `signInWithEmailAndPassword(invite.to, password)` then `linkInvite` unless `getMyPortalLink(uid)` already returns a link.
- `linkCurrentLogin(ref) → user`: for a signed-in user whose email equals `invite.to`; same skip rule.
- (internal) `linkInvite(user, ref)`: `setDoc(patientAccounts/{uid}, { email: invite.to, intakeId: chartId, firstName: invite.firstName, inviteId, linkedAt: serverTimestamp() })`.
- `resetPatientPassword(email)` now passes `{ url: origin + "/account" }`, retrying without it on `auth/unauthorized-continue-uri`; swallows `auth/user-not-found` (no account probing) and rethrows the rest.
- `checkResetCode(code) → email` (`verifyPasswordResetCode`), `saveNewPassword(code, password)` (`confirmPasswordReset`).
- Staff: `resetAdminPassword` and `addStaff` pass `{ url: origin + "/admin" }` with the same unauthorized-continue-uri fallback. Shared helper `sendResetEmail(auth, email, path)` lives in each bundle's own file (public and admin bundles stay separate, see the comment in `patientAuth.js`); it's three lines, duplication accepted.
- [ ] No unit test (Firebase calls); covered by Task 1 rules and the Task 3/4 browser stubs mirroring these signatures. `npm run lint`, `npm run build`. Commit "Patient auth: invite setup, existing-login connect, reset code helpers".

---

### Task 3: `/portal/setup`

**Files:** Create `src/pages/PortalSetup.jsx`, `src/components/PasswordField.jsx`; Modify `src/App.jsx` (lazy route).

`PasswordField({ id?, label, value, onChange, autoComplete })` — the LoginPanel input style with the eye toggle, `useId` for the id.

States, in render order (`c`, `i` from `useSearchParams`):
| state | when | shows |
|---|---|---|
| loading | invite or auth not known | nothing |
| invalid | `getInvite` null or `c`/`i` missing | h1 "This invite link has expired or isn't valid" · "Contact us and we'll send you a new one." · phone + email links |
| other | signed in, email ≠ invite.to | h1 "Set up your portal" · "You're signed in as {email}. Log out to set up this invite." · **Log out** |
| linked | signed in as invite.to and `getMyPortalLink` non-null | h1 "You're already set up" · **Open your portal** (→ /account) |
| connectSignedIn | signed in as invite.to, no link | h1 "Set up your portal" · "Hi {firstName}. Connect this invite to your login." · **Connect** |
| create (default) | signed out | h1 "Set up your portal" · "Hi {firstName}. Choose a password for {to}." · Password · Confirm password · **Create my login** |
| exists | create failed `auth/email-already-in-use` | h1 same · "You already have a login with this email. Enter your password to connect it." · Password · **Log in and connect** · "Forgot password?" (sends reset to invite.to, shows the neutral sent line) |

Errors (inline `role=alert`): short password "Use at least 8 characters."; mismatch "The passwords don't match."; wrong password "That password wasn't accepted."; link refused (`permission-denied`) → switch to `invalid`; anything else "Something went wrong. Please try again." Success → `navigate("/account")`.

- [ ] Browser check first (`<scratchpad>/setup-check.mjs`), stubbing `**/src/lib/patientAuth.js*` with modes: `create` (signed out, valid invite; `createPortalLogin` resolves), `mismatch`, `expired` (`getInvite` → null), `missing` (no query), `exists` (`createPortalLogin` rejects `auth/email-already-in-use`, `connectExistingLogin` resolves), `existsWrong` (connect rejects `auth/invalid-credential`), `other` (signed in as `x@x.co`), `linked`. Assert each state's h1/text, that `create` navigates to `/account`, that `mismatch` doesn't call create (stub counts calls on `window.__calls`), and 390 px without horizontal scroll. Run → fails (route missing).
- [ ] Implement; check passes; lint, build. Commit "Portal setup page".

---

### Task 4: Forgot password: panel view and `/portal/reset`

**Files:** Modify `src/components/LoginPanel.jsx` (views `login` | `reset` | `resetSent`; prop `startView`); Create `src/pages/PortalReset.jsx`; Modify `src/App.jsx`.

Panel: "Forgot password?" link-button under the password field → `reset` view: h2 "Reset your password" · Email · **Send reset link** · "Back to log in". After sending (or `user-not-found`) → `resetSent`: "If that email has a portal login, we've sent a link to reset your password." · "Back to log in". Other errors: "Couldn't send the link. Please try again."

`/portal/reset` (reads `oobCode`, `mode`, `continueUrl`):
| state | shows |
|---|---|
| checking | nothing |
| bad (no code, `mode` ≠ `resetPassword`, or `checkResetCode` throws) | h1 "This reset link has expired or was already used." · **Send a new link** (opens `LoginPanel startView="reset"`) |
| form | h1 "Choose a new password" · "For {email}." · New password · Confirm · **Save password** |
| done | h1 "Password changed" · **Continue** → `continueUrl` when same origin, else `/account` |

- [ ] Browser check first (`<scratchpad>/reset-check.mjs`), same stub technique: panel → Forgot password? → email → Send reset link → neutral message; `/portal/reset?mode=resetPassword&oobCode=good&continueUrl=<origin>/admin` → form → save → "Password changed" with Continue href `/admin`; `oobCode=bad` → expired message and Send a new link opens the reset view; `continueUrl=https://evil.example/` → Continue href `/account`. Run → fails.
- [ ] Implement; check passes; lint, build; rerun `portal-check.mjs` (panel still logs in). Commit "Forgot password: panel view and reset page".

---

### Task 5: Docs and wrap-up

- [ ] `docs/client-portal.md`: setup and reset built; Firebase console steps (Templates → Password reset: sender name, subject, message, reply-to, action URL `https://corephia.com/portal/reset` once deployed; Authorized domains include `corephia.com`); note the reset action URL applies to staff too.
- [ ] Final: `npm run test:rules`, `npm run check`, lint, build, all three browser checks. Commit "Docs: portal setup and reset".
