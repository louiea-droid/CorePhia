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
- **Address is "Tampa, Florida", final** (Louie, 2026-10-13). No street address: the JSON-LD,
  legal pages and contact lines use the city only.
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
npm run build    # vite build + SSR build + scripts/prerender.mjs -> dist/ (see Prerendering)
npm run lint     # oxlint
npm run preview  # serve the built dist/
```

Deployed via Firebase Hosting (`firebase.json` → `public: "dist"`, `cleanUrls: true`, SPA
rewrite to `/app.html`). **The next hosting deploy must include the 2026-10-13 build**, since the
rewrite target and `cleanUrls` changed with prerendering.
Firebase project is `corephia-health`. Hosting was last deployed around 2026-10-01 (the
`.firebase/` hosting cache changed in the 2026-09-30 and 2026-10-01 commits). Whether the
Firestore rules were deployed with it is not recorded; ask Louie.

## Stack

React 19 · Vite 8 · Tailwind CSS v4 · react-router-dom v7 · react-helmet-async · oxlint.
Firebase (Auth + Firestore). No TypeScript. Tests: `npm run check` (the self-checks: chartMath,
roles, calendarMath, todoMath, staffMath, inviteMath, progressMath, messageMath,
`googleAnalytics.check.js` (only public pages are trackable), and
`auditActions.check.js`, which fails if `AUDIT_ACTIONS` in `admin/lib/firebase.js` and the action
list in `firestore.rules` drift apart) and `npm run test:rules` (Firestore rules against the
emulator: all 153 pass as of 2026-10-21). This Windows machine has no Java and no global
`firebase`: a portable JDK 21 and `firebase-tools` in the session scratchpad work
(`firebase emulators:exec --project demo-corephia --only firestore "node --test tests/*.test.js"`).

## Architecture

Client-rendered SPA, with the public pages prerendered at build time (below).

### Prerendering (2026-10-13)

`npm run build` runs `vite build`, then `vite build --ssr src/entry-server.jsx`, then
`scripts/prerender.mjs`, which renders each public page with `renderToString` into
`dist/<route>.html` (`dist/index.html` for home). Hosting's `cleanUrls` serves `/about` from
`about.html` with no redirect, so canonicals stay slash-free. The route list is in the script:
home, about, contact, faq, membership, privacy, terms, privacy-practices, the four programs and
the guides (both read from their data files). Add a page there when you add a public route.

- React 19 hoists each page's Helmet `<title>`/`<meta>`/`<link>` to the front of the output; the
  script moves them into `<head>` tagged `data-prerender`, and `main.jsx` deletes those before
  `createRoot` so React's own tags are the only ones (otherwise titles and canonicals go stale on
  navigation). The browser does not hydrate; `createRoot` replaces the prerendered markup.
- Every other address (admin, portal, intake, 404s) is rewritten to `dist/app.html`, the plain
  shell, so none of them shows the prerendered home page to crawlers.
- The script fails the build if a page lacks a title, its exact canonical, or exactly one `<h1>`.
- Anything that renders on a public page must not touch `window`/`document`/`localStorage` while
  rendering (effects are fine). `MobileMenu` and `LoginPanel` return `null` when there is no
  `document`, because they portal into `document.body`.
- To test it, use the Firebase hosting emulator (`firebase emulators:start --only hosting`),
  not `vite preview`, which falls back to `index.html` for every path. The emulator ignores
  `firebase.json`'s `headers` and `redirects`: check those with `curl -I` after deploying.
- **First paint (2026-10-19):** `useIntro` starts visible on the build-time render and on the
  first render over a prerendered page (`App` calls `endPrerenderedStart` after that), so the
  hero and header are on screen from the HTML, and the intro only plays on later navigations.
  `CookieBanner` is never in the prerendered HTML; it appears once the script runs.

```
src/main.jsx          ErrorBoundary > HelmetProvider > BrowserRouter > App
src/App.jsx           ScrollManager + Header + <Routes> + Footer
src/pages/            Home, About, Contact, Faq, Membership, ProgramPage, SuccessStories, NotFound,
                      Legal (Privacy, Terms, PrivacyPractices), GuidePage
src/entry-server.jsx  build-time render for scripts/prerender.mjs
src/components/       PatientIntakeForm + intakeScreens (the /intake route) + all homepage sections,
                      ErrorBoundary (a plain "Something went wrong" screen instead of a blank page)
src/portal/           the patient portal (/account/*, /portal/setup, /portal/reset)
src/admin/            the staff admin (/admin/*)
src/lib/              Firebase submission, patient auth, analytics consent/tracking, siteContact
src/data/             programs.js, pricingTiers.js, guides.js
src/hooks/            useIntro (timed reveal), useReveal (IntersectionObserver reveal)
```

Routes: `/` · `/about` · `/contact` · `/faq` · `/membership` (`/pricing` redirects: a 301 in
`firebase.json`, plus `<Navigate>` in the app) ·
`/programs/:slug` (medical-care, dietitian-services, exercise-plan, follow-ups; an unknown slug
shows NotFound) · `/guides/:slug` (the 8 guides in `data/guides.js`) · `/success-stories` · `/privacy` · `/terms` · `/privacy-practices` · `/intake` · `/account/*` · `/portal/setup` ·
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

Fonts: Fraunces (serif, headings) + Inter (sans, body), self-hosted from `public/fonts/` (`@font-face`
in `index.css`, preloaded in `index.html`). No Google Fonts request.

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
- **SEO (2026-10-13):** `index.html` has one JSON-LD `@graph` (`WebSite` + `MedicalBusiness` with
  logo, image, phone and a Tampa, FL address, `@id` `https://corephia.com/#business`). Program
  pages add `Service` (provider = that `@id`) and `BreadcrumbList` next to their FAQPage.
  `public/llms.txt` summarizes the site for AI crawlers. Sitemap `lastmod` is 2026-10-13. Left
  for the console: redirect `www.corephia.com` to `corephia.com` in Hosting, and submit the
  sitemap in Google Search Console. Not yet: `sameAs` (no real social links). `areaServed` is
  Florida (`index.html` and `ProgramPage.jsx`).
- **Florida only** (Louie, 2026-10-13): the provider is licensed in Florida, so the FAQ, the
  Terms (patients must be in Florida at each visit), the JSON-LD and `llms.txt` say Florida.
  When licenses are added, update all four.
- **Guides (2026-10-13, 5 more 2026-10-15)** at `/guides/:slug` (`GuidePage.jsx`, content in
  `data/guides.js`): 8 guides, from how medical weight loss works to why weight loss slows down. Each links
  from its program page, has `MedicalWebPage` + `BreadcrumbList` JSON-LD, and is in the sitemap
  and `llms.txt`. Draft copy with the same rules as `programs.js` (no stats without a source,
  no medication names, medication only as one part of the program). The only number is the US
  Physical Activity Guidelines (150 minutes a week plus two strength days).
- **"Medically reviewed by a board-certified physician. Last reviewed …"** (`ReviewedLine.jsx`,
  date in `LAST_REVIEWED`) on the program pages, the FAQ and the guides. The provider is not
  named (Louie). **It is only true once Dr. Antonious has read those pages: get his sign-off
  before deploying**, and change the date when he reviews again. A guide written after the last
  review carries `reviewed: false` in `guides.js` (the 5 from 2026-10-15), which hides the line
  and the JSON-LD `lastReviewed` until he has read it; then remove the flag and move the date.
- **Tampa map link** (2026-10-13): "Tampa, Florida" in the footer and on Contact opens Google
  Maps in a new tab (`LOCATION` and `LOCATION_MAP_URL` in `lib/siteContact.js`).
- **Footer Social block is hidden** while every link in `socialLinks` (`Footer.jsx`) is `#`
  (Louie, 2026-10-13). It comes back by itself once one is a real URL.
- **Lighthouse (2026-10-13, mobile, local hosting emulator):** SEO 100, Best Practices 100,
  Accessibility 100, Performance 77 to 85 (it varies between runs). Fixed: the header and intake
  logo is `public/cp-health-header.webp`, a 336x112 copy (11 KB) of `cp-health.webp` (2172x724,
  kept); low-contrast small text; cache headers in `firebase.json` (`/assets/**` a year, images
  a day; the emulator doesn't apply them, so check with `curl -I` after deploying). Since then
  the fonts are self-hosted and the hero no longer waits for JavaScript (2026-10-19, see
  Prerendering); not re-measured yet.
- **Security headers (2026-10-19)** in `firebase.json` for every path: HSTS, `nosniff`,
  `X-Frame-Options: DENY` plus `frame-ancestors 'none'` (no framing of the intake or admin),
  a referrer policy and a permissions policy. Not testable on the emulator.
- **Google Business Profile:** to be set up by Louie (needs the business's Google account):
  CorePhia, category "Weight loss service", service-area business with the address hidden,
  Florida, +1 (850) 454-6700, corephia.com.
- **Legal pages (2026-10-13), drafts awaiting a Florida health-care attorney:** `/privacy`,
  `/terms` and `/privacy-practices` (the HIPAA Notice of Privacy Practices the intake checkbox
  links to, opening in a new tab) in `pages/Legal.jsx`, linked from the footer. They describe
  what the system really does (intake fields, portal, opt-in visit counts, Google Firebase and
  EmailJS as service providers, Google Fonts, server logs). **Change the system, change these.**
  Still open for the client: the legal entity name, the cancellation and refund policy (the
  Terms say it is confirmed in writing at enrollment), and more licensed states when there are any.

### Audit 2026-10-21

`docs/audit-2026-10-21.md` holds the whole-system audit. Its **"Fix first"** list (invite email
abuse, offline note loss, the Membership link preview, GA timing, invite/discharge rules, intake
delete, vitals ranges, copy vs Terms) is planned for 2026-10-22. Strike items there as they ship.

### Blockers before going live with real patients

1. **Firestore needs a BAA before it holds PHI.** The intake collects DOB, address, medications,
   conditions, cancer and family history, and a typed signature under a HIPAA acknowledgement.
   A plain Firestore project is not covered; a Google Cloud BAA (or another destination) is needed.
   **Elation** is still the possible EMR (pricing being negotiated, set aside for now per Louie);
   Hyacinth would load intake data into it. Submission emails must be notifications only, never PHI.
   See `docs/meeting-analysis.md`. `buildIntakeRecord()` deliberately groups fields to mirror
   standard EMR intake sections (demographics / vitals / medicalHistory /
   familyHistory / socialHistory / nutrition / visit / consent) so a vendor mapping is direct.
2. **Firestore rules: deploy.** `npm run test:rules` runs now (Java 21 installed) and all 150
   tests pass (2026-10-19). The rules are not deployed: `firebase deploy --only firestore:rules`,
   **together with the site**, since the 2026-10-19 rules expect the new client (a chart's
   `lastNote` names its `noteId`, linking a portal login marks the invite used in the same batch,
   the intake sections are checked key by key). Keep `firestore.rules` free of a byte-order mark
   (PowerShell's `Set-Content -Encoding utf8` adds one). When editing it from a script, never put
   new text through `String.prototype.replace`: a `$'` in the rules' regexes expands to "the rest
   of the file" and once duplicated the whole file (2026-10-19). Use `split(a).join(b)`.
   **Not done yet: App Check** (reCAPTCHA) in the Firebase console, so scripts can't flood
   `intakeRecords`; the rules limit what each write holds, not how many arrive. It would need a
   privacy policy line and the attorney's view, since reCAPTCHA would run on the intake.
3. **Phone number is real** (`+1 (850) 454-6700`, 2026-10-13), set once in `lib/siteContact.js`
   (Contact, footer, intake help line, portal). Footer social links are still `#` (the Social
   block is hidden until they are real). Tampa, Florida is the final address.

### Waiting on assets from the client

- A real headshot of Dr. Antonious. Deliberately left as an illustrated `PersonAvatar` placeholder
  until then — do not fabricate a photo. Photography is still thin: the only photos are Unsplash
  placeholder cutouts (`public/start-here.webp`, `public/programs/{slug}.webp` on the program
  page heroes), all to be replaced with the client's own.
- A logo without orange in it. `cp-health.webp` (the logo, ~98 KB) still has the two orange arcs
  around the infinity mark (looked at 2026-10-02). Louie said to set this aside (2026-10-13). When
  it arrives, also regenerate `cp-health-header.webp` (336x112) and update `cp-logo.webp`.
- Real social profile URLs, success stories with signed patient consent, the how-it-works video.

### Known remaining gaps

- Footer entries without a `to`/`href` render muted by design, not broken links.
- The FAQ's "Where do you operate?" now says Florida only (2026-10-13). (Insurance is
  answered: cash pay.) The FAQ also says 18 or older, points to the privacy policy and notice,
  and has an urgent-problem answer (911; portal messages read in working hours), 2026-10-13.
- **Medication wording is approved as is** (Dr. Antonious, via Louie, 2026-10-14): the home Medical
  care card (`ProgramGrid.jsx`), the pricing badge (`PricingSection.jsx`), the Core tier feature and
  the About pillar stay as written. Do not re-flag or reword them. The About intro now says
  "weight loss medication when clinically appropriate".
- **Portal issues from the 2026-10-08 audit, fixed 2026-10-19:** the portal has its own named
  Firebase app (`"portal"` in `portal/lib/patientAuth.js`; the intake, contact, site events and
  admin share the default app and look it up by name, never `getApps().length`); the portal signs
  out after 15 idle minutes (`useIdleTimeout` with `PORTAL_ACTIVITY_KEY`); a login can move to
  a new chart with that chart's invite (a returning patient, or an old `patientAccounts` doc with
  no `intakeId`); "Forgot password" from an invite returns to it; a discharged chart takes no
  weigh-ins (rules and UI); `/portal/*` visits are not counted. Linking marks the invite `used`,
  so it can't be read by its link afterwards.
- **Intake (2026-10-19):** every section is checked key by key with length caps in the rules
  (`isIntakeSections`; a new intake field must be added there too, or sends are refused), and
  textareas carry `maxLength={2000}`. A required textarea of spaces only is invalid
  (`firstInvalid`), which matters for the Edit dialog on the review screen. After 20 seconds on
  "Sending…" the intake says the connection may have dropped (Firestore queues the write offline).
- Left on purpose: the Dashboard's Today strip and To-do still read every active chart's notes
  (fine for a few hundred patients; past that, store the next due dates on the chart), and
  Analytics still reads one document per event (per-day totals need a server).
- Two-step sign-in is optional for staff and not enforced by the rules. Enforcing it needs
  Identity Platform in the Firebase console, then a rules check on the second factor.
- **18 or older** (decided 2026-10-13): the intake's date of birth refuses anyone under 18
  (`adultBirthdayCutoff` in `intakeScreens.jsx`) and the Terms say so. Client-side only; the
  rules check only the date format.
- Focus is not trapped in the mobile menu and login panel (Tab can leave them).
- Unsourced claims removed 2026-10-13: the science card now reads "Built around you" / "Your
  plan is adjusted as you progress" with the gauge on "On target" (no number), and the "Proven
  Results" badge and the footer "Certified" badge are gone. Don't reintroduce a result number
  without a cited source.
- Success stories: the page stays `noindex` until real stories with signed patient consent exist.
- Open client questions are tracked in `docs/meeting-analysis.md` §7.

---

## Membership (2026-09-30)

`/membership` shows the three plans (Core, Core+, Core Complete) with their prices ($199 / $249 /
$349 a month; `PRICES_ANNOUNCED` back on per Louie, 2026-09-30), no per-card buttons and no "Most
popular" highlight; `/pricing` redirects there. Nav, footer and the Hero quick link say "Membership". Two
switches in `data/pricingTiers.js`: `PLANS_SHOWN` (plans on the page, the intake plan question,
`?plan=` preselect) and `PRICES_ANNOUNCED` (false = "Coming soon" on cards and in the FAQ). The
program pages carry no pricing block. Plans and features are still placeholders awaiting the
client. The Core tier's "Prescription medication" feature and the "Medication Available" badge are
approved (2026-10-14). Core's "24/7 patient support" became "Patient support through
your portal" (2026-10-13), to match the Terms (messages are read in working hours).

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
  works against the live project. `npm run test:rules` passes (2026-10-19).

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
  It counts the whole practice. The sample-data fallback and its notice were removed: with no real
  intakes the pages are empty. Sample records only appear in demo mode.
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
  password change, two-step on/off and opening the full applicant list (at most once per half
  hour per tab, so it doesn't push real events out of view). Adding an action means
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

## Admin changes (2026-10-19)

From a whole-system audit (Louie asked for every finding fixed):

- **Discharged:** "Make inactive" on Patients sets the intake status `discharged` (was
  `declined`), shown and filterable on Applicants. `INTAKE_STATUSES` and the rules' status list
  both carry it.
- **Live role and name:** `AdminApp` follows `user/{uid}` (`watchAdminAccess`), so a rename or
  role change applies at once instead of failing every write until the next sign-in.
- **Rules tightened** (tests in `tests/firestore.rules.test.js`): a chart's `lastNote` must name
  a note signed in the same batch; a draft on an inactive chart can't be edited or signed (only
  deleted); "added by" on a staff record must be the adder's own name; an appointment must be
  with a real staff record; `admittedBy` holds only uid, name and role.
- Adding staff: if the staff record is refused, the new login deletes itself, so the email can
  be added again. "Start their charts" on Patients shows only for admitters. Dashboard weeks are
  Tampa weeks. Analytics loads the chosen range (30 days on open) and keeps the longest loaded.
  The chart's Messages line listens to that patient's topics only.

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

Two things run after the visitor presses Accept on the banner: the cookie-free counts below
(meeting items 14 and 15), and Google Analytics on public pages only (2026-10-13).

- `CookieBanner.jsx` asks once; the answer lives in localStorage (`lib/analyticsConsent.js`). The
  footer's "Privacy choices" reopens it. Not shown on the intake or admin.
- Nothing is counted until the visitor presses Accept. `lib/track.js` then lazy-loads
  `lib/siteEvents.js` (so decliners never download it) and writes one `siteEvents` document per page
  view or link/button click: type, path, label, day, server time. No cookies, IP or visitor ID.
- Never counted: `/account`, `/admin`, `/portal` (setup and reset), and any click inside the intake. The intake counts only "opened".
  `firestore.rules` (`isWellFormedSiteEvent`) enforces the same lines. **The rules must be deployed**
  before counts land; until then writes are refused.
- Read in the admin at `/admin/analytics` ("Analytics"; `/admin/traffic` redirects there).
  The range switch is 7, 30, 90 days or **Custom** (a number of days, weeks or months, a month
  = 30 days, up to 365; 2026-10-12). It loads the chosen range and keeps the longest loaded so
  far; only a longer range reloads (2026-10-19).

### Google Analytics (2026-10-13, Louie)

GA4 property `G-180FKQGVY5` (switched from `G-7WBYHQZ3ER` on 2026-10-14, Louie), in `lib/googleAnalytics.js`, called once from `App` (above the admin
and intake branches, so every route change passes through). **Never paste Google's snippet into
`index.html`**: it would run on every page, before consent.

- **Public pages only**, by an allowlist (`PUBLIC_PAGE`: home, about, contact, faq, membership,
  privacy, terms, privacy-practices, success-stories, programs, guides). A new public route is not
  tracked until it is added there. Google won't sign a BAA for Analytics, and HHS has warned that
  tracking where health information is entered can break HIPAA (the FTC fined GoodRx and
  BetterHelp for this), so the intake, portal and admin must never be on the list.
  `googleAnalytics.check.js` (in `npm run check`) fails if one of them matches.
- On a non-public page Google's own `ga-disable-G-180FKQGVY5` flag is set, which also stops its
  automatic (enhanced measurement) events. The script loads only on the first public page after
  Accept. Page views are sent by hand on each route change (`send_page_view: false`), with no
  query string. Google signals and ad personalization are off in the config.
- Decline after Accept sets the flag and deletes the `_ga` cookies. Production builds only
  (`import.meta.env.PROD`); the dev server sends nothing.
- The banner and the privacy policy describe it (cookies on public pages, never the intake or
  portal, ad features off). **Change them if this changes.**
- Settings for Louie in the GA console: Enhanced measurement with "Page changes based on browser
  history events" and "Form interactions" off (the first would double-count), data retention 2
  months, Google signals off.
- Tested 2026-10-13 against the production build on the hosting emulator, with hits blocked so
  nothing reached the live property: no script before Accept, page views on public pages and
  route changes, nothing on `/intake` or `/account`, cookies gone after Decline.

## Conventions and gotchas

- **Admin checkboxes** are styled once in `index.css` (rounded box, accent fill, white tick),
  scoped to `#admin-portal-root` (dialogs portal into it) and skipping `role="switch"`. Don't
  restyle them per component. The public intake uses its own option cards.
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

  **Be efficient, and check for new skills every time.** Skills are added over time (plugins
  and `.claude/skills`), so this table goes stale. At the start of every request, read the
  current available-skills listing for anything new that fits, not just the rows above.
  Skills seen so far that are not in the table: `ponytail` (keep the change minimal),
  `simplify` and `code-review` (after a change), `dataviz` (any chart, such as Analytics),
  `run` (launch the app). Load only the skills that fit the task: one UI fix needs the UI
  skills, not every skill. Don't load a skill twice in one request. Run independent loads in
  one batch.
  Say which skills were loaded when reporting back. If a skill can't run here (the
  `ui-ux-pro-max` search script and `webapp-testing` need Python, which isn't installed), still
  load it, follow its checklist by hand, and say so.
- **Verify UI changes in a real browser.** The Playwright MCP tools work (`browser_navigate`,
  `browser_evaluate`); a Playwright install in the session scratchpad may not survive between
  sessions (chromium-cli is not available on this Windows machine). The MCP tools but they can only upload files from inside
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
  rules' caps (`isIntakeSections`: free text 2000, picked answers 100), and `pattern` (`NOT_BLANK` in `intakeScreens.jsx`) so spaces alone can't pass
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

  
