# Client portal, patient side — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the public patient login into the CorePhia patient portal: one "Patient portal" entry, sign-in only, and an `/account` page that shows a linked patient their portal and everyone else the right message.

**Architecture:** A patient's account is linked to their intake by a `patientAccounts/{uid}` doc holding `intakeId` and `firstName`. The browser only ever reads its own doc (rules forbid every client write). `Account.jsx` reads it after sign-in and picks one of five states. No admin changes in this plan.

**Tech Stack:** React 19, react-router-dom v7, Tailwind v4, Firebase Auth + Firestore (modular SDK v12), `@firebase/rules-unit-testing` with `node --test`, Playwright (session scratchpad) for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-05-client-portal-login-design.md` (sections "Patient side", the `patientAccounts` part of "Data" and "Rules", and "Testing"). Read it first.

## Global Constraints

- Brand spelling "CorePhia"; no em dashes in visitor-facing text; never name the provider; say "your care team", never "your provider" as one person.
- Nothing may read as pay money, receive medication. The Membership card describes a plan, not orders.
- No new dependencies. Colours only from `@theme` tokens in `src/index.css`. Hover = colour, never movement.
- Dark text never on `from-brand to-brand-dark` gradients (use `paper-50`/`paper-100` there), or avoid those gradients.
- The browser never writes `patientAccounts`. Linking is server or Firebase console only.
- Per CLAUDE.md, before any UI work load `frontend-design`, `ui-ux-pro-max`, `ui-design-system`, `react-best-practices`, `senior-frontend`; `humanizer` for copy; `playwright-cli`/`webapp-testing` for the browser check; `superpowers:verification-before-completion` before calling it done. Report which were loaded.
- Don't start or stop the dev server; Louie runs it (usually :5173, else :5174).
- Don't edit CLAUDE.md unless Louie asks.

## Review Focus

1. **Old self sign-up docs** (`patientAccounts/{uid}` with only `{ email, createdAt }`, no `intakeId`) must show "not set up yet", not a broken welcome. → Task 3 browser case `legacy`.
2. **Link doc read refused or offline** (rules not deployed yet on the live project, so every real read fails today) must show the error state with Retry, not hang on a blank page. → Task 3 browser case `error`.
3. **Linked doc with a blank or missing `firstName`** must still read naturally ("Welcome back"), never "Welcome back, undefined". → Task 3 browser case `noname`.
4. **Signing out from `/account`** must flip the page to the signed-out state and the header label stays "Patient portal" (no stale "My account"). → Task 3 browser case `signout`.
5. **Another patient's link doc** must be unreadable even by a signed-in patient. → Task 1 rules test.

---

### Task 1: Rules — patients read only their own link doc, no client writes

**Files:**
- Modify: `firestore.rules` (the `match /patientAccounts/{uid}` block, ~lines 259–280)
- Test: `tests/firestore.rules.test.js` (new `describe("patient accounts")` at the end; seed in `beforeEach`)

**Interfaces:**
- Produces: `patientAccounts/{uid}` readable by `uid` and by `isClinical()`; create/update/delete false for every client.

- [ ] **Step 1: Write the failing tests.** In `beforeEach`, inside `withSecurityRulesDisabled`, add:

```js
    await setDoc(doc(db, "patientAccounts", "patient1"), { email: "p1@x.co", intakeId: "chart1", firstName: "Pat", linkedAt: new Date() })
    await setDoc(doc(db, "patientAccounts", "patient2"), { email: "p2@x.co", intakeId: "pending1", firstName: "Sam", linkedAt: new Date() })
```

Append at the end of the file:

```js
describe("patient accounts", () => {
  const asPatient = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore()

  test("a patient reads their own link doc", async () => {
    await assertSucceeds(getDoc(doc(asPatient("patient1", "p1@x.co"), "patientAccounts", "patient1")))
  })
  test("a patient can't read another patient's link doc", async () => {
    await assertFails(getDoc(doc(asPatient("patient1", "p1@x.co"), "patientAccounts", "patient2")))
  })
  test("signed-out visitors can't read link docs", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "patientAccounts", "patient1")))
  })
  test("a patient can't create, change or delete a link doc", async () => {
    const db = asPatient("newbie", "n@x.co")
    await assertFails(setDoc(doc(db, "patientAccounts", "newbie"), { email: "n@x.co", createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(db, "patientAccounts", "newbie"), { email: "n@x.co", intakeId: "chart1", firstName: "N", linkedAt: serverTimestamp() }))
    const own = asPatient("patient1", "p1@x.co")
    await assertFails(updateDoc(doc(own, "patientAccounts", "patient1"), { intakeId: "pending1" }))
    await assertFails(deleteDoc(doc(own, "patientAccounts", "patient1")))
  })
  test("clinical staff read link docs; nobody writes them from the client", async () => {
    await assertSucceeds(getDoc(doc(as("provider"), "patientAccounts", "patient1")))
    await assertSucceeds(getDocs(query(collection(as("provider"), "patientAccounts"), where("intakeId", "==", "chart1"))))
    await assertFails(setDoc(doc(as("super"), "patientAccounts", "x"), { email: "x@x.co", intakeId: "chart1", firstName: "X", linkedAt: serverTimestamp() }))
  })
})
```

- [ ] **Step 2: Run, confirm failures.** `npm run test:rules` (Java 21 is installed). Expected: the self-read, provider-read and "can't create" (the old `{ email, createdAt }` shape) cases FAIL; all earlier tests still pass.

- [ ] **Step 3: Replace the rule block** (keep a comment in the file's voice):

```
    // One doc per patient login, linking it to their intake record:
    // { email, intakeId, firstName, linkedAt }. Written only by the server
    // (the invite function, later) or by hand in the Firebase console — never
    // by a browser, so nobody can link themselves to someone else's intake.
    // Self sign-up is gone (invite-only, Louie 2026-10-02); old sign-up docs
    // without an intakeId read as "portal not set up yet" in Account.jsx.
    // A patient reads only their own; clinical staff read them for the
    // chart's portal-access status.
    match /patientAccounts/{uid} {
      allow read: if (request.auth != null && request.auth.uid == uid) || isClinical();
      allow create, update, delete: if false;
    }
```

- [ ] **Step 4: Run, confirm pass.** `npm run test:rules` → all pass. Update the count line in the test file's header comment ("All N passed on 2026-10-05").

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.js
git commit -m "Rules: patients read only their own portal link, no client writes"
```

---

### Task 2: One "Patient portal" entry; sign-in only

**Files:**
- Modify: `src/components/Header.jsx:115-137` (both labels)
- Modify: `src/components/MobileMenu.jsx:134` (`aria-label="Account"`)
- Modify: `src/components/LoginPanel.jsx` (heading row, tel link bug)
- Modify: `src/lib/patientSessionHint.js:5` (comment mentions "My account")
- Modify: `src/lib/patientAuth.js` (remove dead sign-up code)

**Interfaces:**
- Produces: `patientAuth.js` exports `isConfigured`, `watchPatientUser`, `signInPatient`, `resetPatientPassword`, `signOutPatient` (unchanged signatures). `signUpPatient`, `signInPatientWithGoogle`, `recordNewPatient` are deleted. Nothing else imports them (checked: only `patientAuth.js` itself).

- [ ] **Step 1: Header.** Change the visible text "My account" → `Patient portal` and "Log in" → `Patient portal`. Keep the two elements (Link when signed in, button with `aria-haspopup="dialog"` when not); only the text changes.

- [ ] **Step 2: Mobile menu.** `aria-label="Account"` → `aria-label="Patient portal"`.

- [ ] **Step 3: Login panel.**
  - Top-bar title `Patient log in` → `Sign in`; dialog `aria-label="Patient log in"` → `aria-label="Patient portal sign in"`. Submit button text `Log in` → `Sign in`.
  - Fix the broken phone link: `SUPPORT_PHONE.replace(/D/g, "")` strips the letter D, not non-digits. Change to `SUPPORT_PHONE.replace(/\D/g, "")`.
  - Replace the comment above `LoginPanel` with: `// Patient accounts are invite-only (Louie, 2026-10-02): sign-in only, no sign-up or Google. Staff invite admitted patients from the admin.`

- [ ] **Step 4: patientAuth.js.** Delete `recordNewPatient`, `signUpPatient`, `signInPatientWithGoogle` and their comments; drop `createUserWithEmailAndPassword`, `GoogleAuthProvider`, `signInWithPopup`, `serverTimestamp`, `setDoc` from the imports (keep `doc`, `getFirestore` for Task 3).

- [ ] **Step 5: patientSessionHint.js comment.** `("Log in" vs "My account")` → `(sign-in panel vs. straight to the portal)`.

- [ ] **Step 6: Verify.** `npm run lint` and `npm run build` both clean. `grep -rn "signUpPatient\|signInPatientWithGoogle\|My account\|Log in" src --include=*.jsx --include=*.js | grep -v "^src/admin"` → no hits.

- [ ] **Step 7: Commit**

```bash
git add src/components/Header.jsx src/components/MobileMenu.jsx src/components/LoginPanel.jsx src/lib/patientAuth.js src/lib/patientSessionHint.js
git commit -m "Patient portal: one entry label, sign-in only, fix support phone link"
```

---

### Task 3: The portal page (`/account`)

**Files:**
- Modify: `src/lib/patientAuth.js` (add `getMyPortalLink`)
- Modify: `src/pages/Account.jsx` (rewrite)
- Test: `<scratchpad>/portal-check.mjs` (Playwright, not committed)

**Interfaces:**
- Consumes: from Task 2, `watchPatientUser(onChange) → unsubscribe`, `signOutPatient() → Promise`.
- Produces: `getMyPortalLink(uid: string) → Promise<{ intakeId: string, firstName: string } | null>` — `null` when the doc is missing or has no non-empty `intakeId`; throws on a read error.

- [ ] **Step 1: Add the reader to `patientAuth.js`** (import `getDoc` alongside `doc`):

```js
// The patientAccounts/{uid} doc that links this login to an intake record.
// Written only by the server or the console (see firestore.rules). null =
// not linked yet, which includes old self sign-up docs with no intakeId.
export async function getMyPortalLink(uid) {
  if (!db) return null
  const snap = await getDoc(doc(db, "patientAccounts", uid))
  const data = snap.data()
  if (!data?.intakeId) return null
  return { intakeId: data.intakeId, firstName: (data.firstName ?? "").trim() }
}
```

- [ ] **Step 2: Load the UI skills** (`frontend-design`, `ui-ux-pro-max`, `ui-design-system`, `react-best-practices`, `senior-frontend`, `humanizer`) and follow their checklists for Step 3.

- [ ] **Step 3: Rewrite `Account.jsx`.** States, in order of the render switch:

| state | when | shows |
|---|---|---|
| `checking` | before the first auth callback, or while the link is loading | nothing (as today) |
| `signedOut` | `user == null` | "Sign in to your patient portal" · "Your portal opens once you're a CorePhia patient. We'll email you an invite." · **Sign in** button (opens `LoginPanel`) · "Not a patient yet?" + **Get started** link to `/intake` |
| `error` | `getMyPortalLink` threw | "We couldn't load your portal." · "Please try again." · **Try again** (re-runs the read) · Sign out |
| `notLinked` | link is `null` | "Your portal isn't set up yet" · "If you're a CorePhia patient, contact us and we'll send you an invite." · phone (`SUPPORT_PHONE`, `tel:` with `/\D/g`) and `info@corephia.com` · signed-in email in small text · Sign out |
| `linked` | link present | eyebrow "Patient portal" · `Welcome back, {firstName}` (or `Welcome back` when blank) · four cards · Sign out |

The four cards, each icon + title + one line + a "Coming soon" tag (icons from `src/components/icons.jsx`):

| icon | title | line |
|---|---|---|
| `ClipboardCheckIcon` | Updates | Notes from your care team after each visit. |
| `TrendingUpIcon` | Track progress | Your weight and the measures your care team follows. |
| `MailIcon` | Messages | Write to your care team and read their replies. |
| `BadgeCheckIcon` | Membership | Your plan and what it includes. |

Structure (keep `Helmet`, change title to `Patient portal | CorePhia`, keep `noindex, nofollow`):

```jsx
import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import LoginPanel from "../components/LoginPanel"
import { getMyPortalLink, signOutPatient, watchPatientUser } from "../lib/patientAuth"

export default function Account() {
  const [user, setUser] = useState(undefined) // undefined = auth not known yet
  const [link, setLink] = useState(undefined) // undefined = loading, null = not linked
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => watchPatientUser(setUser), [])

  useEffect(() => {
    if (!user) return
    let live = true
    setLink(undefined)
    setFailed(false)
    getMyPortalLink(user.uid).then(
      (next) => live && setLink(next),
      (cause) => {
        console.error("Could not load portal link:", cause.code ?? cause.message)
        if (live) setFailed(true)
      },
    )
    return () => { live = false }
  }, [user, attempt])

  const state =
    user === undefined ? "checking"
    : user === null ? "signedOut"
    : failed ? "error"
    : link === undefined ? "checking"
    : link === null ? "notLinked"
    : "linked"
  // …render per state; LoginPanel rendered once at the end with open={loginOpen}
}
```

`LoginPanel` already navigates to `/account` on success; on `/account` that's a no-op route change and `watchPatientUser` fires with the new user, so the page updates by itself. Importing it directly here is fine: `Account` is already lazy and already pulls in Firebase.

Styling: same card language as today (`rounded-3xl border border-ink-950/10 bg-white`, `font-serif` headings, `bg-paper-100` inner panels). Cards in a `grid gap-4 sm:grid-cols-2`. "Coming soon" tag: `rounded-full bg-paper-100 px-2.5 py-0.5 text-xs font-medium text-ink-950/70`. Card hover: none (they are not links). Buttons reuse the existing classes in this file and `LoginPanel.jsx`. Page container widens to `max-w-3xl` for the grid.

- [ ] **Step 4: Browser check (failing first).** Write `<scratchpad>/portal-check.mjs` before Step 3 is finished and run it to see it fail, then pass. It stubs the auth module so every state renders without a live Firebase: intercept the dev server's `/src/lib/patientAuth.js` request with `page.route("**/src/lib/patientAuth.js*", …)` (Vite may append `?t=`/`?v=`) and fulfil it with `contentType: "application/javascript"` and:

```js
const stub = (mode) => `
export const isConfigured = true
const users = { out: null, legacy: { uid: "u", email: "old@x.co" }, linked: { uid: "u", email: "p@x.co" },
  noname: { uid: "u", email: "p@x.co" }, error: { uid: "u", email: "p@x.co" }, signout: { uid: "u", email: "p@x.co" } }
let current = users["${mode}"]; const subs = new Set()
export function watchPatientUser(cb) { subs.add(cb); queueMicrotask(() => cb(current)); return () => subs.delete(cb) }
export async function getMyPortalLink() {
  if ("${mode}" === "error") throw Object.assign(new Error("denied"), { code: "permission-denied" })
  if ("${mode}" === "legacy") return null
  return { intakeId: "i1", firstName: "${mode}" === "noname" ? "" : "Maria" }
}
export async function signInPatient() { return current }
export async function resetPatientPassword() {}
export async function signOutPatient() { current = null; localStorage.removeItem("corephia-patient-session"); window.dispatchEvent(new Event("corephia-patient-session-change")); subs.forEach((cb) => cb(null)) }
`
```

One fresh browser context per mode (CLAUDE.md: isolate tests). Assertions:
- `out`: heading "Sign in to your patient portal"; clicking **Sign in** shows the dialog "Patient portal sign in"; **Get started** href `/intake`; header shows "Patient portal".
- `legacy`: "Your portal isn't set up yet"; `tel:0001234567` link present; no "Welcome".
- `linked`: "Welcome back, Maria"; four card titles; four "Coming soon".
- `noname`: heading text exactly "Welcome back"; page text has no "undefined".
- `error`: "We couldn't load your portal."; **Try again** button present.
- `signout`: click Sign out → "Sign in to your patient portal"; header still "Patient portal".
- Screenshots at 1280 and 390 wide for `linked`, `legacy`, `out` (scroll first; `useReveal` elements start at opacity 0). No horizontal scroll at 390 (`document.documentElement.scrollWidth <= 390`). Read the screenshots and look at them.

Run: `node <scratchpad>/portal-check.mjs` against the dev server Louie is running. Expected after Step 3: all assertions pass.

- [ ] **Step 5: Lint and build.** `npm run lint`, `npm run build` clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/patientAuth.js src/pages/Account.jsx
git commit -m "Patient portal page: linked welcome, not-set-up, signed-out and error states"
```

---

### Task 4: Wrap up

**Files:**
- Modify: `docs/client-portal.md` ("What exists today": the login is now sign-in only and the portal page exists; note rules must be deployed before the live portal reads work)

- [ ] **Step 1:** Update `docs/client-portal.md` "What exists today" to match: Patient portal entry, sign-in only, `/account` states, `patientAccounts` link shape, linking by hand in the console for testing (fields `email`, `intakeId`, `firstName`, `linkedAt`).
- [ ] **Step 2:** Run `superpowers:verification-before-completion`: `npm run test:rules`, `npm run lint`, `npm run build`, the Playwright script; report actual output.
- [ ] **Step 3: Commit**

```bash
git add docs/client-portal.md
git commit -m "Docs: client portal patient side built"
```

Out of this plan (admin side, next plan): Portal access box, compose dialog, invite queue and template rules.
