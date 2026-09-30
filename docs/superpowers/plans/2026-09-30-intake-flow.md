# Intake Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long `/intake` page with a locked, one-question-per-screen branching flow that
produces the same EMR-shaped record as today plus `medicalHistory.medicationInterest`.

**Architecture:** One uncontrolled `<form>` holds every screen as its own `<fieldset>`; only the
current one is shown, and screens skipped by a branch are `disabled` so the browser drops them from
validation and `FormData`. Screen definitions are data in `intakeScreens.jsx`; the engine in
`PatientIntakeForm.jsx` mirrors answers into state only to decide visibility, live readouts, and the
review screen. `App.jsx` renders `/intake` outside the site's `Header`/`Footer`.

**Tech Stack:** React 19, react-router-dom v7, Tailwind CSS v4, Vite 8. Browser checks use
Playwright from the session scratchpad (the project has no test suite and no Playwright dependency).

**Spec:** `docs/superpowers/specs/2026-09-30-intake-flow-design.md`

## Global Constraints

- No new dependencies in `package.json`.
- No `localStorage` / `sessionStorage` for answers (PHI).
- Top-level record keys stay exactly: `submittedAt, demographics, emergencyContact, vitals, medicalHistory, familyHistory, socialHistory, nutrition, visit, consent` (`firestore.rules` `isWellFormedIntake()` allows only these plus the legacy `insurance`).
- Medication wording, verbatim: "Have you used, or are you interested in, weight loss medication?" / "A provider decides whether it's appropriate for you." / options "Yes, I'd like to discuss it", "Not sure", "No, lifestyle program only" stored as `discuss` / `unsure` / `no`.
- Reason-for-visit options, verbatim: "Medical care", "Dietician services", "Comprehensive Exercise Plan", "Follow-ups", "Not sure yet".
- No product names, pens, or prices anywhere in the flow.
- No em dashes in visitor-facing copy.
- Primary buttons stay `bg-ink-950` (the site-wide CTA colour decision is still open with the client).
- Hover effects: colour changes only, no motion (client asked to remove the "shake").
- The dev server is run by Louie; do not start, stop, or restart it. Checks target `http://localhost:5173`.
- **Do not commit** unless Louie asks. The working tree already holds uncommitted work from earlier sessions. "Checkpoint" steps below are lint runs, not commits.
- For the UI pass, load the `frontend-design` skill first (project rule in `CLAUDE.md`).

## Review Focus

1. A gate flipped from "Yes" back to "No" after typing detail: the typed detail must not reach the record. (Task 2, check `branch-drop`.)
2. Back to an already-answered choice screen: Continue must advance without re-picking. (Task 2, check `back-continue`.)
3. A double-tap on a choice card must advance exactly one screen. (Task 2, check `double-tap`.)
4. Enter in a text field on a middle screen advances and never submits. (Task 2, check `enter-advances`.)
5. Leaving mid-flow warns before the answers are lost. (Task 2, check `beforeunload`.)

---

### Task 1: Locked shell and shared support phone

**Files:**
- Create: `src/lib/siteContact.js`
- Modify: `src/App.jsx` (the `App` component body, after the `/admin` early return)
- Modify: `src/pages/Contact.jsx:22-24`
- Modify: `src/components/Footer.jsx:16`

**Interfaces:**
- Produces: `SUPPORT_PHONE` (string) exported from `src/lib/siteContact.js`, used by Task 2's top bar.
- Produces: `/intake` renders `<PatientIntakeForm />` with no `Header`, `Footer`, or `<main>` wrapper from `App.jsx`. Task 2's component supplies its own page chrome.

- [ ] **Step 1: Create the shared constant**

`src/lib/siteContact.js`:

```js
// The public contact phone, in one place so the placeholder is replaced once
// for the Contact page, the footer, and the intake's help line.
// TODO: replace the phone number with a real one before launch.
export const SUPPORT_PHONE = "(000) 123-4567"
```

- [ ] **Step 2: Point Contact and Footer at it**

In `src/pages/Contact.jsx`, add `import { SUPPORT_PHONE } from "../lib/siteContact"` with the other imports, delete the line `// TODO: replace the phone number with a real one before launch.`, and change

```js
  { icon: PhoneIcon, label: "Phone", value: "(000) 123-4567" },
```

to

```js
  { icon: PhoneIcon, label: "Phone", value: SUPPORT_PHONE },
```

In `src/components/Footer.jsx`, add `import { SUPPORT_PHONE } from "../lib/siteContact"` and change

```js
  { icon: PhoneIcon, text: "(000) 123-4567" },
```

to

```js
  { icon: PhoneIcon, text: SUPPORT_PHONE },
```

- [ ] **Step 3: Render `/intake` outside the site shell**

In `src/App.jsx`, directly after the `if (pathname.startsWith("/admin")) { ... }` block, add:

```jsx
  // The intake is locked in (client meeting, docs/meeting-analysis.md): no
  // header, footer or nav, so the only ways out are finishing it or closing
  // the tab. PatientIntakeForm draws its own minimal top bar.
  if (pathname.replace(/\/$/, "") === "/intake") {
    return (
      <>
        <ScrollManager />
        <PatientIntakeForm />
      </>
    )
  }
```

Leave the existing `<Route path="/intake" ... />` line in place. It is now unreachable but harmless, and deleting it is not needed for this change.

- [ ] **Step 4: Verify in the browser**

With Playwright (MCP browser tools or a scratchpad script) at 390×844:
- `http://localhost:5173/intake`: `document.querySelectorAll("footer").length === 0`, and there is no `button[aria-label="Open menu"]`.
- `http://localhost:5173/contact`: the page text contains `(000) 123-4567`, and so does the footer.

- [ ] **Step 5: Checkpoint**

Run: `npm run lint`
Expected: no new warnings (the four existing ones are in `PageHeader.jsx`, `Hero.jsx`, and `Footer.jsx`, and are unrelated).

---

### Task 2: The flow engine and screens

**Files:**
- Create: `src/components/intakeScreens.jsx`
- Rewrite: `src/components/PatientIntakeForm.jsx`
- Modify: `src/index.css` (rename the menu slide classes so both surfaces share them)
- Modify: `src/components/MobileMenu.jsx` (the `slideClass` line)
- Test: `<scratchpad>/intake-check.mjs`

**Interfaces:**
- Consumes: `SUPPORT_PHONE` from `src/lib/siteContact.js` (Task 1).
- Produces, from `intakeScreens.jsx`: `SCREENS` (array of `{ id, section, question, hint?, autoAdvance?, showIf?(answers), render(ctx) }`, where `ctx = { answers, goTo(id), selectedPlan, today }`) and `PLANS` (string array).
- Produces, CSS: `.animate-view-forward`, `.animate-view-back` (renamed from `.animate-menu-*`).
- DOM contract the check script relies on: each screen is `fieldset[data-screen="<id>"]`, the current one has no `hidden` attribute, its heading is `h2#q-<id>`, the primary button is named "Continue" (or "Submit intake form" on the last screen), and the secondary one is "Back".

- [ ] **Step 1: Set up Playwright in the scratchpad**

Run (Git Bash), from the session scratchpad directory:

```bash
npm i playwright && npx playwright install chromium
```

Expected: installs without errors.

- [ ] **Step 2: Write the check script (it will fail against today's form)**

`<scratchpad>/intake-check.mjs`:

```js
import assert from "node:assert/strict"
import { chromium } from "playwright"

const BASE = process.env.BASE ?? "http://localhost:5173"

// Swap the Firestore writer for a stub that parks the record on window, so the
// check can assert its exact shape without touching the real database.
const STUB = `export const isConfigured = true
export async function sendIntakeRecord(record) { window.__record = record; return { id: "check" } }`

const browser = await chromium.launch()
const results = []

async function fresh(path = "/intake", viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.route(/\/src\/lib\/intakeSubmission\.js/, (route) =>
    route.fulfill({ contentType: "text/javascript", body: STUB }),
  )
  await page.goto(BASE + path)
  return page
}

const current = (page) => page.locator("fieldset[data-screen]:not([hidden])")
const currentId = (page) => current(page).getAttribute("data-screen")
const atScreen = (page, id) => page.waitForSelector(`fieldset[data-screen="${id}"]:not([hidden])`)
const next = (page) => page.getByRole("button", { name: "Continue" }).click()
const pick = (page, name, value, options) =>
  current(page).locator(`label:has(input[name="${name}"][value="${value}"])`).click(options)
const fill = (page, name, value) => current(page).locator(`[name="${name}"]`).fill(value)

async function pickSelect(page, name, label) {
  const root = current(page).locator(`div.relative:has(> select[name="${name}"])`)
  await root.locator('button[aria-haspopup="listbox"]').click()
  await root.getByRole("option", { name: label }).locator("button").click()
}

async function pickDate(page, name, { nextMonth = false } = {}) {
  const root = current(page).locator(`div.relative:has(> input[name="${name}"])`)
  await root.locator('button[aria-haspopup="dialog"]').click()
  if (nextMonth) await root.getByRole("button", { name: "Next" }).click()
  await root.locator(".grid-cols-7 button:not([disabled])", { hasText: /^15$/ }).first().click()
}

async function check(name, fn) {
  try {
    await fn()
    results.push(`PASS ${name}`)
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message.split("\n")[0]}`)
  }
}

await check("shell", async () => {
  const page = await fresh()
  assert.equal(await page.locator("footer").count(), 0, "footer rendered")
  assert.equal(await page.locator('button[aria-label="Open menu"]').count(), 0, "site menu rendered")
  const exits = await page.locator('a[href]:not([href^="tel:"])').count()
  assert.equal(exits, 0, `${exits} outbound links on /intake`)
  await page.context().close()
})

await check("beforeunload", async () => {
  const page = await fresh()
  // Chromium shows the prompt only after a real user gesture, so click first.
  await current(page).locator('[name="currentWeight"]').click()
  await fill(page, "currentWeight", "220")
  let dialogType = null
  page.once("dialog", async (dialog) => {
    dialogType = dialog.type()
    await dialog.accept()
  })
  await page.close({ runBeforeUnload: true })
  await new Promise((resolve) => setTimeout(resolve, 500))
  assert.equal(dialogType, "beforeunload")
})

await check("happy path + branches", async () => {
  const page = await fresh(`/intake?plan=${encodeURIComponent("Core+")}`)

  await atScreen(page, "goal-weight")
  await fill(page, "currentWeight", "220")
  await fill(page, "goalWeight", "180")
  assert.match(await current(page).innerText(), /40 lbs to your goal/)
  await next(page)

  await atScreen(page, "height")
  assert.equal(await page.evaluate(() => document.activeElement?.id), "q-height", "focus did not move to the question")
  await fill(page, "heightFeet", "5")
  await fill(page, "heightInches", "10")
  assert.match(await current(page).innerText(), /BMI 31\.6/)
  await next(page)

  await atScreen(page, "highest-weight")
  await next(page)

  await atScreen(page, "medication-interest")
  await pick(page, "medicationInterest", "discuss")

  await atScreen(page, "conditions")
  await pick(page, "conditions", "High blood pressure")
  await pick(page, "conditions", "None of the above")
  assert.equal(await current(page).locator('input[value="High blood pressure"]').isChecked(), false, "None did not clear others")
  await next(page)

  // branch-drop: type a medication, go back, answer No. The detail must vanish.
  await atScreen(page, "has-medications")
  await pick(page, "hasMedications", "yes")
  await atScreen(page, "medications")
  await fill(page, "medications", "Metformin 500mg")
  await page.getByRole("button", { name: "Back" }).click()
  await atScreen(page, "has-medications")
  await pick(page, "hasMedications", "no")

  // back-continue: an answered choice screen advances on Continue alone.
  await atScreen(page, "has-allergies")
  await pick(page, "hasAllergies", "no")
  await atScreen(page, "surgeries")
  await page.getByRole("button", { name: "Back" }).click()
  await atScreen(page, "has-allergies")
  await next(page)
  await atScreen(page, "surgeries")

  await pick(page, "hasSurgeries", "no")
  await next(page)

  await atScreen(page, "prior-treatment")
  await pick(page, "hasPriorTreatment", "yes")
  await fill(page, "priorWeightLossTreatment", "Tried keto")
  await next(page)

  await atScreen(page, "family-history")
  await pick(page, "familyHistory", "Diabetes")
  await fill(page, "familyHistoryNotes", "Mother, age 50")
  await next(page)

  // double-tap: two quick clicks on one card move exactly one screen.
  await atScreen(page, "tobacco")
  await pick(page, "tobacco", "Never used tobacco", { clickCount: 2 })
  await atScreen(page, "alcohol")
  await new Promise((resolve) => setTimeout(resolve, 600))
  assert.equal(await currentId(page), "alcohol", "double-tap skipped a screen")

  await pick(page, "alcohol", "None")
  await atScreen(page, "water")
  await pick(page, "waterIntake", "5-7 glasses a day")
  await atScreen(page, "exercise")
  await pick(page, "exerciseFrequency", "1-2 days per week")

  await atScreen(page, "eating")
  await next(page)

  // validation: Continue on an empty required screen stays put and focuses the field.
  await atScreen(page, "about-you")
  await next(page)
  assert.equal(await currentId(page), "about-you", "advanced past empty required fields")
  assert.equal(await page.evaluate(() => document.activeElement?.name), "firstName")
  await fill(page, "firstName", "Pat")
  await fill(page, "lastName", "Example")
  await pickDate(page, "dob")
  await pickSelect(page, "sexAssigned", "Female")

  // enter-advances: Enter in a text field moves on and does not submit.
  await current(page).locator('[name="lastName"]').press("Enter")
  await atScreen(page, "contact")
  assert.equal(await page.evaluate(() => window.__record ?? null), null, "Enter submitted the form")

  await fill(page, "phone", "8135550100")
  await fill(page, "email", "pat@example.com")
  await fill(page, "address", "1 Main St")
  await fill(page, "city", "Tampa")
  await pickSelect(page, "state", "FL")
  await fill(page, "zip", "33602")
  await next(page)

  await atScreen(page, "emergency")
  await fill(page, "emergencyName", "Sam Example")
  await fill(page, "emergencyRelationship", "Sibling")
  await fill(page, "emergencyPhone", "8135550101")
  await next(page)

  await atScreen(page, "visit")
  assert.equal(await page.locator('select[name="plan"]').inputValue(), "Core+", "?plan= not preselected")
  await pick(page, "appointmentType", "Dietician services")
  await pickSelect(page, "preferredTime", "Morning (8am - 12pm)")
  await pickDate(page, "preferredDate", { nextMonth: true })
  await next(page)

  await atScreen(page, "review")
  const review = await current(page).innerText()
  assert.doesNotMatch(review, /Metformin/, "dropped medication shown on review")
  await current(page).locator('[name="consentTelehealth"]').check()
  await current(page).locator('[name="consentHipaa"]').check()
  await fill(page, "signature", "Pat Example")
  await page.getByRole("button", { name: "Submit intake form" }).click()

  await page.waitForFunction(() => window.__record)
  const record = await page.evaluate(() => window.__record)
  assert.deepEqual(Object.keys(record), [
    "submittedAt", "demographics", "emergencyContact", "vitals", "medicalHistory",
    "familyHistory", "socialHistory", "nutrition", "visit", "consent",
  ])
  assert.equal(record.medicalHistory.medicationInterest, "discuss")
  assert.equal(record.medicalHistory.medications, "", "branch-drop: medication detail leaked")
  assert.deepEqual(record.medicalHistory.conditions, ["None of the above"])
  assert.equal(record.medicalHistory.surgeries, "")
  assert.equal(record.medicalHistory.priorWeightLossTreatment, "Tried keto")
  assert.deepEqual(record.familyHistory.conditions, ["Diabetes"])
  assert.equal(record.vitals.currentWeightLb, "220")
  assert.equal(record.demographics.address.state, "FL")
  assert.equal(record.visit.membershipPlan, "Core+")
  assert.equal(record.visit.reason, "Dietician services")
  assert.equal(record.consent.telehealth, true)
  assert.equal(record.consent.signature, "Pat Example")
  await page.getByRole("heading", { name: "Request received" }).waitFor()
  await page.context().close()
})

await browser.close()
console.log(results.join("\n"))
process.exitCode = results.some((line) => line.startsWith("FAIL")) ? 1 : 0
```

- [ ] **Step 3: Run it to confirm it fails**

Run (from the scratchpad): `node intake-check.mjs`
Expected: `PASS shell` (Task 1 is done), `FAIL beforeunload`, and `FAIL happy path + branches` (`fieldset[data-screen="goal-weight"]` never appears).

- [ ] **Step 4: Rename the shared slide classes**

In `src/index.css`, in the block added for the menu drill-down, rename `.animate-menu-forward` to `.animate-view-forward` and `.animate-menu-back` to `.animate-view-back` (the rules and the reduced-motion selector list). Change the comment above `@keyframes menu-view-in` to:

```css
/* View changes (MobileMenu.jsx drill-down, PatientIntakeForm.jsx screens): the
   incoming view slides in from the side it came from, so forward and back
   read as moving through a stack. */
```

In `src/components/MobileMenu.jsx`, change the `slideClass` line to:

```js
  const slideClass = view.dir === "forward" ? "animate-view-forward" : view.dir === "back" ? "animate-view-back" : ""
```

- [ ] **Step 5: Write the screen definitions**

`src/components/intakeScreens.jsx`:

```jsx
import { Fragment } from "react"
import DatePicker from "./DatePicker"
import { CheckCircleIcon } from "./icons"
import Select from "./Select"

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]

export const PLANS = ["Core", "Core+", "Core Complete"]

// The four programs, in Dr. Antonious's words (CLAUDE.md, 2026-09-30).
const FOCUS_OPTIONS = ["Medical care", "Dietician services", "Comprehensive Exercise Plan", "Follow-ups", "Not sure yet"]

const PREFERRED_TIMES = ["Morning (8am - 12pm)", "Afternoon (12pm - 4pm)", "Evening (4pm - 7pm)"]

const CONDITIONS = [
  "Diabetes or prediabetes",
  "High blood pressure",
  "High cholesterol",
  "Heart disease",
  "Cancer (current or past)",
  "Thyroid disorder",
  "Kidney disease",
  "Fatty liver disease",
  "PCOS",
  "Sleep apnea",
  "Anxiety or depression",
  "None of the above",
]

const FAMILY_HISTORY = [
  "Cancer",
  "Diabetes",
  "Heart disease",
  "High blood pressure",
  "Stroke",
  "Thyroid disorder",
  "Obesity",
  "None of the above",
]

const TOBACCO_STATUS = [
  "Never used tobacco",
  "Former smoker",
  "Current smoker",
  "Vape / e-cigarettes only",
  "Other tobacco use",
]

const ALCOHOL_USE = [
  "None",
  "Occasionally (1-2 drinks per week)",
  "Moderately (3-7 drinks per week)",
  "Frequently (8 or more drinks per week)",
]

const WATER_INTAKE = ["Less than 2 glasses a day", "2-4 glasses a day", "5-7 glasses a day", "8 or more glasses a day"]

const EXERCISE_FREQUENCY = ["None right now", "1-2 days per week", "3-4 days per week", "5 or more days per week"]

// Approved wording (spec, "Medication screen wording"). A preference the
// provider weighs, never a product choice: no names, forms, or prices.
const MEDICATION_INTEREST = [
  { value: "discuss", label: "Yes, I'd like to discuss it" },
  { value: "unsure", label: "Not sure" },
  { value: "no", label: "No, lifestyle program only" },
]

const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "intersex", label: "Intersex" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
]

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
]

const NONE = "None of the above"

const inputClass =
  "w-full rounded-2xl border border-ink-950/15 bg-paper-50 px-4 py-3.5 text-ink-950 placeholder-ink-950/40 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

const labelClass = "mb-1.5 block text-sm font-medium text-ink-950/80"

function Field({ label, required, children }) {
  return (
    <label className="flex h-full flex-col justify-end">
      <span className={labelClass}>
        {label} {required && <span className="text-brand-dark">*</span>}
      </span>
      {children}
    </label>
  )
}

const toOption = (option) => (typeof option === "string" ? { value: option, label: option } : option)
const labelFor = (options, value) => options.map(toOption).find((option) => option.value === value)?.label ?? ""

// Big tap targets over real radio/checkbox inputs. The input covers the whole
// card (invisible, not sr-only) so a native "please pick one" bubble anchors
// to the card, and has-checked / has-focus-visible style the card from it.
function OptionCards({ type, name, options, required, columns = 1 }) {
  return (
    <div className={`grid gap-3 ${columns === 2 ? "grid-cols-2" : ""}`}>
      {options.map(toOption).map(({ value, label }) => (
        <label
          key={value}
          className="group relative flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-ink-950/15 bg-paper-50 px-5 py-4 text-base font-medium text-ink-950 transition-colors duration-200 ease-out-smooth hover:border-ink-950/40 has-checked:border-accent-dark has-checked:bg-paper-100 has-focus-visible:ring-2 has-focus-visible:ring-accent-dark has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-paper-50"
        >
          <input
            type={type}
            name={name}
            value={value}
            required={required}
            className="absolute inset-0 size-full cursor-pointer appearance-none rounded-2xl outline-none"
          />
          <span>{label}</span>
          <CheckCircleIcon className="size-5 shrink-0 text-accent-dark opacity-0 transition-opacity duration-200 group-has-checked:opacity-100" />
        </label>
      ))}
    </div>
  )
}

const ChoiceCards = (props) => <OptionCards type="radio" required {...props} />
const CheckCards = (props) => <OptionCards type="checkbox" required={false} {...props} />

const lbs = (value) => (value ? `${value} lbs` : "")
const joined = (values) => (values?.length ? values.join(", ") : "")
const detail = (gate, text) => (gate === "no" ? "None" : text)

function GoalReadout({ answers }) {
  const toGo = Number(answers.currentWeight) - Number(answers.goalWeight)
  return (
    <p aria-live="polite" className="min-h-6 text-ink-950/70">
      {answers.goalWeight && toGo > 0 ? `That's ${toGo} lbs to your goal.` : ""}
    </p>
  )
}

function BmiReadout({ answers }) {
  const inches = Number(answers.heightFeet) * 12 + Number(answers.heightInches || 0)
  const weight = Number(answers.currentWeight)
  const bmi = inches > 0 && weight > 0 ? ((703 * weight) / inches ** 2).toFixed(1) : ""
  return (
    <p aria-live="polite" className="min-h-6 text-ink-950/70">
      {answers.heightFeet && bmi ? `BMI ${bmi}. Your provider reviews this with you.` : ""}
    </p>
  )
}

const REVIEW_SECTIONS = [
  {
    title: "Your goal",
    edit: "goal-weight",
    rows: (a) => [
      ["Current weight", lbs(a.currentWeight)],
      ["Goal weight", lbs(a.goalWeight)],
      ["Height", a.heightFeet ? `${a.heightFeet} ft ${a.heightInches || 0} in` : ""],
      ["Highest adult weight", lbs(a.highestWeight)],
      ["Weight loss medication", labelFor(MEDICATION_INTEREST, a.medicationInterest)],
    ],
  },
  {
    title: "Health",
    edit: "conditions",
    rows: (a) => [
      ["Conditions", joined(a.conditions)],
      ["Medications", detail(a.hasMedications, a.medications)],
      ["Allergies", detail(a.hasAllergies, a.allergies)],
      ["Surgeries", detail(a.hasSurgeries, a.surgeries)],
      ["Previous weight loss treatment", detail(a.hasPriorTreatment, a.priorWeightLossTreatment)],
      ["Family history", joined(a.familyHistory)],
      ["Family history detail", a.familyHistoryNotes],
    ],
  },
  {
    title: "Lifestyle",
    edit: "tobacco",
    rows: (a) => [
      ["Tobacco", a.tobacco],
      ["Alcohol", a.alcohol],
      ["Water", a.waterIntake],
      ["Exercise", a.exerciseFrequency],
      ["Meals per day", a.mealsPerDay],
      ["Daily calories", a.dailyCalories],
      ["How you eat", a.dietNotes],
    ],
  },
  {
    title: "About you",
    edit: "about-you",
    rows: (a) => [
      ["Name", [a.firstName, a.lastName].filter(Boolean).join(" ")],
      ["Date of birth", a.dob],
      ["Sex assigned at birth", labelFor(SEX_OPTIONS, a.sexAssigned)],
      ["Phone", a.phone],
      ["Email", a.email],
      ["Address", [a.address, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")],
    ],
  },
  {
    title: "Visit",
    edit: "emergency",
    rows: (a) => [
      ["Emergency contact", [a.emergencyName, a.emergencyRelationship && `(${a.emergencyRelationship})`, a.emergencyPhone].filter(Boolean).join(" ")],
      ["Plan", a.plan || "Not sure yet"],
      ["Focus", a.appointmentType],
      ["Preferred date", a.preferredDate],
      ["Preferred time", a.preferredTime],
      ["Notes", a.notes],
    ],
  },
]

function Review({ answers, goTo }) {
  return (
    <div className="space-y-4">
      {REVIEW_SECTIONS.map((section) => (
        <section key={section.title} className="rounded-2xl bg-paper-100 p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-serif text-lg text-ink-950">{section.title}</h3>
            <button
              type="button"
              onClick={() => goTo(section.edit)}
              className="text-sm font-semibold text-accent-dark underline-offset-4 hover:underline"
            >
              Edit<span className="sr-only"> {section.title.toLowerCase()}</span>
            </button>
          </div>
          <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
            {section.rows(answers).map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-ink-950/60">{label}</dt>
                <dd className="wrap-break-word text-ink-950">{value || "Not answered"}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

// Order is the flow order. showIf may only read answers from screens before
// it, so a screen can never hide itself or anything it depends on.
export const SCREENS = [
  {
    id: "goal-weight",
    section: "Your goal",
    question: "Where are you now, and where do you want to be?",
    hint: "Your best estimate is fine.",
    render: ({ answers }) => (
      <>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Current weight (lbs)" required>
            <input name="currentWeight" type="number" inputMode="numeric" min="50" max="1000" required className={inputClass} />
          </Field>
          <Field label="Goal weight (lbs)">
            <input name="goalWeight" type="number" inputMode="numeric" min="50" max="1000" className={inputClass} />
          </Field>
        </div>
        <GoalReadout answers={answers} />
      </>
    ),
  },
  {
    id: "height",
    section: "Your goal",
    question: "How tall are you?",
    render: ({ answers }) => (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Feet" required>
            <input name="heightFeet" type="number" inputMode="numeric" min="3" max="8" required placeholder="5" className={inputClass} />
          </Field>
          <Field label="Inches" required>
            <input name="heightInches" type="number" inputMode="numeric" min="0" max="11" required placeholder="10" className={inputClass} />
          </Field>
        </div>
        <BmiReadout answers={answers} />
      </>
    ),
  },
  {
    id: "highest-weight",
    section: "Your goal",
    question: "What's the most you've weighed as an adult?",
    hint: "Optional. It helps your provider understand your weight history.",
    render: () => (
      <Field label="Highest adult weight (lbs)">
        <input name="highestWeight" type="number" inputMode="numeric" min="50" max="1000" className={inputClass} />
      </Field>
    ),
  },
  {
    id: "medication-interest",
    section: "Your goal",
    question: "Have you used, or are you interested in, weight loss medication?",
    hint: "A provider decides whether it's appropriate for you.",
    autoAdvance: true,
    render: () => <ChoiceCards name="medicationInterest" options={MEDICATION_INTEREST} />,
  },
  {
    id: "conditions",
    section: "Health",
    question: "Do you have any of these conditions?",
    hint: "Select all that apply.",
    render: () => <CheckCards name="conditions" options={CONDITIONS} />,
  },
  {
    id: "has-medications",
    section: "Health",
    question: "Do you take any medications right now?",
    hint: "Include vitamins and supplements.",
    autoAdvance: true,
    render: () => <ChoiceCards name="hasMedications" options={YES_NO} columns={2} />,
  },
  {
    id: "medications",
    section: "Health",
    question: "Which medications do you take?",
    hint: "Include the dose if you know it.",
    showIf: (a) => a.hasMedications === "yes",
    render: () => (
      <Field label="Medications and doses" required>
        <textarea name="medications" rows={4} required className={inputClass} />
      </Field>
    ),
  },
  {
    id: "has-allergies",
    section: "Health",
    question: "Do you have any allergies?",
    hint: "Medications, foods, or anything else.",
    autoAdvance: true,
    render: () => <ChoiceCards name="hasAllergies" options={YES_NO} columns={2} />,
  },
  {
    id: "allergies",
    section: "Health",
    question: "What are you allergic to?",
    showIf: (a) => a.hasAllergies === "yes",
    render: () => (
      <Field label="Allergies" required>
        <textarea name="allergies" rows={3} required className={inputClass} />
      </Field>
    ),
  },
  {
    id: "surgeries",
    section: "Health",
    question: "Have you had any surgeries?",
    render: ({ answers }) => (
      <>
        <ChoiceCards name="hasSurgeries" options={YES_NO} columns={2} />
        {answers.hasSurgeries === "yes" && (
          <Field label="Which surgeries, and roughly when?" required>
            <textarea name="surgeries" rows={3} required className={inputClass} />
          </Field>
        )}
      </>
    ),
  },
  {
    id: "prior-treatment",
    section: "Health",
    question: "Have you tried a weight loss program, medication, or surgery before?",
    render: ({ answers }) => (
      <>
        <ChoiceCards name="hasPriorTreatment" options={YES_NO} columns={2} />
        {answers.hasPriorTreatment === "yes" && (
          <Field label="What you tried, and how it went" required>
            <textarea name="priorWeightLossTreatment" rows={3} required className={inputClass} />
          </Field>
        )}
      </>
    ),
  },
  {
    id: "family-history",
    section: "Health",
    question: "Do any of these run in your immediate family?",
    hint: "Parents, siblings, or children. Select all that apply.",
    render: ({ answers }) => (
      <>
        <CheckCards name="familyHistory" options={FAMILY_HISTORY} />
        {answers.familyHistory?.some((value) => value !== NONE) && (
          <Field label="Who was affected, and at what age, if you know">
            <textarea name="familyHistoryNotes" rows={2} className={inputClass} />
          </Field>
        )}
      </>
    ),
  },
  {
    id: "tobacco",
    section: "Lifestyle",
    question: "Do you use tobacco or nicotine?",
    autoAdvance: true,
    render: () => <ChoiceCards name="tobacco" options={TOBACCO_STATUS} />,
  },
  {
    id: "alcohol",
    section: "Lifestyle",
    question: "How much alcohol do you drink?",
    autoAdvance: true,
    render: () => <ChoiceCards name="alcohol" options={ALCOHOL_USE} />,
  },
  {
    id: "water",
    section: "Lifestyle",
    question: "How much water do you drink a day?",
    autoAdvance: true,
    render: () => <ChoiceCards name="waterIntake" options={WATER_INTAKE} />,
  },
  {
    id: "exercise",
    section: "Lifestyle",
    question: "How often do you exercise right now?",
    autoAdvance: true,
    render: () => <ChoiceCards name="exerciseFrequency" options={EXERCISE_FREQUENCY} />,
  },
  {
    id: "eating",
    section: "Lifestyle",
    question: "Tell us how you eat.",
    hint: "All optional. Your dietitian uses this to build your plan.",
    render: () => (
      <>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Meals per day">
            <input name="mealsPerDay" type="number" inputMode="numeric" min="0" max="12" className={inputClass} />
          </Field>
          <Field label="Estimated daily calories">
            <input name="dailyCalories" type="number" inputMode="numeric" min="0" max="20000" placeholder="Your best guess is fine" className={inputClass} />
          </Field>
        </div>
        <Field label="A typical day of eating">
          <textarea
            name="dietNotes"
            rows={3}
            placeholder="Snacking habits, dietary restrictions, or anything else we should know"
            className={inputClass}
          />
        </Field>
      </>
    ),
  },
  {
    id: "about-you",
    section: "About you",
    question: "A little about you.",
    render: () => (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" required>
          <input name="firstName" type="text" required autoComplete="given-name" className={inputClass} />
        </Field>
        <Field label="Last name" required>
          <input name="lastName" type="text" required autoComplete="family-name" className={inputClass} />
        </Field>
        <Field label="Date of birth" required>
          <DatePicker name="dob" required />
        </Field>
        <Field label="Sex assigned at birth" required>
          <Select name="sexAssigned" required placeholder="Select one" options={SEX_OPTIONS} />
        </Field>
      </div>
    ),
  },
  {
    id: "contact",
    section: "About you",
    question: "How can we reach you?",
    render: () => (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone number" required>
          <input name="phone" type="tel" required autoComplete="tel" className={inputClass} />
        </Field>
        <Field label="Email address" required>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            // Hyphens escaped: browsers compile `pattern` with the `v` flag,
            // where an unescaped `-` in a class is a syntax error and the whole
            // pattern silently stops validating.
            pattern="[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"
            title="Enter a full email address, like name@example.com"
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Street address" required>
            <input name="address" type="text" required autoComplete="address-line1" className={inputClass} />
          </Field>
        </div>
        <Field label="City" required>
          <input name="city" type="text" required autoComplete="address-level2" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-5">
          <Field label="State" required>
            <Select name="state" required placeholder="State" options={US_STATES} />
          </Field>
          <Field label="ZIP code" required>
            <input
              name="zip"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}(-[0-9]{4})?"
              required
              autoComplete="postal-code"
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    ),
  },
  {
    id: "emergency",
    section: "Visit",
    question: "Who should we contact in an emergency?",
    render: () => (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required>
          <input name="emergencyName" type="text" required className={inputClass} />
        </Field>
        <Field label="Relationship to you" required>
          <input name="emergencyRelationship" type="text" required className={inputClass} />
        </Field>
        <Field label="Phone number" required>
          <input name="emergencyPhone" type="tel" required className={inputClass} />
        </Field>
      </div>
    ),
  },
  {
    id: "visit",
    section: "Visit",
    question: "Let's plan your first visit.",
    render: ({ selectedPlan, today }) => (
      <>
        <div>
          <p className={labelClass}>
            What would you like to focus on first? <span className="text-brand-dark">*</span>
          </p>
          <ChoiceCards name="appointmentType" options={FOCUS_OPTIONS} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Membership plan">
            <Select
              name="plan"
              defaultValue={selectedPlan}
              options={[{ value: "", label: "I'm not sure yet" }, ...PLANS.map((plan) => ({ value: plan, label: plan }))]}
            />
          </Field>
          <Field label="Preferred time" required>
            <Select name="preferredTime" required placeholder="Select a preferred time" options={PREFERRED_TIMES} />
          </Field>
          <Field label="Preferred date" required>
            <DatePicker name="preferredDate" required min={today} />
          </Field>
        </div>
        <Field label="Anything else you'd like to discuss?">
          <textarea name="notes" rows={3} className={inputClass} />
        </Field>
      </>
    ),
  },
  {
    id: "review",
    section: "Review",
    question: "Review and sign.",
    hint: "Check your answers. Use Edit to change anything before you sign.",
    render: ({ answers, goTo, today }) => (
      <>
        <Review answers={answers} goTo={goTo} />
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-2xl bg-paper-100 px-4 py-3.5 text-sm text-ink-950">
            <input
              type="checkbox"
              name="consentTelehealth"
              required
              className="mt-0.5 size-4 shrink-0 rounded border-ink-950/30 text-accent-dark focus:ring-accent-dark"
            />
            I consent to receive telehealth services from CorePhia and understand the associated risks and benefits.{" "}
            <span className="text-brand-dark">*</span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl bg-paper-100 px-4 py-3.5 text-sm text-ink-950">
            <input
              type="checkbox"
              name="consentHipaa"
              required
              className="mt-0.5 size-4 shrink-0 rounded border-ink-950/30 text-accent-dark focus:ring-accent-dark"
            />
            I acknowledge that I have received and reviewed the Notice of Privacy Practices (HIPAA).{" "}
            <span className="text-brand-dark">*</span>
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Electronic signature (type your full legal name)" required>
            <input name="signature" type="text" required placeholder="Full legal name" className={inputClass} />
          </Field>
          <Field label="Date" required>
            <input name="signatureDate" type="date" required defaultValue={today} readOnly className={inputClass} />
          </Field>
        </div>
      </>
    ),
  },
]
```

- [ ] **Step 6: Rewrite the engine**

Replace the whole of `src/components/PatientIntakeForm.jsx` with:

```jsx
import { useEffect, useRef, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useSearchParams } from "react-router-dom"
import { SUPPORT_PHONE } from "../lib/siteContact"
import { CheckCircleIcon } from "./icons"
import { PLANS, SCREENS } from "./intakeScreens"

const MULTI_FIELDS = new Set(["conditions", "familyHistory"])
const NONE = "None of the above"

// A snapshot of what's currently answered, for showIf, the live readouts and
// the review screen. Disabled (branch-skipped) fieldsets are already absent
// from FormData, so their answers never show up here either.
function readAnswers(form) {
  const data = new FormData(form)
  const answers = {}
  for (const key of new Set(data.keys())) {
    answers[key] = MULTI_FIELDS.has(key) ? data.getAll(key).map(String) : String(data.get(key))
  }
  return answers
}

const visibleScreens = (answers) => SCREENS.filter((screen) => !screen.showIf || screen.showIf(answers))

// "None of the above" and a real answer can't both be ticked.
function enforceNoneExclusive(input) {
  if (input.type !== "checkbox" || !input.checked) return
  for (const box of input.form.querySelectorAll(`input[type="checkbox"][name="${input.name}"]`)) {
    if (box !== input && (input.value === NONE || box.value === NONE)) box.checked = false
  }
}

// Grouped to mirror the sections of a standard EMR intake (demographics,
// emergency contact, vitals, history, social history, visit, consent) so it
// can be mapped onto the EMR's own intake record with minimal translation.
// firestore.rules accepts only these top-level keys, so new fields go inside
// an existing group. The has* gate answers are deliberately not read: an
// empty detail string means "none".
function buildIntakeRecord(form) {
  const data = new FormData(form)
  const text = (name) => (data.get(name) ?? "").toString().trim()
  const many = (name) => data.getAll(name).map((entry) => entry.toString())
  const checked = (name) => data.get(name) === "on"

  return {
    submittedAt: new Date().toISOString(),
    demographics: {
      firstName: text("firstName"),
      lastName: text("lastName"),
      dateOfBirth: text("dob"),
      sexAssignedAtBirth: text("sexAssigned"),
      phone: text("phone"),
      email: text("email"),
      address: {
        line1: text("address"),
        city: text("city"),
        state: text("state"),
        postalCode: text("zip"),
      },
    },
    emergencyContact: {
      name: text("emergencyName"),
      relationship: text("emergencyRelationship"),
      phone: text("emergencyPhone"),
    },
    vitals: {
      heightFeet: text("heightFeet"),
      heightInches: text("heightInches"),
      currentWeightLb: text("currentWeight"),
      goalWeightLb: text("goalWeight"),
      highestAdultWeightLb: text("highestWeight"),
    },
    medicalHistory: {
      conditions: many("conditions"),
      medications: text("medications"),
      allergies: text("allergies"),
      surgeries: text("surgeries"),
      priorWeightLossTreatment: text("priorWeightLossTreatment"),
      medicationInterest: text("medicationInterest"),
    },
    familyHistory: {
      conditions: many("familyHistory"),
      notes: text("familyHistoryNotes"),
    },
    socialHistory: {
      tobacco: text("tobacco"),
      alcohol: text("alcohol"),
      exerciseFrequency: text("exerciseFrequency"),
    },
    nutrition: {
      waterIntake: text("waterIntake"),
      estimatedDailyCalories: text("dailyCalories"),
      mealsPerDay: text("mealsPerDay"),
      dietNotes: text("dietNotes"),
    },
    visit: {
      membershipPlan: text("plan"),
      reason: text("appointmentType"),
      preferredDate: text("preferredDate"),
      preferredTime: text("preferredTime"),
      notes: text("notes"),
    },
    consent: {
      telehealth: checked("consentTelehealth"),
      hipaaAcknowledged: checked("consentHipaa"),
      signature: text("signature"),
      signedOn: text("signatureDate"),
    },
  }
}

// Imported on submit rather than at module scope so the Firebase SDK stays out
// of the main bundle — the same reason App.jsx lazy-loads the admin and account
// routes. Someone reading the intake page downloads nothing extra until they
// actually send it.
async function submitIntakeRecord(record) {
  const { sendIntakeRecord } = await import("../lib/intakeSubmission")
  return sendIntakeRecord(record)
}

function TopBar({ progress, section }) {
  const percent = progress == null ? null : Math.round(progress * 100)
  return (
    <header className="sticky top-0 z-10 border-b border-ink-950/10 bg-paper-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Deliberately not a link: the intake has no way back into the site. */}
        <img src="/cp-health.webp" alt="CorePhia Health" className="h-10 w-auto" />
        <a
          href={`tel:${SUPPORT_PHONE.replace(/\D/g, "")}`}
          className="text-right text-xs text-ink-950/60 transition-colors duration-200 ease-out-smooth hover:text-ink-950 sm:text-sm"
        >
          Need help? <span className="block font-semibold text-ink-950 sm:inline">{SUPPORT_PHONE}</span>
        </a>
      </div>
      {percent != null && (
        <div className="mx-auto max-w-xl px-4 pb-3 sm:px-6">
          <div className="flex items-center justify-between text-xs font-medium text-ink-950/60">
            <span>{section}</span>
            <span>{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Intake progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-950/10"
          >
            <div
              className="h-full rounded-full bg-accent-dark transition-[width] duration-300 ease-out-smooth"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </header>
  )
}

const emergencyNote = (
  <p className="mt-12 text-xs text-ink-950/50">
    This form is not for medical emergencies. If you are experiencing a medical emergency, call 911 immediately.
  </p>
)

export default function PatientIntakeForm() {
  const formRef = useRef(null)
  const advanceTimer = useRef(null)
  const pendingReport = useRef(false)
  const hasNavigated = useRef(false)
  const [answers, setAnswers] = useState({})
  const [currentId, setCurrentId] = useState(SCREENS[0].id)
  const [direction, setDirection] = useState("forward")
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState("idle")
  const [searchParams] = useSearchParams()
  const today = new Date().toISOString().slice(0, 10)
  const requestedPlan = searchParams.get("plan")
  const selectedPlan = PLANS.includes(requestedPlan) ? requestedPlan : ""

  const visible = visibleScreens(answers)
  const position = visible.findIndex((screen) => screen.id === currentId)
  const current = visible[position]
  const isLast = position === visible.length - 1

  // Answers live only in memory (never Web Storage: they're PHI), so a reload
  // or closed tab loses them. Warn first.
  useEffect(() => {
    if (!dirty || status === "sent") return
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, status])

  // On every screen change: back to the top, and focus the new question so a
  // screen reader announces it. Skipped on first load, where the page itself
  // is what's new.
  useEffect(() => {
    if (!hasNavigated.current) return
    window.scrollTo({ top: 0, behavior: "instant" })
    const fieldset = formRef.current?.querySelector(`[data-screen="${currentId}"]`)
    if (pendingReport.current) {
      pendingReport.current = false
      fieldset?.reportValidity()
      return
    }
    document.getElementById(`q-${currentId}`)?.focus()
  }, [currentId])

  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const goTo = (id, dir = "forward") => {
    clearTimeout(advanceTimer.current)
    hasNavigated.current = true
    setAnswers(readAnswers(formRef.current))
    setDirection(dir)
    setCurrentId(id)
  }

  const goNext = () => {
    const form = formRef.current
    if (!form.querySelector(`[data-screen="${currentId}"]`).reportValidity()) return
    // Recompute from the form, not state: the answer that was just picked may
    // be what reveals the next screen.
    const list = visibleScreens(readAnswers(form))
    const target = list[list.findIndex((screen) => screen.id === currentId) + 1]
    if (target) goTo(target.id)
  }

  const goBack = () => goTo(visible[position - 1].id, "back")

  const handleChange = (event) => {
    const input = event.target
    enforceNoneExclusive(input)
    setDirty(true)
    setAnswers(readAnswers(formRef.current))
    if (current.autoAdvance && input.type === "radio") {
      // A beat to show the selected state before moving on. Resetting the
      // timer means a quick second tap still advances only once.
      clearTimeout(advanceTimer.current)
      advanceTimer.current = setTimeout(goNext, 250)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    // Enter in any field lands here; before the last screen it just advances.
    if (!isLast) {
      goNext()
      return
    }
    const form = event.currentTarget
    // Each screen was checked on the way through, but an Edit from the review
    // screen can change what's visible, so check every visible screen again.
    const invalid = visible.find((screen) => !form.querySelector(`[data-screen="${screen.id}"]`).checkValidity())
    if (invalid) {
      if (invalid.id === currentId) form.querySelector(`[data-screen="${invalid.id}"]`).reportValidity()
      else {
        pendingReport.current = true
        goTo(invalid.id)
      }
      return
    }
    // Read the form before awaiting: currentTarget is only valid for the
    // lifetime of the event dispatch.
    const record = buildIntakeRecord(form)
    setStatus("sending")
    try {
      await submitIntakeRecord(record)
      setStatus("sent")
    } catch (cause) {
      // Never fall through to the confirmation screen on a failure — it tells
      // the patient a care team has their information when nothing was stored.
      console.error("Intake submission failed:", cause.code ?? cause.message)
      setStatus("error")
    }
  }

  if (status === "sent") {
    return (
      <div className="min-h-dvh bg-paper-50">
        <Helmet>
          <title>Request Received | Corephia</title>
          <meta name="robots" content="noindex, follow" />
          <link rel="canonical" href="https://www.corephia.com/intake" />
        </Helmet>
        <TopBar />
        <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center rounded-3xl bg-paper-100 p-10 text-center">
            <CheckCircleIcon className="size-14 text-accent-dark" />
            <h1 className="mt-5 font-serif text-3xl text-ink-950">Request received</h1>
            <p className="mt-3 max-w-md text-ink-950/70">
              Thanks for filling out your intake form. A member of our care team will reach out within one business
              day to confirm your appointment.
            </p>
            <Link
              to="/"
              className="mt-6 rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-paper-50">
      <Helmet>
        <title>Schedule an Appointment | Corephia Patient Intake Form</title>
        <meta
          name="description"
          content="Book your Corephia appointment. Fill out our secure patient intake form to schedule a nutrition, exercise, or medical support consultation."
        />
        <link rel="canonical" href="https://www.corephia.com/intake" />
      </Helmet>
      <TopBar progress={position / (visible.length - 1)} section={current.section} />
      <main className="mx-auto max-w-xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        <h1 className="sr-only">Patient intake form</h1>
        {/* noValidate: validation runs per screen in goNext/handleSubmit, since
            the browser's whole-form check would trip on hidden screens. */}
        <form ref={formRef} noValidate onSubmit={handleSubmit} onChange={handleChange}>
          {SCREENS.map((screen) => (
            <fieldset
              key={screen.id}
              data-screen={screen.id}
              aria-labelledby={`q-${screen.id}`}
              // Branch-skipped screens are disabled so the browser leaves them
              // out of both validation and FormData.
              disabled={!visible.includes(screen)}
              hidden={screen.id !== currentId}
              className={direction === "back" ? "animate-view-back" : "animate-view-forward"}
            >
              <h2
                id={`q-${screen.id}`}
                tabIndex={-1}
                className="font-serif text-3xl leading-tight text-balance text-ink-950 outline-none sm:text-4xl"
              >
                {screen.question}
              </h2>
              {screen.hint && <p className="mt-3 text-ink-950/60">{screen.hint}</p>}
              <div className="mt-8 space-y-5">{screen.render({ answers, goTo, selectedPlan, today })}</div>
            </fieldset>
          ))}

          {status === "error" && isLast && (
            <div role="alert" className="mt-8 rounded-2xl border border-brand-dark/30 bg-paper-100 p-5">
              <p className="font-medium text-ink-950">We could not send your intake form.</p>
              <p className="mt-1 text-sm text-ink-950/70">
                Nothing was submitted, so your answers are still here. Try again in a moment. If it keeps failing,
                call us at {SUPPORT_PHONE} and we will take your intake over the phone.
              </p>
            </div>
          )}

          <div className="mt-10 flex items-center gap-3">
            {position > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-full border border-ink-950/15 px-6 py-4 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:border-ink-950/40"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="flex-1 rounded-full bg-ink-950 py-4 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60 sm:flex-none sm:px-10"
            >
              {isLast ? (status === "sending" ? "Sending…" : "Submit intake form") : "Continue"}
            </button>
          </div>
        </form>
        {emergencyNote}
      </main>
    </div>
  )
}
```

- [ ] **Step 7: Run the check script to confirm it passes**

Run (from the scratchpad): `node intake-check.mjs`
Expected:

```
PASS shell
PASS beforeunload
PASS happy path + branches
```

If a check fails, fix the code, not the check, unless the check is asserting something the spec doesn't ask for.

- [ ] **Step 8: Checkpoint**

Run: `npm run lint` then `npm run build`
Expected: no new lint warnings, and the build completes.

---

### Task 3: Visual pass and final verification

**Files:**
- Modify (only if the pass finds something): `src/components/intakeScreens.jsx`, `src/components/PatientIntakeForm.jsx`

**Interfaces:**
- Consumes: the finished flow from Task 2. No new interfaces.

- [ ] **Step 1: Load `frontend-design`**

Invoke the `frontend-design` skill (project rule). Judge the flow against the spec's Visual direction: one large Fraunces question, lots of white space, answer cards as the dominant element, calm chrome. Changes are limited to classes and copy spacing. Do not change field names, screen ids, or the DOM contract from Task 2.

- [ ] **Step 2: Screenshot the key screens at 390×844 and 1440×900**

With Playwright, capture: `goal-weight` (with the readout showing), `medication-interest`, `conditions`, `about-you` (with a Select open), `visit`, and `review`. Wait at least 350ms after each navigation so the slide-in finishes before capturing. Save the images under `.playwright-mcp/` (the MCP browser can only write inside the repo; that folder is already untracked).

Check each one for: the question not crowding the top bar, cards at least 56px tall, the selected state visible, a visible focus ring after pressing Tab, no horizontal scroll at 390px, and the Back/Continue row not wrapping.

- [ ] **Step 3: Contrast spot-check**

In the browser, measure `accent-dark` text (the review "Edit" links) on `paper-100`, and `ink-950/60` hints on `paper-50`. Both must be at least 4.5:1. Measure against the actual painted background (CLAUDE.md: `getComputedStyle` is transparent on layered elements).

- [ ] **Step 4: Reduced motion**

In a fresh context with `reducedMotion: "reduce"`, confirm that `getComputedStyle(fieldset).animationName === "none"` on the current screen.

- [ ] **Step 5: Re-run everything**

Run: `node intake-check.mjs` (scratchpad), `npm run lint`, `npm run build`
Expected: three PASS lines, no new lint warnings, and the build completes.

- [ ] **Step 6: Report**

Tell Louie what changed per file, the check output, and the screenshots. Do not commit unless asked.
