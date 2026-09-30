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

- **Cash only.** No insurance questions anywhere in the intake.
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
Firebase project is `corephia-health`. Last actual deploy was 2026-09-04 — everything since is
unreleased.

## Stack

React 19 · Vite 8 · Tailwind CSS v4 · react-router-dom v7 · react-helmet-async · oxlint.
No TypeScript, no test suite.

## Architecture

Client-rendered SPA, no SSR or prerendering.

```
src/main.jsx          HelmetProvider > BrowserRouter > App
src/App.jsx           ScrollManager + Header + <Routes> + Footer
src/pages/            Home, About, Contact
src/components/       PatientIntakeForm (the /intake route) + all homepage sections
src/hooks/            useIntro (timed reveal), useReveal (IntersectionObserver reveal)
```

Routes: `/` · `/about` · `/contact` · `/intake`

`ScrollManager` in `App.jsx` handles scroll on navigation: scrolls to top on a new route, honours a
`#hash` target (the browser can't — React hasn't rendered the section when the hash resolves), and
leaves back/forward alone so the browser restores position.

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

Done: pivot from a multi-vertical Rx marketplace to a weight-loss-program site · blue/navy re-theme ·
react-router with About/Contact/intake routes · per-route SEO metadata, JSON-LD, sitemap, OG image ·
expanded EMR-shaped intake form · compliance copy fixes · accessibility and visual pass.

### Blockers before the next deploy

1. **The intake form has no destination.** `submitIntakeRecord()` in `PatientIntakeForm.jsx` is a
   stub — it returns the record and sends nothing. Meanwhile the confirmation screen tells the
   patient a care team will contact them within one business day. The form collects DOB, address,
   medications, conditions, cancer and family history, and a typed legal signature under a HIPAA
   acknowledgement. **It must not ship in this state.** The Contact form is the same.
   The intended destination is an EMR: **Elation** is the front-runner, not yet confirmed (still
   negotiating pricing). A custom EMR in the admin was considered and dropped; the site stays
   intake only, and Hyacinth loads intake data into the EMR. Submission emails must be
   notifications only, never PHI. Note a plain Firestore write is not sufficient for PHI — that
   needs a BAA. See `docs/meeting-analysis.md`.
   `buildIntakeRecord()` deliberately groups fields to mirror standard EMR intake sections
   (demographics / emergencyContact / vitals / medicalHistory / familyHistory /
   socialHistory / nutrition / visit / consent) so the mapping is direct when a vendor exists.
2. **Canonical domain is unresolved.** Canonicals and OG tags say `www.corephia.com`, the footer
   says `corephiahealth.com`, the Firebase project is `corephia-health`. Pick one — a wrong
   canonical actively deindexes the site.
3. **Placeholder contact details are on a public page.** `(000) 123-4567` and
   `hello@corephia.com` in `Contact.jsx` and `Footer.jsx` (marked with TODOs). Tampa is real.

### Waiting on assets from the client

- A real headshot of Dr. Antonious. Deliberately left as an illustrated `PersonAvatar` placeholder
  until then — do not fabricate a photo. Photography is still thin: the only photos are Unsplash
  placeholder cutouts (`public/start-here.webp`, `public/programs/{slug}.webp` on the program
  page heroes), all to be replaced with the client's own.
- A logo without orange in it. `cp-health.png` still contains orange from the old palette and
  clashes on blue. It is also 335 KB for a ~56px-tall render; `cp-logo.png` is a **1.28 MB favicon**.

### Known remaining gaps

- Dead anchors with no pages behind them: `#forgot-password`, `#create-account`.
  Footer entries without a `to`/`href` render as muted plain text by design, not broken links.
- No Privacy Policy or Terms pages exist (needed for a health site).
- Unsourced claims: "Members lose up to 20% body weight*" has a footnote with no study, N, or date.
  "Evidence Based" and "Proven Results" badges have nothing behind them. YMYL/E-E-A-T liability.
- No FAQ anywhere, and the site never answers: is it safe, who qualifies, which states, how fast,
  is insurance accepted. This is the biggest AEO gap — answer engines have little to extract.
- No "medically reviewed by" attribution or last-updated dates.
- A "Certified" badge in the footer that does not say certified by whom.

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

- **Always use whatever skill or plugin fits the task, from `.claude/skills` or installed
  plugins, before doing the work** — proactively, not just when asked, and regardless of how
  small the task looks. Check the available-skills listing at the start of the task rather than
  waiting to be told. For UI/layout/visual changes on this repo specifically, that means loading
  `frontend-design` (and `ui-design-system` or `ui-ux-pro-max` when relevant) before touching the
  code.
- **Verify UI changes in a real browser.** Playwright is installed in the session scratchpad
  (chromium-cli is not available on this Windows machine). Drive the dev server with a small
  `.mjs` script.
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

  
