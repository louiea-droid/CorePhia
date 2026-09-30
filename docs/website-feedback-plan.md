# Website feedback: analysis and plan

As of 2026-09-29. Source: client/stakeholder notes (12 items), checked against the current codebase.

The notes boil down to one goal: **turn the site from a single long homepage into a set of focused,
converting pages that funnel into a distraction-free intake.** Most items serve that goal. A few
(cookie banner, analytics, success stories) carry legal or compliance weight on a health site and
need decisions before they are built.

---

## 1. The notes, grouped

| # | Note | Theme | Effort | Priority |
|---|---|---|---|---|
| 1 | Landing page for each service, with its own converting content | Pages / conversion | L | P1 |
| 2 | Clicking a service (e.g. "Structured exercise plans") goes to that page, not a homepage anchor | Pages / navigation | S (after #1) | P1 |
| 3 | Make the intake form multi-step and interactive | Intake | M | P1 |
| 4 | On the form page the visitor either fills it out or closes the tab, no other options | Intake | S | P1 |
| 5 | Action buttons use the primary CTA color | Visual | S | P1 |
| 6 | Better slogans and calls to action | Copy | M | P2 |
| 7 | Add success stories | Trust / content | M + client input | P2 |
| 8 | Set up analytics | Measurement | M | P1 (with #9) |
| 9 | Add a cookie banner | Legal / consent | S–M | P1 (with #8) |
| 10 | Remove the scrollbar on mobile | Visual | XS | P3 |
| 11 | Maybe remove hover interactions on all elements | Visual | S | P3, decide first |
| 12 | "Landing page for each service" (repeat of #1) | — | — | merged into #1 |

Effort: XS < 1 h, S < half a day, M 1–2 days, L 3+ days.

---

## 2. Guardrails every item must respect

These come from `CLAUDE.md` and are not optional.

- **Program, never a storefront.** Nothing may read as "pay money, receive medication." The medical
  support page especially must frame medication as one part of a program, prescribed by a licensed
  provider only when clinically appropriate. No "get your GLP-1" headlines, no pen imagery, no price
  next to a drug name.
- **No miracle language.** Slogans must avoid "breakthrough", "guaranteed", "melt fat", and similar.
- **Unsourced claims stay out.** "Lose up to 20%" and the "Proven Results" badge already have nothing
  behind them. New pages and success stories must not add more of the same.
- **One CTA label per action.** "Start your intake" is canonical ("Get started" in the header,
  "Choose {plan}" on pricing cards).
- **No em dashes in visitor-facing copy.**
- **Contrast.** Text on `brand` gradients must be `paper-50` / `paper-100`.

---

## 3. Service landing pages (notes #1, #2, #12)

**Current state.** Services live only as cards in `ProgramGrid.jsx` (`#programs` on the homepage) and
as hero bullets in `Hero.jsx`. The cards are not links. Hero quick links point at `/#programs` and
`/#pricing` anchors.

**Services to give pages** (from `ProgramGrid.jsx`):

| Service | Proposed route | Existing art |
|---|---|---|
| Physician-guided medical support | `/services/medical-support` | `CareShieldArt` |
| Personalized nutrition coaching (dietitian services) | `/services/nutrition` | `MealPlateArt` |
| Ongoing health checks | `/services/health-checks` | `HealthCheckArt` |
| Structured exercise plans (exercise prescriptions) | `/services/exercise` | `ActivityArt` |

**Approach.** One `ServicePage` component driven by a data object per service (no four hand-built
pages). Each page, top to bottom:

1. Hero: service-specific headline, one-line promise, "Start your intake" CTA.
2. What you get: 3–4 concrete deliverables (e.g. "a written exercise prescription reviewed at each
   check-in").
3. How it works: 3 steps, ending in intake.
4. How it fits the program: short block tying the service back to the other three pillars. This is
   what keeps the medical support page compliant.
5. Service FAQ: 4–6 questions (reuse the pattern in `Faq.jsx`). Doubles as AEO content, which is the
   site's biggest SEO gap.
6. Closing CTA, same label.

Plus per-route SEO: title, description, canonical, `MedicalWebPage` / `Service` JSON-LD, sitemap
entries.

**Wiring.** Make each `ProgramGrid` card a `Link` to its page. Point the Hero bullets at the pages.
Add the pages to the header/mobile menu and footer. Optionally pass `?service=` into `/intake` the
same way pricing passes `?plan=`, so analytics can attribute conversions per service.

---

## 4. Intake form (notes #3, #4)

**Current state.** `PatientIntakeForm.jsx` is one long page with 9 `SectionCard` fieldsets:
Personal information, Emergency contact, Insurance, Height & weight, Medical history, Family history,
Lifestyle & nutrition, Appointment details, Consent & signature. It renders inside the normal site
`Header` and `Footer`. Submission now goes through `lib/intakeSubmission` (confirm the destination is
BAA-covered before launch; see the PHI blocker in `CLAUDE.md`).

**Multi-step.** Group the 9 sections into 5 steps so each screen is short:

| Step | Sections | Why grouped |
|---|---|---|
| 1. About you | Personal information, Height & weight | Easy start; BMI can show immediately |
| 2. Health history | Medical history, Family history | The clinical core |
| 3. Lifestyle | Lifestyle & nutrition | Feeds dietitian + exercise plans |
| 4. Logistics | Appointment details, Insurance, Emergency contact | Admin details once they are invested |
| 5. Review & sign | Summary of answers, Consent & signature | Nothing is signed unseen |

Keep one `<form>` and hide inactive steps, so `buildIntakeRecord()` and the EMR-shaped grouping stay
unchanged. Validate per step with native constraint validation (`reportValidity()` on the step's
fieldset) before "Next". Show a progress bar ("Step 2 of 5"), keep Back available, move focus to the
step heading on change, and scroll to top. Keep answers in `sessionStorage` only if the team accepts
PHI sitting in the browser; default is no.

**Interactive touches** that earn their place: plan preselected from `?plan=`, BMI computed live from
height and weight, conditional follow-ups (e.g. medication list only if "yes"), a review screen with
"Edit" links per step.

**Distraction-free ("fill it out or close the tab").** On `/intake`:

- Replace the site header with a minimal bar: logo (not a link) and a "Step x of 5" indicator.
- Remove the footer, nav, "back" link, and any outbound links.
- Keep only what compliance and accessibility require: links to Privacy Policy / Terms (open in a
  new tab) and a phone number for help. Removing these is not safe on a health intake.
- Implementation: in `App.jsx`, render the intake route outside the `Header`/`Footer` shell, the same
  way `/admin` already is.

---

## 5. Visual and interaction changes (notes #5, #10, #11)

**#5 Primary CTA color.** Today action buttons are split: some are `bg-ink-950` (navy: intake submit,
Contact submit, About, Account, pricing featured card), others `bg-accent` (Science, About, FAQ,
Contact aside). Standardise every primary action on one token. Recommendation: `accent-dark`
(`#2563eb`) with `paper-50` text, which passes contrast; `accent` with `ink-950` text works on dark
sections. Define it once (a `.btn-primary` utility in `index.css` or a shared `Button` component) so
it cannot drift again. Secondary actions stay outlined.

**#10 Remove scrollbar on mobile.** `index.css` already styles the `html` scrollbar and has a
`.no-scrollbar` utility. Apply the hiding rules to `html` under a mobile media query (e.g.
`@media (pointer: coarse)` or `max-width: 640px`). Scrolling still works; only the bar is hidden.
Most mobile browsers already use overlay scrollbars, so confirm on a real device what was seen.

**#11 Remove hover interactions ("maybe").** Hover effects are everywhere: card lifts
(`hover:-translate-y-1`), scale-ups, the header CTA sweep, arrow nudges. Removing them all would also
remove useful feedback on links and buttons. Recommendation:

- Keep hover color/underline changes on buttons and links (they signal "clickable").
- Remove decorative motion: card lifts, image scale, the header sweep animation.
- Scope remaining hover styles to devices that can hover. Tailwind v4's `hover:` already applies only
  under `@media (hover: hover)`, so touch devices do not get sticky hover states today.

---

## 6. Slogans and calls to action (note #6)

**Current copy.** Homepage program heading: "Your weight loss, done the right way." CTA labels:
"Start your intake", "Get started", "Choose {plan}".

**Direction.** Specific over clever. Lead with who runs it and what you get. Avoid miracle language
and anything that centres the drug.

Headline options to test:

- "Weight loss, led by a physician. Built around your life."
- "A real doctor, a real plan, real support."
- "Food, movement, and medical care in one plan."
- "The program your doctor would design. Because ours did."

Per-service headlines:

- Nutrition: "A meal plan built around how you actually eat."
- Exercise: "Workouts prescribed for your body, not copied from the internet."
- Health checks: "Check-ins that keep your plan honest."
- Medical support: "Medication when it is right for you, never as a shortcut."

CTA: keep "Start your intake" as the canonical label (consistency rule). Test supporting microcopy
under the button instead of changing the label, e.g. "Takes about 10 minutes. A provider reviews
every intake."

---

## 7. Success stories (note #7)

This is the highest compliance risk in the list.

- **Only real stories, with written consent.** No invented patients, stock photos presented as
  patients, or AI-generated faces. FTC endorsement rules apply.
- **Typical-results disclosure.** If a story cites pounds lost, it needs "results not typical" framing
  or data on typical results. The FTC requires this for weight loss specifically.
- **Consent covers PHI.** A patient's story is PHI; a HIPAA-compliant authorization form is needed
  before publishing.
- **Don't credit the medication.** Stories should credit the program (coaching, plan, support), not
  "the shot", to stay inside the program framing.

**Plan:** build a `SuccessStories` section (homepage and per-service pages) that renders from a data
file, and ships **hidden** until the client supplies real, consented stories. Until then, do not
publish placeholders on a public page.

---

## 8. Analytics and cookie banner (notes #8, #9)

These must ship together: the banner exists to gate the analytics.

**Constraint.** HHS guidance (2022, partly vacated in 2024 but still the direction of travel) and FTC
enforcement against health sites (GoodRx, BetterHelp) mean standard tracking pixels on a health site
are a legal risk. Meta Pixel, TikTok pixel, and default GA4 on `/intake` can leak health information.

**Recommendation.**

- Use a privacy-focused, cookieless tool (e.g. Plausible or a self-hosted equivalent) for page views
  and conversion events. It needs no consent banner in most US states and sends no PHI.
- If GA4 is required for marketing, load it **only after consent**, via Google Consent Mode v2, and
  **never on `/intake`, `/account`, or `/admin`**.
- **No ad pixels** on the site until counsel signs off.
- Cookie banner: accept / reject / customise with equal prominence, stored choice, and a link to a
  Privacy Policy (which does not exist yet; see `CLAUDE.md` gaps). Wire the existing
  `#privacy-choices` footer entry to reopen the banner.

**Events worth tracking:** CTA click (with location), service page view, intake started, intake step
reached (1–5, gives a funnel), intake submitted, contact submitted. Never send field values.

---

## 9. Suggested order

1. **Decide:** CTA colour, hover scope, analytics tool (open questions below).
2. **CTA colour + mobile scrollbar + hover cleanup.** Small, site-wide, fast win.
3. **Distraction-free intake shell, then multi-step form.** Highest conversion impact.
4. **Cookie banner + analytics.** Needed before the funnel changes can be measured.
5. **Service landing pages + card links.** Largest piece; content from the client.
6. **Slogans / CTA microcopy** rolled into the new pages.
7. **Success stories** once real, consented material exists.

Still blocking any deploy (from `CLAUDE.md`): canonical domain, placeholder contact details, and a
BAA-covered destination for intake and contact submissions.

---

## 10. Open questions for the client

- [ ] Primary CTA colour: bright blue (`accent-dark`) or keep navy (`ink-950`)?
- [ ] Hover: remove only decorative motion, or literally all hover effects?
- [ ] Mobile scrollbar: which device/browser showed it?
- [ ] Analytics: cookieless (Plausible) is enough, or is GA4 / ad tracking required for marketing?
- [ ] Are there real patients willing to share stories, with signed authorization?
- [ ] Copy for each service page: will Dr. Antonious supply or review it (needed for "medically
      reviewed by")?
- [ ] Which states is the program available in? (Needed on service pages and FAQ.)
- [ ] Intake: OK to keep a help phone number and Privacy/Terms links on the otherwise locked-down page?
