# CorePhia Health — project context

Marketing site + patient intake for **CorePhia**, a physician-built weight loss program based in
**Tampa, Florida**, founded by **Dr. Daniel Antonious, MD** (double board certified in Internal
Medicine and Nephrology; currently *pursuing* a critical care fellowship — he has not completed it,
do not describe him as a fellow).

The program has three pillars, in his own words: **dietitian services, exercise prescriptions, and
weight loss medication when clinically appropriate.**

---

## Non-negotiable: how medication may be described

Per Dr. Antonious (Feb 2026): *"I'm not selling medication. This idea of you give me 50 bucks and I
give you this medication is now considered illegal. What we're selling is a program, and that
program includes a medication."*

This is a compliance boundary, not a style preference. Nothing on the site may read as
**pay money → receive medication**. Medication is always framed as one part of a program,
prescribed by a licensed provider only when clinically appropriate.

Already removed for this reason — do not reintroduce:
- A "Medication Included / All FDA-approved medications included" pricing badge (now
  "Medication When Appropriate", with a clinical-appropriateness qualifier).
- A shopping cart icon and a "Track orders" account perk (e-commerce framing).
- A large GLP-1 injector pen illustration as the main image for medical support (now `CareShieldArt`).
- Hero copy "The weight loss breakthrough is here" — miracle-product language he explicitly built against.

The site is a **program**, never a storefront.

## Client decisions (2026-09-29)

From the client meeting (`docs/meeting-analysis.md`, which also holds the full list):

- **Cash only.** No insurance questions anywhere in the intake. The FAQ answers "Do you accept
  insurance?" with a plain no (2026-10-08). HSA/FSA cards are unconfirmed, so no copy mentions them.
- **No emergency contact** in the intake or the admin (Dr. Antonious, via Louie, 2026-10-08).
  The record has no `emergencyContact` key and `firestore.rules` refuses one.
- **The site does not name him.** Use "our provider" (About, homepage provider section, FAQ). Done 2026-09-30; his name only appears in code comments.
- Services: "physical therapy" in the meeting means the **exercise plan**. There is no physical
  therapy service. **Nutrition coaching and dietitian services are one service, one page.**
- Intake reference is **hims.com** (one question per screen, can't navigate out).
- **The four programs** (per Dr. Antonious, 2026-09-30): **Medical care · Dietitian services ·
  Comprehensive Exercise Plan · Follow-ups.** Use these names. "Ongoing health checks" on the
  site today is the Follow-ups program; "Nutrition coaching" is Dietitian services.
  Spelled **dietitian** (the credential's spelling, "Registered Dietitian"), not "dietician";
  Louie's call, 2026-09-30. The page lives at `/programs/dietitian-services`.
- **Brand spelling is "CorePhia"** (capital P) in all visitor-facing text, per Louie 2026-09-30.
- **One provider today, more later.** Copy may say "your provider" follows your care, but must not
  promise "the same provider at every visit" or "one provider": that stops being true when the
  practice adds providers. The intake taking "about ten minutes" is confirmed by Louie.

---

## Commands

```bash
npm run dev      # vite dev server (usually :5173, falls back to :5174 if occupied)
npm run build    # vite production build -> dist/
npm run lint     # oxlint
npm run preview  # serve the built dist/
```

Deployed via Firebase Hosting (`firebase.json` → `public: "dist"`, SPA rewrite to `/index.html`).
Firebase project is `corephia-health`. Hosting was last deployed around 2026-10-01 (the
`.firebase/` hosting cache changed in the 2026-09-30 and 2026-10-01 commits). Whether the
Firestore rules were deployed with it is not recorded; ask Louie.

## Stack

React 19 · Vite 8 · Tailwind CSS v4 · react-router-dom v7 · react-helmet-async · oxlint.
Firebase (Auth + Firestore). No TypeScript. Tests: `npm run check` (the self-checks: chartMath,
roles, calendarMath, todoMath, staffMath, inviteMath, progressMath, messageMath, and
`auditActions.check.js`, which fails if `AUDIT_ACTIONS` in `admin/lib/firebase.js` and the action
list in `firestore.rules` drift apart) and `npm run test:rules` (Firestore rules against the
emulator; see the blockers).

## Architecture

Client-rendered SPA, no SSR or prerendering.

```
src/main.jsx          ErrorBoundary > HelmetProvider > BrowserRouter > App
src/App.jsx           ScrollManager + Header + <Routes> + Footer
src/pages/            Home, About, Contact, Faq, Membership, ProgramPage, SuccessStories, NotFound
src/components/       PatientIntakeForm + intakeScreens (the /intake route) + all homepage sections,
                      ErrorBoundary (a plain "Something went wrong" screen instead of a blank page)
src/portal/           the patient portal (/account/*, /portal/setup, /portal/reset)
src/admin/            the staff admin (/admin/*)
src/lib/              Firebase submission, patient auth, analytics consent/tracking, siteContact
src/data/             programs.js, pricingTiers.js
src/hooks/            useIntro (timed reveal), useReveal (IntersectionObserver reveal)
```

Routes: `/` · `/about` · `/contact` · `/faq` · `/membership` (`/pricing` redirects) ·
`/programs/:slug` (medical-care, dietitian-services, exercise-plan, follow-ups; an unknown slug
shows NotFound) · `/success-stories` · `/intake` · `/account/*` · `/portal/setup` ·
`/portal/reset` · `/admin/*` · anything else shows `NotFound` (marked `noindex`, because hosting
serves the app with a 200 for every path).

`ScrollManager` in `App.jsx` handles scroll on navigation: scrolls to top on a new route, honours a
`#hash` target (the browser can't — React hasn't rendered the section when the hash resolves), and
leaves back/forward alone so the browser restores position. The hash is looked up with
`getElementById`, never `querySelector`: a hash like `#1` or Facebook's `#_=_` isn't a valid
selector and used to throw and blank the whole site.

### Design system

All colour lives in `@theme` in `src/index.css`. Changing those tokens re-themes the whole site.

| token | value | use |
|---|---|---|
| `ink-950/900/800/700` | `#0d1a3d` … | navy text and dark sections |
| `paper-50/100/200` | `#f5f7fb` … | light backgrounds |
| `accent` / `accent-dark` | `#60a5fa` / `#2563eb` | highlights, CTAs |
| `brand` / `brand-dark` | `#3b5bdb` / `#1e3a8a` | card gradients |

Fonts: Fraunces (serif, headings) + Inter (sans, body), via Google Fonts.

**Inline SVGs in `Artwork.jsx` use hardcoded hex and do NOT inherit these tokens.** Any palette
change must update them by hand — this has been missed twice already.

**Watch contrast on `brand` gradients.** Dark text on `from-brand to-brand-dark` fails WCAG AA
(measured as low as 1.44:1). Card text on those gradients must be `paper-50` / `paper-100`, which
measures 4.78–8.74:1.

---

## Current state

Checked against the code 2026-10-08 (a whole-system audit: admin, public site, intake, portal).

Done: pivot from a multi-vertical Rx marketplace to a weight-loss-program site · blue/navy re-theme ·
all routes above · per-route SEO metadata, JSON-LD, sitemap, OG image · Hims-style one-question
intake (`docs/superpowers/specs/2026-09-30-intake-flow-design.md`) · program pages · Membership ·
FAQ · success stories page · cookie banner + analytics · admin (dashboard, applicants, charts, staff,
to-do, calendar, messages, activity, help) · patient portal (invite-only login, Overview, Progress,
Messages, Updates) · compliance copy fixes · accessibility and visual pass.

- **Intake and Contact submit to Firestore.** `submitIntakeRecord()` → `lib/intakeSubmission.js`
  writes `intakeRecords`; Contact → `lib/contactSubmission.js` writes `contactMessages`. No sign-in;
  `firestore.rules` is the only gatekeeper (exact shape + consents on create, no client reads).
  The confirmation screen only shows after the write succeeds.
- **Domain is settled on `corephia.com`**: canonicals, OG tags, sitemap, footer and email
  (`info@corephia.com`) all agree. The Firebase project name `corephia-health` is just the project.

### Blockers before going live with real patients

1. **Firestore needs a BAA before it holds PHI.** The intake collects DOB, address, medications,
   conditions, cancer and family history, and a typed signature under a HIPAA acknowledgement.
   A plain Firestore project is not covered; a Google Cloud BAA (or another destination) is needed.
   **Elation** is still the possible EMR (pricing being negotiated, set aside for now per Louie);
   Hyacinth would load intake data into it. Submission emails must be notifications only, never PHI.
   See `docs/meeting-analysis.md`. `buildIntakeRecord()` deliberately groups fields to mirror
   standard EMR intake sections (demographics / vitals / medicalHistory /
   familyHistory / socialHistory / nutrition / visit / consent) so a vendor mapping is direct.
2. **Firestore rules: test and deploy.** `npm run test:rules` has never been run: it needs Java 21+
   for the emulator, and Java is not installed on this machine (checked 2026-10-02). The rules
   must then be deployed (`firebase deploy --only firestore:rules`) for submissions,
   charts and analytics to work against the live project. **Rules changed on 2026-10-08 and are
   not deployed or emulator-tested yet:** audit entries (own email, server time, known actions
   only), intake and contact shape checks (time format, date of birth `YYYY-MM-DD`, sections are
   maps, no `emergencyContact`), only the admin tiers set a staff name, dietitian notes by
   super admin, and the new `staffPhotos` collection. The tests for all of these are written
   (`tests/firestore.rules.test.js`) but unrun. Deploy the rules together with the site.
   Keep `firestore.rules` free of a byte-order mark: PowerShell's `Set-Content -Encoding utf8`
   adds one.
3. **Placeholder phone number** `(000) 123-4567`, set once in `lib/siteContact.js` (Contact,
   footer, intake help line). Footer social links are still `#`. Tampa is real.

### Waiting on assets from the client

- A real headshot of Dr. Antonious. Deliberately left as an illustrated `PersonAvatar` placeholder
  until then — do not fabricate a photo. Photography is still thin: the only photos are Unsplash
  placeholder cutouts (`public/start-here.webp`, `public/programs/{slug}.webp` on the program
  page heroes), all to be replaced with the client's own.
- A logo without orange in it. `cp-health.webp` (the logo, ~98 KB) still has the two orange arcs
  around the infinity mark (looked at 2026-10-02).
- Real social profile URLs, success stories with signed patient consent, the how-it-works video.

### Known remaining gaps

- No Privacy Policy or Terms pages exist (needed for a health site). The footer lists both as
  plain text; footer entries without a `to`/`href` render muted by design, not broken links.
- One FAQ answer is still a TODO in `Faq.jsx`: the list of licensed states. (Insurance is
  answered: cash pay.)
- **Medication wording, saved for later (2026-10-08, Louie):** the home page Medical care card
  (`ProgramGrid.jsx`) shows "Prescription medication, guided by a licensed provider" under a
  visible "FDA approved" seal, with the "when prescribed" qualifier only in a hidden `aria-label`;
  and the About page (`About.jsx`) lists "weight loss medication" with "when clinically
  appropriate" removed, plus a pillar that implies everyone gets medication. Both come close to the
  compliance boundary above. Fix both together, matching the Hero's wording.
- **Open portal issues (audit 2026-10-08):** the portal and the admin share one Firebase login,
  so signing out of one signs out of the other (give the portal a named app); an old
  `patientAccounts` doc with no `intakeId` can never link an invite (delete them before go-live);
  a returning patient admitted a second time keeps their old chart; "Forgot password" from the
  invite page loses the invite; a discharged patient can still log weights.
- Two-step sign-in is optional for staff and not enforced by the rules. Enforcing it needs
  Identity Platform in the Firebase console, then a rules check on the second factor.
- No under-18 check on the intake (the age rule isn't decided): the date of birth only refuses
  future dates.
- Focus is not trapped in the mobile menu and login panel (Tab can leave them).
- Unsourced claims: "Members lose up to 20% body weight*" (`ScienceSection.jsx`) has a footnote
  with no study, N, or date; the "Proven Results" badge (`PricingSection.jsx`) has nothing behind
  it. YMYL/E-E-A-T liability.
- No "medically reviewed by" attribution or last-updated dates.
- A "Certified" badge in the footer that does not say certified by whom.
- Open client questions are tracked in `docs/meeting-analysis.md` §7.

---

## Membership (2026-09-30)

`/membership` shows the three plans (Core, Core+, Core Complete) with their prices ($199 / $249 /
$349 a month; `PRICES_ANNOUNCED` back on per Louie, 2026-09-30), no per-card buttons and no "Most
popular" highlight; `/pricing` redirects there. Nav, footer and the Hero quick link say "Membership". Two
switches in `data/pricingTiers.js`: `PLANS_SHOWN` (plans on the page, the intake plan question,
`?plan=` preselect) and `PRICES_ANNOUNCED` (false = "Coming soon" on cards and in the FAQ). The
program pages carry no pricing block. Plans and features are still placeholders awaiting the
client; flagged: the Core tier lists "Prescription medication" as a feature, and the badges under the
cards include "Medication Available" and "Proven Results".

## Admin: applicants, patient charts, staff (2026-10-01)

Spec: `docs/superpowers/specs/2026-10-01-patient-charts-notes-staff-design.md`.

- **Applicants** (`/admin/applicants`, was "Patients"): intake submissions; admit or decline.
  Admitting creates a chart (`chartStore.setApplicantStatus`, one batch with the status).
- **Patients** (`/admin/patients`, `/admin/patients/:chartId`): charts for admitted applicants.
  Collection `patients/{intakeId}`, with `notes` and `notes/*/amendments` subcollections.
  Notes are consultation, progress, exercise or dietitian; draft (author-only) → signed (locked
  forever) → addenda.
  Prescriptions are structured entries (start / renew / stop) inside notes;
  `chartMath.currentPrescriptions()` derives what's current (`npm run check` self-test).
- **Roles:** `dietitian`, `provider`, `coAdmin` ("Co-admin"), `admin` (Dr. Antonious only),
  `superAdmin` (Hyacinth). Page access in `admin/staff/roles.js`; `firestore.rules` has
  `isClinical()` (all five) and `isStaff()` (co-admin and up). On the **Staff** page
  (`/admin/staff`) admin and co-admins grant dietitian, provider or co-admin; the admin can
  change or delete those and no-access accounts, a co-admin only dietitians, providers and
  no-access accounts. **Only the admin and super admin set a staff member's name** (what their
  signed notes carry), including when adding them: a co-admin's new accounts sign with their
  email until the admin uses Edit name. Only a super admin grants admin or
  touches the admin, and super admins are hidden from everyone else. Nobody edits or deletes
  their own account. Several test accounts are `admin` for now (Louie, 2026-10-01).
  Deleting removes the `user/{uid}` staff record only; the Firebase Auth login can only be
  deleted from the console (no server). Signed notes keep the signer's name on the note.
- The public login's sign-up record moved to `patientAccounts/{uid}`. The old `patients/{uid}`
  sign-up docs can be deleted in the console.
- **The new rules must be deployed** (`firebase deploy --only firestore:rules`) before any of this
  works against the live project. Run `npm run test:rules` first; it needs Java 21+ for the
  emulator and has not been run yet.

## Admin additions (2026-10-01)

The new-intake email was built and then removed for now (Louie, 2026-10-01); the draft and
how to build it are in `docs/client-portal.md`. Recipient when it returns: `info@corephia.com`,
later Dr. Antonious too.

**To-do** (`/admin/todo`, all clinical roles): renewals and follow-ups due within 7 days or
overdue, plus admitted patients with no signed note, from `chartMath.dueTasks()` (checked by
`npm run check`). No "mark done": signing the note that handles an item clears it. Reads every
active chart's notes on open (fine for a few hundred patients).

**Account menu** (`AccountMenu.jsx`, top right, with the theme switch to its left):
Profile opens `/admin/security` (titled "Profile": display name, password, two-step
sign-in); Sign out asks first. Password change re-checks the current password, plus the
authenticator code when two-step is on.

Admin dark mode: blue *text* uses `accent-text` (light #1d4ed8, dark #60a5fa), not
`accent-dark`, which stays for solid fills under `oncolor` text.

## Dietitian and exercise notes, calendar (decisions 2026-10-02, built since)

Built. Louie's answers, still the rules:

- **Roles:** a **Dietitian** role only. No exercise role yet, and no name chosen for it.
- **Logins:** the dietitian gets their own login and signs their own notes.
- **Exercise notes:** **providers write it** until an exercise role exists; that role takes it
  over later. **Dietitian notes** are written by the dietitian, the admin and the super admin
  (`canWriteNote` in `roles.js`, mirrored by `canWriteType` in the rules).
- **Calendar:** both real appointments (with times, Tampa time) and existing follow-up dates,
  shown as "Follow-up due: …" until booked.
- **What the dietitian can see:** everything a provider sees, same full dashboard (Louie,
  2026-10-08); can't admit or decline applicants; writes dietitian notes only.

## Admin changes (2026-10-08)

Louie asked for a whole-admin audit and the fixes; the audit also covered the public site.

- **Dashboard "Today" strip** (`dashboard/TodayStrip.jsx`): four cards (visits today, due this
  week, needs a reply, pending applicants), each linking to its page, each loading on its own.
  It counts the whole practice. Pending counts real records only. When there are no real intakes,
  the Dashboard and Applicants show the sample records with a visible "Sample data" notice.
- **Patient chart layout:** the header carries allergies, current prescriptions and next
  follow-ups. Notes: one **New note** menu (`NewNoteMenu.jsx`, one line under each type), "Your
  drafts" pinned above "Signed", a preview line per note ("Nothing written yet" flags empty
  drafts). Removed updates collapse to one line.
- **Profile photos:** the Profile page photo is changeable (`lib/staffPhotos.js`). Stored in
  Firestore `staffPhotos/{uid}` as a 256 px JPEG data URL (about 5 to 30 KB), not Firebase
  Storage (a new bucket needs the paid plan). Shown on Profile, the account menu and Staff.
  Demo mode keeps them in memory.
- **Audit log** (`recordAuditEvent`): `at` is the server time, the rules require the signed-in
  email and a known action. It now also records sign-in, sign-out (idle sign-out is separate),
  password change, two-step on/off and opening the full applicant list. Adding an action means
  adding it to `AUDIT_ACTIONS`, the rules list **and** `ACTION_LABELS` in `Activity.jsx`;
  `npm run check` catches the first two drifting. Older entries (an ISO string `at`) no longer show.
- **Idle sign-out** (`lib/useIdleTimeout.js`): the last-activity time lives in localStorage and
  is shared by every tab, so closing the tab no longer keeps someone signed in for days. A fresh
  sign-in resets it. "Last sign in" and the audit trail count real sign-ins only.
- **Dialogs** share `ui/useDialog.js`: Escape closes only the top dialog, focus moves only when it
  opens, the page-scroll lock lasts until the last dialog closes. Confirm dialogs start on
  Cancel. New dialogs should use the hook.
- **Note editor:** typing is saved when you leave any way (browser Back, navigation) and the tab
  asks before closing with unsaved text; Close waits at most 8 seconds for a save when offline.
- Dates the admin calls "today" use Tampa time (`calendarMath.todayInTampa()`), including the
  to-do, note defaults and Analytics days. New site events store Tampa's day.
- Unknown `/admin/...` addresses go to the dashboard. The Help page has topics for the chart,
  the dashboard and the changes above; keep them in step when a screen changes.

## Client portal (decisions 2026-10-02)

Planned on top of the existing patient login (`/account`), with Elation set aside per Louie.
Dr. Antonious's asks, the four sections, constraints and the notification email draft are in
`docs/client-portal.md`. Louie's answers:

- **Accounts are invite-only.** Staff admitting an applicant sends a "set up your client
  portal" invite; the account is linked to that intake record. No public sign-up: "Create
  account" leaves the site and "Log in" becomes "Patient portal".
- **Start with the login only.** The sections wait. Agreed order for later: Updates → Track
  progress → Messages; Membership waits on a billing system. **Since built** (`src/portal/`):
  Overview, Progress (patients log their own weight), Messages and Updates; Membership still
  waits. Open portal issues are under "Known remaining gaps". Resume notes:
  `docs/client-portal.md` "Where we left off".
- Idea to check before relying on it: Firebase email-link sign-in sent from the admin, with
  rules matching the signed-in email to an admitted intake record, would avoid needing a
  server (Blaze plan + functions) for the invite.

## Site analytics (2026-09-30)

Cookie-free, consent-first counts (meeting items 14 and 15). Google Analytics is deliberately
**not** used for now (Louie: "for later use").

- `CookieBanner.jsx` asks once; the answer lives in localStorage (`lib/analyticsConsent.js`). The
  footer's "Privacy choices" reopens it. Not shown on the intake or admin.
- Nothing is counted until the visitor presses Accept. `lib/track.js` then lazy-loads
  `lib/siteEvents.js` (so decliners never download it) and writes one `siteEvents` document per page
  view or link/button click: type, path, label, day, server time. No cookies, IP or visitor ID.
- Never counted: `/account`, `/admin`, and any click inside the intake. The intake counts only "opened".
  `firestore.rules` (`isWellFormedSiteEvent`) enforces the same lines. **The rules must be deployed**
  before counts land; until then writes are refused.
- Read in the admin at `/admin/analytics` ("Analytics"; `/admin/traffic` redirects there).

## Conventions and gotchas

- **Always use the skills and plugins the task needs, from `.claude/skills` or installed
  plugins, before doing the work. Every task, every follow-up, every small fix** (Louie,
  2026-10-02). This is not optional and not "covered" by a skill loaded earlier for a
  different request: a follow-up fix to a UI you just built loads the UI skills again. Check
  the available-skills listing at the start of each request and load every one that fits:

  | Task | Load first |
  |---|---|
  | Any UI, layout, styling or visual fix (site or admin) | `frontend-design`, plus `ui-ux-pro-max` and/or `ui-design-system` |
  | React components, hooks, state, performance | `react-best-practices`, `senior-frontend` |
  | New feature or behaviour change | `superpowers:brainstorming` (then the spec/plan skills it leads to) |
  | Bug, failing test, unexpected behaviour | `superpowers:systematic-debugging` |
  | Writing code with tests | `superpowers:test-driven-development` |
  | Browser checks of a change | `webapp-testing` or `playwright-cli` |
  | Visitor-facing copy | `humanizer` |
  | SEO, meta, schema | `seo-optimizer` |
  | Reviewing code | `code-reviewer` / `superpowers:requesting-code-review` |
  | Before saying something is done | `superpowers:verification-before-completion` |

  Say which skills were loaded when reporting back. If a skill can't run here (the
  `ui-ux-pro-max` search script and `webapp-testing` need Python, which isn't installed), still
  load it, follow its checklist by hand, and say so.
- **Verify UI changes in a real browser.** Playwright is installed in the session scratchpad
  (chromium-cli is not available on this Windows machine). Drive the dev server with a small
  `.mjs` script. The Playwright MCP tools also work, but they can only upload files from inside
  the project (copy a test file into `.playwright-mcp/` and delete it after).
- **Testing the admin without a login:** the admin's demo mode only runs when Firebase isn't
  configured, and `.env.local` configures it. Don't touch the user's dev server. Start your own
  on another port from node, which can pass empty values (PowerShell drops an empty env var):
  `spawn('npx.cmd', ['vite','--port','5190','--strictPort'], { shell: true, env: { ...process.env, VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_PROJECT_ID: '' } })`.
  Then open `/admin?demoRole=superAdmin` (or `provider`, `dietitian`, `coAdmin`, `admin`).
  Demo data is in memory, so a reload resets it. Stop your server and run
  `git clean -fdq .playwright-mcp` afterwards (the folder also holds tracked files; never
  delete it whole).
- **The intake keeps every screen in the DOM** (inactive ones hidden), so tests that read the
  "current screen" must pick the visible one. Leaving a half-filled intake raises a
  `beforeunload` prompt, which blocks tool calls until it is dismissed.
- **Intake fields** that the database validates carry matching limits: `maxLength` equal to the
  rules' caps, and `pattern` (`NOT_BLANK` in `intakeScreens.jsx`) so spaces alone can't pass
  `required` and then be refused on send. `DatePicker` builds `YYYY-MM-DD` from local parts (never
  `toISOString()`), and takes `min` and `max`. Pass `ariaLabel` to every `Select` and
  `DatePicker`; their visible button has no name otherwise.
- **Screenshots need scrolling first.** `useIntro`/`useReveal` start elements at `opacity-0`. A
  `fullPage` screenshot captures below-fold sections *blank* because the IntersectionObserver never
  fired. Scroll the page in steps with waits, then capture — otherwise you will report phantom bugs.
- **Isolate scroll tests.** Residual scroll from a previous assertion bleeds into the next and
  produces nonsense offsets. Use a fresh browser context per deep-link test.
- **Measure contrast against the painted background.** `getComputedStyle().backgroundColor` is
  transparent on gradient elements, so naive walking-up reports the wrong colour. Compute against
  the gradient stops.
- Port 5173 is often already occupied by a stray dev server; clean up with `netstat -ano` +
  `Stop-Process -Force`.
- **Hover = colour, never movement.** No lifts, nudges or bounces (the client's "shake"). Slow zooms
  of decorative art and colour highlights are fine. Parked idea from Louie (2026-09-30), placement TBD
  by him: a *wave-line highlight*, where a card's pale trend line turns bright `accent` with a soft
  glow on hover (see the "Start your weight loss program today" card in `Hero.jsx`).
- Repeating a CTA down a long page is fine; **inconsistent labels for the same action are not.**
  The canonical label is **"Get started"** on every button that opens the intake (per Louie,
  2026-09-30; it replaced "Start your intake" and "Start your journey"). The one exception would be
  "Choose {plan}" on pricing cards, which pass `?plan=` and preselect in the form, but those are off
  for now (below). The header has no CTA
  button (removed per Louie, 2026-09-30); the menu's "Start here" card is the site-wide entry.

  
