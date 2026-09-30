# Intake flow redesign: design spec

Date: 2026-09-30. Source: client meeting (`docs/meeting-analysis.md`, sections 1–2) and the
approved design discussion. Replaces the "5 grouped steps" idea in
`docs/website-feedback-plan.md` section 4.

## Goal

Turn `/intake` from one long page of fieldsets into a Hims-style flow: **one question per screen**,
later questions depending on earlier answers, light and modern, and **locked in** (the patient
either finishes or closes the tab).

**Success looks like:**

- A patient goes from the first question to the signature without seeing the site header, footer, or nav.
- The submitted record has the same EMR-shaped groups as today (`buildIntakeRecord()`), so
  `firestore.rules`, the admin, and the future Elation mapping keep working unchanged.

## Constraints

- **Compliance (CLAUDE.md):** nothing reads as "pay money, receive medication." No product names,
  pens, or prices in the flow. The medication question is a preference the provider weighs.
- **Cash only:** no insurance questions.
- **PHI:** answers are **not** saved to `localStorage` or `sessionStorage`. A reload loses progress,
  and a `beforeunload` prompt warns first.
- **Record shape:** `firestore.rules` `isWellFormedIntake()` allows only the existing top-level keys.
  New fields go **inside** existing groups, so no rules change or redeploy is needed.
- No new dependencies. Native constraint validation does the checking (the custom `Select` and
  `DatePicker` already wrap real inputs).
- Copy has no em dashes. The canonical CTA label is unchanged elsewhere on the site.

## Architecture

### One form, many screens

- A single `<form>` stays mounted. Every screen is rendered as its own `<fieldset>`; only the
  current one is visible.
- Screens that a branch skips render as `<fieldset disabled>`. Disabled controls are excluded from
  both constraint validation and `FormData`, so a hidden required field can never block submit, and
  skipped answers never reach the record.
- `buildIntakeRecord(form)` stays the single source of the record. Its only change: the new
  `medicalHistory.medicationInterest` field.

### Screen definitions (data, not markup)

A new file, `src/components/intakeScreens.jsx`, exports an ordered array. Each screen:

```js
{
  id: "medications",            // stable, used for focus + review "Edit" links
  section: "Health",            // progress bar + review grouping
  question: "Do you take any medications right now?",
  hint: "Include supplements.", // optional
  kind: "choice" | "multi" | "fields",
  showIf: (answers) => boolean, // optional; omitted = always shown
  render: (answers) => JSX,     // the inputs, using existing names
}
```

- `choice`: one answer from large tap cards (radio inputs underneath). Picking one advances
  automatically.
- `multi`: checkbox cards plus Continue. "None of the above" clears the others and vice versa.
- `fields`: one or more inputs plus Continue.

### State

- `answers`: a plain object mirrored from the form on every `input`/`change` event
  (`Object.fromEntries` over `FormData`, with multi-selects via `getAll`). It is used **only** for
  `showIf`, the live BMI and pounds-to-goal readouts, and the review screen. The form remains the
  source of truth for submission.
- `index`: the position within the list of **visible** screens (recomputed from `answers`).
- `status`: `idle | sending | sent | error`, unchanged from today.

### Navigation

- **Continue / auto-advance:** `fieldset.reportValidity()` on the current screen only. It advances
  only if valid.
- **Back:** always available except on the first screen. It never validates.
- **Enter** advances on `fields` screens (native submit is intercepted until the last screen).
- On every change of screen, focus moves to the new question heading (`tabIndex={-1}`) and the page
  scrolls to top.
- If an earlier answer hides a later screen, that screen's answers drop out automatically (its
  fieldset becomes disabled).

## The flow (22 screens)

| # | Section | Screen | Kind | Fields (existing names unless marked new) | Branch |
|---|---|---|---|---|---|
| 1 | Your goal | Where are you now, and where do you want to be? | fields | `currentWeight` (req), `goalWeight` | shows "X lbs to goal" live |
| 2 | Your goal | How tall are you? | fields | `heightFeet`, `heightInches` (req) | shows BMI live |
| 3 | Your goal | Highest adult weight | fields | `highestWeight` | optional, skippable |
| 4 | Your goal | Weight loss medication | choice | **new** `medicationInterest` | see wording below |
| 5 | Health | Do you have any of these conditions? | multi | `conditions` | |
| 6 | Health | Do you take any medications? | choice | gate `hasMedications` (not in record) | |
| 7 | Health | List your medications and doses | fields | `medications` | if 6 = yes |
| 8 | Health | Any allergies? | choice | gate `hasAllergies` | |
| 9 | Health | List your allergies | fields | `allergies` | if 8 = yes |
| 10 | Health | Any previous surgeries? | choice + fields | gate `hasSurgeries`, then `surgeries` | detail if yes |
| 11 | Health | Tried weight loss treatment before? | choice + fields | gate `hasPriorTreatment`, then `priorWeightLossTreatment` | detail if yes |
| 12 | Health | Family history | multi + fields | `familyHistory`, `familyHistoryNotes` | notes if any besides "None" |
| 13 | Lifestyle | Tobacco use | choice | `tobacco` | |
| 14 | Lifestyle | Alcohol | choice | `alcohol` | |
| 15 | Lifestyle | Water | choice | `waterIntake` | |
| 16 | Lifestyle | Exercise | choice | `exerciseFrequency` | |
| 17 | Lifestyle | How you eat | fields | `mealsPerDay`, `dailyCalories`, `dietNotes` | all optional |
| 18 | About you | Your name, date of birth, and sex at birth | fields | `firstName`, `lastName`, `dob`, `sexAssigned` | |
| 19 | About you | How can we reach you? | fields | `phone`, `email`, `address`, `city`, `state`, `zip` | |
| 20 | Visit | Emergency contact | fields | `emergencyName`, `emergencyRelationship`, `emergencyPhone` | kept until client says otherwise |
| 21 | Visit | Your visit | fields | `plan` (preselected from `?plan=`), `appointmentType`, `preferredDate`, `preferredTime`, `notes` | |
| 22 | Finish | Review and sign | fields | review summary, `consentTelehealth`, `consentHipaa`, `signature`, `signatureDate` | submit |

Rows 10–12 are a single screen each: the choice sits on top and the detail textarea appears
beneath it when needed, so a "yes" does not cost an extra screen. Gate fields (`has*`) are not read
by `buildIntakeRecord()`; an empty detail string means "none."

Existing validation (email `pattern`, ZIP `pattern`, numeric `min`/`max`, `required`) carries over
as is.

### Reason for visit uses the four program names

Per Dr. Antonious (2026-09-30), the four programs are **Medical care, Dietician services,
Comprehensive Exercise Plan, Follow-ups**. On screen 21, `APPOINTMENT_TYPES` is replaced with
exactly those four plus "Not sure yet", asked as "What would you like to focus on first?". It stays
a single choice, so `visit.reason` remains a string and the admin's rendering of it is unaffected.
Renaming the programs elsewhere on the site (ProgramGrid, menu tiles, service pages) is a separate
change, not part of this spec.

### Medication screen wording (approved)

> **Have you used, or are you interested in, weight loss medication?**
> A provider decides whether it's appropriate for you.
>
> ○ Yes, I'd like to discuss it ○ Not sure ○ No, lifestyle program only

Stored as `medicalHistory.medicationInterest` with values `discuss` / `unsure` / `no`. No product
names, no forms (pills or injections), and no price anywhere in the flow.

### Review screen

It lists answers grouped by section, each group with an "Edit" link that jumps to that section's
first screen. After editing, Continue returns forward through the flow normally. Consent and the
signature sit under the summary, so nothing is signed unseen.

## Locked shell

- In `App.jsx`, `/intake` renders **outside** `Header`/`Footer`, the same way `/admin` already does.
  `ScrollManager` still runs.
- Top bar: the Corephia logo (an image, **not** a link), a progress bar with the section name
  ("Health"), and a help line showing the phone number (still the TODO placeholder from `Contact.jsx`,
  reused, not duplicated).
- No nav, no "Back to home", no outbound links in the flow. A Privacy Policy link will open in a new
  tab once that page exists (it does not yet; no dead link is added).
- `beforeunload` prompt once any answer exists, removed after a successful submit.
- The confirmation screen keeps "Back to home", since the patient is done.
- The "not for medical emergencies, call 911" line stays visible on every screen.

## Visual direction

To be done with `frontend-design` during implementation, within the existing tokens:

- Full-bleed `paper-50`, a centred column (about `max-w-xl`), one large Fraunces question, and a short
  Inter hint.
- Answer cards: large rounded tap targets (at least 56px tall), a clear selected state
  (`accent-dark` border plus a check), and a visible keyboard focus ring.
- A thin progress bar in `accent-dark`. Continue is a full-width pill on mobile.
- A short slide between screens, off under `prefers-reduced-motion`.

## Error handling

- Submit failure: the existing error alert and behaviour stay (answers stay in place, and the patient
  is never shown the confirmation on failure). It is shown on the review screen.
- `sending` disables the submit button, as today.
- An invalid screen: native `reportValidity()` bubbles appear on the first invalid field, with focus
  on it.

## Out of scope

- Saving progress across reloads (PHI in the browser; revisit only if the team accepts that).
- Submission notification emails, the Elation integration, and analytics funnel events (separate
  items in the meeting plan).
- Service pages and the `?service=` param.

## Testing

No test suite exists. Verification is in a real browser with Playwright against the dev server:

1. The full happy path at phone and desktop widths, then submit. Assert the record shape
   (intercept the `sendIntakeRecord` import, or read the payload) matches today's groups plus
   `medicationInterest`.
2. Branching: "No" on the medications gate means the `medications` screen is skipped and `""` is in
   the record. "Yes" means it is shown and required.
3. The disabled-fieldset guarantee: after a branch is flipped back to "No", the previously typed
   detail is **not** in the record.
4. Validation: Continue on an empty required screen stays put and focuses the field.
5. Focus moves to each new question heading. Back works. Enter advances.
6. The shell: no header or footer links on `/intake`. The `beforeunload` prompt fires after one
   answer.
7. `?plan=Core+` preselects the plan on screen 21.
8. `npm run lint` and `npm run build` are clean.
