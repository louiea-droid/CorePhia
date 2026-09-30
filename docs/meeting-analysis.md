# Meeting transcription: analysis

Source: `docs/MEETING TRANSCRIPTION.docx` (52 paragraphs, auto-transcribed, undated).
Analysed 2026-09-29 against the current codebase.

**Speakers:** Dr. Daniel Antonious (client, drives the meeting), Glenn and Louie (Hyacinth, the
build team). Dimitri is referenced but not present; he reviewed the site earlier and will review
again after the big changes.

**Reference site:** "HIMSS" / "HEMS" in the transcript is **Hims (hims.com)**, the telehealth brand
(confirmed 2026-09-29). Its weight-loss flow is the model for the new intake form. hims.com blocks
automated browsers (Cloudflare 403), so the flow has to be reviewed from screenshots or a screen
recording supplied by the team.

## Confirmed answers (2026-09-29)

| Question | Answer |
|---|---|
| Is "HIMSS" hims.com? | Yes. |
| "Physical therapy" vs "exercise plan" | Same thing: the **exercise plan**. No physical therapy service. |
| Nutrition coaching vs dietitian services | Same service, **one page**. |
| Face on the "Start here" card | Client supplies the image later. Build the card with an image slot. |
| About page | **Remove his name entirely**; use "our provider". Full rewrite comes later. |
| New-applicant notification emails | To be decided later; client will say. Build without hardcoding recipients. |

**Bottom line.** Two big pieces of work: (1) a Hims-style one-question-at-a-time intake you cannot
leave, and (2) breaking the homepage into real pages (one per service, success stories, pricing,
how-it-works). Everything else is small. The "build our own EMR" idea was raised and then
**dropped in the meeting**: the site stays intake only, and an EMR (Elation is the front-runner)
holds the medical record.

This supersedes parts of `docs/website-feedback-plan.md`; the differences are listed in section 6.

---

## 1. Decisions and requests, in order of importance

| # | Request (transcript ¶) | What it means in the code | Size |
|---|---|---|---|
| 1 | Interactive intake: one question per screen, later questions depend on earlier answers, "make it pretty" (¶1–6, 28) | Rebuild `PatientIntakeForm.jsx` as a branching, single-question flow | L |
| 2 | Once in the form you "can't click out", no route back to the homepage (¶2–3) | Render `/intake` without `Header`/`Footer`, like `/admin` in `App.jsx` | S |
| 3 | Cash only: **drop all insurance questions** (¶3) | Delete the "Insurance information" `SectionCard` and the `insurance` group in `buildIntakeRecord()` | XS |
| 4 | Don't show pens or medication products in the flow (¶3) | No product imagery or product picker screens | — |
| 5 | Each service gets its own page describing what we do, with pricing at the bottom (¶10–13, 24–25) | New routes; `MobileMenu.jsx` lines 9, 17–19 and `ProgramGrid` cards currently all point to `/#programs` | L |
| 6 | Sidebar promo card with a face: "Ready to lose weight? Start here" → opens the form (¶1) | New card at the top of `MobileMenu.jsx`, linking to `/intake` | S |
| 7 | Success stories page, linked in the sidebar (¶14) | New `/success-stories` route + menu link | M + content |
| 8 | Pricing off the homepage, "it's unattractive", becomes its own page (¶24, 47) | Remove `<PricingSection />` from `Home.jsx`, add `/pricing`; also update "Membership Pricing" `/#pricing` links | S |
| 9 | Replace the two-line hero "Real results. Lasting confidence." with one catchy line (¶7–9) | `Hero.jsx:54` | XS |
| 10 | Remove the "shake" on hover (¶20) | Remove hover motion (`hover:-translate-y-*`, `hover:scale-*`, `group-hover:translate-x-*`) site-wide | S |
| 11 | Remove "Dr. Antonious's story"; use "About our provider" / "our provider" instead (¶21–23) | Rewrite `About.jsx`, `TeamSection.jsx`, Hero quick link at `Hero.jsx:23` | S |
| 12 | Video + how-to, which the client will send, becomes its own landing page (¶20) | `/how-it-works` page, blocked on the video | M, blocked |
| 13 | Remove the scrollbar on mobile (¶15) | CSS on `html` in `index.css`, under a mobile media query | XS |
| 14 | Cookie banner, "legally needs to have" per Dimitri (¶15–17) | **Done 2026-09-30:** `CookieBanner.jsx`, consent-first | S–M |
| 15 | Analytics: "how many clicks, how many people click this or that", viewed in the back end (¶17–18) | **Done 2026-09-30:** cookie-free counts, admin "Site traffic" page. Google Analytics deferred | M |
| 16 | On submission, email a summary to the provider **and** to Hyacinth so they can schedule (¶29) | Notification email on submit | M, see risk below |
| 17 | Client portal with reminders ("check your portal") fed from the EMR (¶43–45), agreed "let's do it" | Extends `/account`; depends on the EMR | L, later |

Kept as is: **"the colours look really good"** (¶25). Dimitri's overall view: good, needs to feel
more modern.

---

## 2. The intake form in detail

**What he described:**

- Enter from a "Start here" card, then answer one question at a time: "I want to lose 50 pounds",
  Next, then "what are you interested in: pills, injections, what do you recommend?"
- Follow-up questions branch on the answers.
- It should feel light ("doesn't make you feel like you're doing a lot of work"), nothing like a
  "1980s or 1990s form".
- Locked in: fill it out or leave.

**What changes from today.** The current form is one long page of 9 fieldsets. Under the new model:

| Current section | New treatment |
|---|---|
| Personal information | Split into single screens (name, DOB, contact), placed after the goal questions so the flow opens with the patient's goal, not admin |
| Height & weight | Early screens: current weight, goal weight, height. Show BMI / "pounds to goal" live |
| Medical history | One condition group per screen; branch follow-ups only on "yes" |
| Family history | One screen, multi-select |
| Lifestyle & nutrition | 3–4 short screens (diet, activity, sleep); these feed the dietitian and exercise plans |
| **Insurance information** | **Removed (cash only)** |
| Emergency contact | Keep, late in the flow (confirm he still wants it) |
| Appointment details | Keep, near the end |
| Consent & signature | Last screen, after a review of answers |

**Compliance flag: the "pills or injections" question.** Asking which medication form someone
wants, early in a flow that ends at a price, is the "pay money, receive medication" pattern the
client himself calls illegal (`CLAUDE.md`). Suggested wording keeps it as a preference the provider
weighs: *"Have you used, or are you interested in, weight loss medication? A provider decides
whether it's appropriate."* with options "Yes, I'd like to discuss it" / "Not sure" / "No, lifestyle
program only". No product names, no pens (he agreed on that), no price on the same screen.

**Build notes.**

- Keep a single `<form>` and hide inactive screens, so `buildIntakeRecord()` and its EMR-shaped
  grouping keep working, minus `insurance`.
- One question per screen with big tap targets, Back always available, a progress bar, Enter to
  advance, focus moved to each new question for screen readers.
- "Locked in" still needs a link to the Privacy Policy and a help phone number. Removing every exit
  is fine for conversion but not for a health form.
- The Hims look worth copying: full-bleed, lots of white space, one large serif question, answer
  cards instead of radio buttons.

---

## 3. Pages and navigation

**Today** (`MobileMenu.jsx`): "Weight Loss Programs" → `/#programs`, "Membership Pricing" →
`/#pricing`, and all three service tiles (Nutrition Coaching, Exercise Plans, Medical Support) →
`/#programs`. That is exactly the complaint in ¶10: "they're all just homepage links."

**New sitemap:**

```
/                      Home: hero (one-liner), services overview, science, provider, CTA
/services/exercise     Exercise plan ("physical therapy" in the meeting means this; confirmed)
/services/nutrition    Nutrition coaching = dietitian services, one page (confirmed)
/services/medical      Medical care (medication only when clinically appropriate)
/services/health-checks  Ongoing health checks (4th card in ProgramGrid; not named in the meeting)
/pricing               Membership pricing (moved off Home)
/success-stories       Success stories
/how-it-works          Video + how-to (when the client sends it)
/about                 About our provider
/faq, /contact, /intake, /account   unchanged routes
```

Each service page: what we do, what you get, how it fits the other pillars, then pricing at the
bottom (¶24), then "Start your intake". Build one template driven by per-service data.

**Sidebar:** add the "Ready to lose weight? Start here" card at the top, then link every service,
Pricing, Success Stories, How it works. The card wants a face. The site still has no real photo of
the provider (`CLAUDE.md`: do not fabricate one), so this needs a real, licensed image or an
illustration until one arrives.

---

## 4. Copy changes

**Hero one-liner** (`Hero.jsx:54`, currently "Real results. / Lasting confidence."). He pointed to a
Hims line along the lines of "the care you always deserve" and asked for something similar and
catchy. Options:

- "Real care for real weight loss."
- "The weight loss care you deserve."
- "Physician-led weight loss, built around you."
- "Care that stays with you."

No "breakthrough" or results promises (`CLAUDE.md`).

**About our provider** (¶21–23). Replace the named "Dr. Antonious's story" framing with "About our
provider". Points he gave:

- Board certified in internal medicine.
- Fed up with insurance companies and approval processes getting between patients and the
  medications and support they need. That is why the program is cash only.
- Evidence-based, quality care.
- You deal with **one provider**, so you get continuity of care.

**Decided (2026-09-29): his name comes off the About page entirely**, replaced with "our provider".
The full rewrite comes later. When it is done:

- Remove the name from the visible copy *and* from `About.jsx`'s meta description and JSON-LD, the
  `TeamSection.jsx` card, and the Hero quick link "Read Dr. Antonious's story" (`Hero.jsx:23`).
- Known trade-off: an unnamed provider is a weaker trust signal (E-E-A-T) on a medical site. The
  credentials still carry weight, so keep them.
- Still open: `CLAUDE.md` says he is **double** board certified (Internal Medicine and Nephrology);
  he only mentioned internal medicine. Include nephrology?
- "Fed up with insurance" is fine in spirit; phrase it positively ("no insurance approvals standing
  between you and your care").

---

## 5. Back office, EMR, and data flow

This half of the meeting went back and forth. Final position:

1. **Custom EMR in the admin: dropped.** He asked for patient profiles, consultation and progress
   notes (HPI, plan, prescriptions), a calendar tab, a to-do tab with prescription-renewal alerts,
   dietitian and exercise notes, and telemedicine. When asked whether it could be HIPAA compliant,
   Glenn recommended buying a turnkey EMR with an API, and he agreed: "we'll just leave this alone
   and I'll keep looking for an EMR" (¶40).
2. **EMR choice: Elation**, likely but not final (pricing still being negotiated, ¶27). Update the
   `CLAUDE.md` blocker from "not selected" to "Elation, pending pricing".
3. **Site role: intake only.** Hyacinth logs into the EMR and loads each new patient's intake data
   before the first call (¶41). A CRM can stage data not yet in the EMR (¶42).
4. **Client portal: agreed** (¶43–45). It shows progress pulled from the EMR and emails reminders
   ("update from Dr. Dan, check your client portal"), with no PHI in the email itself.

**Risks to raise:**

- **Submission emails (request 16).** Emailing a "summarized" intake to the provider and Hyacinth
  sends PHI over email. Ordinary email is not HIPAA compliant. Send a notification only ("New
  applicant, log in to view") that links to a system covered by a BAA. The same applies to the CRM
  staging idea: the CRM must sign a BAA.
- **"SOC 2 compliance to make it HIPAA compliant" (¶45) is not accurate.** SOC 2 is a security
  audit framework; HIPAA compliance for a vendor means safeguards plus a signed Business Associate
  Agreement. Worth correcting before it is promised to the client.
- **Firestore today.** `src/lib/intakeSubmission.js` writes intake records to Firebase. That needs a
  Google Cloud BAA and a HIPAA-eligible configuration before real patient data goes in
  (`CLAUDE.md` blocker 1).

---

## 6. How this changes `docs/website-feedback-plan.md`

| Earlier plan | After the meeting |
|---|---|
| Multi-step form with 5 grouped steps | **One question per screen with branching** (Hims model) |
| Insurance kept in the Logistics step | **Insurance removed entirely** (cash only) |
| Hover: "maybe", recommended keeping colour changes | **Remove the motion ("shake")**; colour changes on buttons can stay |
| Slogans: several headline options | Specifically **one line replacing "Real results. Lasting confidence."** |
| Pricing stays on Home | **Pricing moves to its own page** and the bottom of each service page |
| Analytics: privacy-friendly page views | He wants **click counts viewable in the admin back end** |
| No success stories until real, consented ones exist | Still true, and it is now **its own page in the sidebar** |
| Not in the plan | Sidebar "Start here" card, About → "our provider", how-it-works video page, submission emails, client portal |
| "Action buttons primary CTA colour" | **Not in the transcript**; keep it from the notes |

---

## 7. Open questions for the client

- [x] Is "HIMSS" hims.com? **Yes.**
- [ ] Screenshots or a screen recording of the Hims weight-loss flow (site blocks automated access).
- [x] "Physical therapy" vs "exercise plan"? **The exercise plan.**
- [x] Nutrition coaching and dietitian services? **Same service, one page.**
- [x] Ongoing health checks (4th card): does it get a page, or fold into medical care? **It is the
      "Follow-ups" program. The four programs are Medical care, Dietitian services, Comprehensive
      Exercise Plan, Follow-ups (2026-09-30).**
- [ ] Emergency contact and appointment preference: still wanted in the new flow?
- [x] Face on the "Start here" card? **Client supplies the image later.**
- [x] About page? **Name removed entirely, "our provider". Rewrite later.**
- [ ] Mention nephrology in the provider credentials?
- [ ] Which email addresses receive new-applicant notifications? **Deferred; client will say.**
- [ ] Success stories: are there real patients with signed consent? (FTC typical-results rules apply
      to weight loss testimonials.)
- [ ] When will the video and how-to arrive?
- [ ] Elation: when is it confirmed, and does its API support creating patients from intake?

## 8. Suggested order

1. Quick wins (one pass, under a day): hero one-liner, remove insurance section, remove hover
   motion, mobile scrollbar, pricing off Home.
2. The intake flow + locked-down `/intake` route. This is the piece he wants done before Dimitri's
   review (¶19).
3. Service page template + four service pages + `/pricing`, and rewire the sidebar and cards.
4. Sidebar "Start here" card, About our provider.
5. Cookie banner + click analytics in the admin.
6. Submission notifications (notification only, no PHI).
7. Blocked on client: success stories, how-it-works video, Elation integration, client portal.
