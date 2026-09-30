// This is a data module (SCREENS, PLANS) whose helpers happen to be JSX, not a
// component module, so fast refresh reloading the page when it changes is fine.
/* oxlint-disable react/only-export-components */
import { PLANS_SHOWN } from "../data/pricingTiers"
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
const FOCUS_OPTIONS = ["Medical care", "Dietitian services", "Comprehensive Exercise Plan", "Follow-ups", "Not sure yet"]

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

// Tap first, type only if the patient wants to (Louie, following Hims). The
// "exact" option reveals a number box instead of advancing the flow.
export const EXACT = "exact"

const WEIGHT_LOSS_GOAL = [
  "Losing 1-15 lbs",
  "Losing 16-50 lbs",
  "Losing 51+ lbs",
  "Not sure, I just need to lose weight",
  { value: EXACT, label: "I have a goal weight in mind" },
]

const HIGHEST_WEIGHT = [
  "About what I weigh now",
  "Up to 20 lbs more",
  "21 to 50 lbs more",
  "More than 50 lbs more",
  "Not sure",
  { value: EXACT, label: "I'll enter the exact weight" },
]

const MEALS_PER_DAY = ["1", "2", "3", "4 or more", "It varies"]

const DAILY_CALORIES = [
  "Under 1,500",
  "1,500 to 2,000",
  "2,000 to 2,500",
  "Over 2,500",
  "Not sure",
  { value: EXACT, label: "I'll enter a number" },
]

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
  "w-full rounded-2xl border border-ink-950/15 bg-white px-4 py-3.5 text-ink-950 placeholder-ink-950/40 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

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
// Modelled on the Hims cards: white on the page, a faint border, and selection
// shown by the border alone. It thickens as well as changing colour, so it
// doesn't rely on colour. Only multi-select shows a check, where "which ones
// did I tick" is the question.
function OptionCards({ type, name, options, required, columns = 1 }) {
  return (
    <div className={`grid gap-3 ${columns === 2 ? "grid-cols-2" : ""}`}>
      {options.map(toOption).map(({ value, label }) => (
        <label
          key={value}
          className="group relative flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-xl border border-ink-950/10 bg-white px-5 py-4 text-[15px] font-medium text-ink-950 transition-colors duration-200 ease-out-smooth hover:border-ink-950/30 has-checked:border-accent-dark has-checked:ring-1 has-checked:ring-accent-dark has-checked:ring-inset has-focus-visible:ring-2 has-focus-visible:ring-accent/60 has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-paper-50"
        >
          <input
            type={type}
            name={name}
            value={value}
            required={required}
            className="absolute inset-0 size-full cursor-pointer appearance-none rounded-2xl outline-none"
          />
          <span>{label}</span>
          {type === "checkbox" && (
            <CheckCircleIcon className="size-5 shrink-0 text-accent-dark opacity-0 transition-opacity duration-200 group-has-checked:opacity-100" />
          )}
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
      ["Goal", a.weightLossGoal === EXACT ? lbs(a.goalWeight) : a.weightLossGoal],
      ["Height", a.heightFeet ? `${a.heightFeet} ft ${a.heightInches || 0} in` : ""],
      ["Highest adult weight", a.highestWeightRange === EXACT ? lbs(a.highestWeight) : a.highestWeightRange],
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
      ["Daily calories", a.dailyCaloriesRange === EXACT ? a.dailyCalories : a.dailyCaloriesRange],
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
      ...(PLANS_SHOWN ? [["Plan", a.plan || "Not sure yet"]] : []),
      ["Focus", a.appointmentType],
      ["Preferred date", a.preferredDate],
      ["Preferred time", a.preferredTime],
      ["Notes", a.notes],
    ],
  },
]

// Edit buttons carry data-goto; PatientIntakeForm handles the click at the
// form, so no navigation callback has to be passed into render.
function Review({ answers }) {
  return (
    <div className="space-y-4">
      {REVIEW_SECTIONS.map((section) => (
        <section key={section.title} className="rounded-xl border border-ink-950/10 bg-white p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-serif text-lg text-ink-950">{section.title}</h3>
            <button
              type="button"
              data-goto={section.edit}
              className="text-sm font-semibold text-accent-dark underline-offset-4 hover:underline"
            >
              Edit<span className="sr-only"> {section.title.toLowerCase()}</span>
            </button>
          </div>
          <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
            {section.rows(answers).map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-ink-950/70">{label}</dt>
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
    question: "What's your weight loss goal?",
    // Builds up as the patient answers (Louie's idea): the goal, then their
    // current weight, then Continue once that weight is in. autoFocus fires
    // when each box first appears, so the keyboard follows along.
    ready: (a) => Boolean(a.weightLossGoal && a.currentWeight),
    render: ({ answers }) => (
      <>
        <ChoiceCards name="weightLossGoal" options={WEIGHT_LOSS_GOAL} />
        {answers.weightLossGoal === EXACT && (
          <Field label="Goal weight (lbs)" required>
            <input name="goalWeight" type="number" inputMode="numeric" min="50" max="1000" required autoFocus className={inputClass} />
          </Field>
        )}
        {answers.weightLossGoal && (
          <>
            <Field label="What do you weigh now? (lbs)" required>
              <input
                name="currentWeight"
                type="number"
                inputMode="numeric"
                min="50"
                max="1000"
                required
                autoFocus={answers.weightLossGoal !== EXACT}
                className={inputClass}
              />
            </Field>
            <GoalReadout answers={answers} />
          </>
        )}
      </>
    ),
  },
  {
    id: "height",
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
    question: "What's the most you've weighed as an adult?",
    hint: "Compared with what you weigh now. It helps your provider understand your weight history.",
    autoAdvance: "highestWeightRange",
    render: ({ answers }) => (
      <>
        <ChoiceCards name="highestWeightRange" options={HIGHEST_WEIGHT} />
        {answers.highestWeightRange === EXACT && (
          <Field label="Highest adult weight (lbs)" required>
            <input name="highestWeight" type="number" inputMode="numeric" min="50" max="1000" required className={inputClass} />
          </Field>
        )}
      </>
    ),
  },
  {
    id: "medication-interest",
    question: "Have you used, or are you interested in, weight loss medication?",
    hint: "A provider decides whether it's appropriate for you.",
    autoAdvance: "medicationInterest",
    render: () => <ChoiceCards name="medicationInterest" options={MEDICATION_INTEREST} />,
  },
  {
    id: "conditions",
    question: "Do you have any of these conditions?",
    hint: "Select all that apply.",
    render: () => <CheckCards name="conditions" options={CONDITIONS} />,
  },
  {
    id: "has-medications",
    question: "Do you take any medications right now?",
    hint: "Include vitamins and supplements.",
    autoAdvance: "hasMedications",
    render: () => <ChoiceCards name="hasMedications" options={YES_NO} columns={2} />,
  },
  {
    id: "medications",
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
    question: "Do you have any allergies?",
    hint: "Medications, foods, or anything else.",
    autoAdvance: "hasAllergies",
    render: () => <ChoiceCards name="hasAllergies" options={YES_NO} columns={2} />,
  },
  {
    id: "allergies",
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
    question: "Do you use tobacco or nicotine?",
    autoAdvance: "tobacco",
    render: () => <ChoiceCards name="tobacco" options={TOBACCO_STATUS} />,
  },
  {
    id: "alcohol",
    question: "How much alcohol do you drink?",
    autoAdvance: "alcohol",
    render: () => <ChoiceCards name="alcohol" options={ALCOHOL_USE} />,
  },
  {
    id: "water",
    question: "How much water do you drink a day?",
    autoAdvance: "waterIntake",
    render: () => <ChoiceCards name="waterIntake" options={WATER_INTAKE} />,
  },
  {
    id: "exercise",
    question: "How often do you exercise right now?",
    autoAdvance: "exerciseFrequency",
    render: () => <ChoiceCards name="exerciseFrequency" options={EXERCISE_FREQUENCY} />,
  },
  {
    id: "meals",
    question: "How many meals do you eat on a typical day?",
    autoAdvance: "mealsPerDay",
    render: () => <ChoiceCards name="mealsPerDay" options={MEALS_PER_DAY} />,
  },
  {
    id: "calories",
    question: "About how many calories do you eat a day?",
    hint: "Your best guess is fine.",
    autoAdvance: "dailyCaloriesRange",
    render: ({ answers }) => (
      <>
        <ChoiceCards name="dailyCaloriesRange" options={DAILY_CALORIES} />
        {answers.dailyCaloriesRange === EXACT && (
          <Field label="Calories per day" required>
            <input name="dailyCalories" type="number" inputMode="numeric" min="0" max="20000" required className={inputClass} />
          </Field>
        )}
      </>
    ),
  },
  {
    id: "eating",
    question: "What does a typical day of eating look like?",
    hint: "Optional. Your dietitian uses this to build your plan.",
    optional: true,
    render: () => (
      <Field label="A typical day of eating">
        <textarea
          name="dietNotes"
          rows={4}
          placeholder="Snacking habits, dietary restrictions, or anything else we should know"
          className={inputClass}
        />
      </Field>
    ),
  },
  {
    id: "about-you",
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
          {/* Follows PLANS_SHOWN in data/pricingTiers.js. */}
          {PLANS_SHOWN && (
            <Field label="Membership plan">
              <Select
                name="plan"
                defaultValue={selectedPlan}
                options={[{ value: "", label: "I'm not sure yet" }, ...PLANS.map((plan) => ({ value: plan, label: plan }))]}
              />
            </Field>
          )}
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
    question: "Review and sign.",
    hint: "Check your answers. Use Edit to change anything before you sign.",
    render: ({ answers, today }) => (
      <>
        <Review answers={answers} />
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
