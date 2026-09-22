import { useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useSearchParams } from "react-router-dom"
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

const APPOINTMENT_TYPES = [
  "Weight loss consultation",
  "Nutrition consultation",
  "Exercise program consultation",
  "General health check",
  "Follow-up visit",
  "Other",
]

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

const WATER_INTAKE = [
  "Less than 2 glasses a day",
  "2-4 glasses a day",
  "5-7 glasses a day",
  "8 or more glasses a day",
]

const EXERCISE_FREQUENCY = [
  "None right now",
  "1-2 days per week",
  "3-4 days per week",
  "5 or more days per week",
]

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

function SectionCard({ title, description, children }) {
  return (
    <fieldset className="rounded-3xl bg-paper-100/70 p-6 sm:p-8">
      <legend className="px-1 font-serif text-2xl text-ink-950">{title}</legend>
      {description && <p className="mt-1 mb-6 text-sm text-ink-950/60">{description}</p>}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

// Grouped to mirror the sections of a standard EMR intake (demographics,
// emergency contact, coverage, vitals, history, social history, visit, consent)
// so it can be mapped onto the EMR's own intake record with minimal translation.
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
    insurance: {
      provider: text("insuranceProvider"),
      memberId: text("insuranceId"),
      groupNumber: text("insuranceGroup"),
      policyholderName: text("policyholderName"),
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
      insuranceBilling: checked("consentBilling"),
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

const PLANS = ["Core", "Core+", "Core Complete"]

export default function PatientIntakeForm() {
  const [status, setStatus] = useState("idle")
  const [searchParams] = useSearchParams()
  const today = new Date().toISOString().slice(0, 10)
  const requestedPlan = searchParams.get("plan")
  const selectedPlan = PLANS.includes(requestedPlan) ? requestedPlan : ""

  const handleSubmit = async (event) => {
    event.preventDefault()
    // Read the form before awaiting: currentTarget is only valid for the
    // lifetime of the event dispatch.
    const record = buildIntakeRecord(event.currentTarget)
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
      <section id="intake-form" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Helmet>
          <title>Request Received — Corephia</title>
          <meta name="robots" content="noindex, follow" />
          <link rel="canonical" href="https://www.corephia.com/intake" />
        </Helmet>
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
      </section>
    )
  }

  return (
    <section id="intake-form" aria-labelledby="intake-heading" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Helmet>
        <title>Schedule an Appointment — Corephia Patient Intake Form</title>
        <meta
          name="description"
          content="Book your Corephia appointment. Fill out our secure patient intake form to schedule a nutrition, exercise, or medical support consultation."
        />
        <link rel="canonical" href="https://www.corephia.com/intake" />
      </Helmet>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-950/60 transition-colors duration-200 ease-out-smooth hover:text-ink-950"
      >
        ← Back to home
      </Link>
      <h1 id="intake-heading" className="mt-4 font-serif text-4xl text-ink-950 sm:text-5xl">
        Patient intake form
      </h1>
      <p className="mt-3 max-w-xl text-ink-950/60">
        Every CorePhia patient completes the same intake, so nothing gets missed and your provider has your full
        picture before your first visit. It takes about 10 minutes. Your information is kept confidential and
        protected under HIPAA.
      </p>

      <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
        <SectionCard title="Personal information">
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
            <Select
              name="sexAssigned"
              required
              placeholder="Select one"
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
                { value: "intersex", label: "Intersex" },
                { value: "prefer-not-to-say", label: "Prefer not to say" },
              ]}
            />
          </Field>
          <Field label="Phone number" required>
            <input name="phone" type="tel" required autoComplete="tel" className={inputClass} />
          </Field>
          <Field label="Email address" required>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              // type="email" alone still accepts things like "patient@localhost"
              // — no dot, no real domain — since the browser's own email
              // constraint doesn't require one. This requires an actual
              // dot-separated domain and a 2+ letter TLD before it'll validate.
              // The hyphens are escaped because browsers compile `pattern` with
              // the regex `v` flag, where a literal `-` in a character class is
              // a syntax error — unescaped, the whole pattern silently fails to
              // compile and no validation happens at all.
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
        </SectionCard>

        <SectionCard title="Emergency contact">
          <Field label="Full name" required>
            <input name="emergencyName" type="text" required className={inputClass} />
          </Field>
          <Field label="Relationship to patient" required>
            <input name="emergencyRelationship" type="text" required className={inputClass} />
          </Field>
          <Field label="Phone number" required>
            <input name="emergencyPhone" type="tel" required autoComplete="tel" className={inputClass} />
          </Field>
        </SectionCard>

        <SectionCard
          title="Insurance information"
          description="Optional — skip this section if you'll be paying out of pocket."
        >
          <Field label="Insurance provider">
            <input name="insuranceProvider" type="text" className={inputClass} />
          </Field>
          <Field label="Member / policy ID">
            <input name="insuranceId" type="text" className={inputClass} />
          </Field>
          <Field label="Group number">
            <input name="insuranceGroup" type="text" className={inputClass} />
          </Field>
          <Field label="Policyholder name (if not you)">
            <input name="policyholderName" type="text" className={inputClass} />
          </Field>
        </SectionCard>

        <SectionCard
          title="Height & weight"
          description="Your provider uses these to calculate BMI and set a realistic target with you."
        >
          <Field label="Height" required>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  name="heightFeet"
                  type="number"
                  min="3"
                  max="8"
                  required
                  placeholder="5"
                  aria-label="Height in feet"
                  className={inputClass}
                />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-ink-950/40">
                  ft
                </span>
              </div>
              <div className="relative">
                <input
                  name="heightInches"
                  type="number"
                  min="0"
                  max="11"
                  required
                  placeholder="10"
                  aria-label="Height in inches"
                  className={inputClass}
                />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-ink-950/40">
                  in
                </span>
              </div>
            </div>
          </Field>
          <Field label="Current weight (lbs)" required>
            <input name="currentWeight" type="number" min="50" max="1000" required className={inputClass} />
          </Field>
          <Field label="Goal weight (lbs)">
            <input name="goalWeight" type="number" min="50" max="1000" className={inputClass} />
          </Field>
          <Field label="Highest adult weight (lbs)">
            <input name="highestWeight" type="number" min="50" max="1000" className={inputClass} />
          </Field>
        </SectionCard>

        <SectionCard title="Medical history">
          <div className="sm:col-span-2">
            <Field label="Current medications">
              <textarea
                name="medications"
                rows={3}
                placeholder="List any medications and dosages you're currently taking"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Known allergies">
              <textarea
                name="allergies"
                rows={2}
                placeholder="Medications, foods, or other allergies"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <span className={labelClass}>Existing conditions</span>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {CONDITIONS.map((condition) => (
                <label
                  key={condition}
                  className="flex items-center gap-2.5 rounded-2xl bg-paper-50 px-4 py-3 text-sm text-ink-950"
                >
                  <input
                    type="checkbox"
                    name="conditions"
                    value={condition}
                    className="size-4 rounded border-ink-950/30 text-accent-dark focus:ring-accent-dark"
                  />
                  {condition}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Field label="Previous surgeries">
              <textarea name="surgeries" rows={2} className={inputClass} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Previous weight loss treatment">
              <textarea
                name="priorWeightLossTreatment"
                rows={2}
                placeholder="Any weight loss medication, programs, or surgery you've tried before — and how it went"
                className={inputClass}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Family history"
          description="Conditions that run in your immediate family (parents, siblings, children)."
        >
          <div className="sm:col-span-2">
            <span className={labelClass}>Select any that apply</span>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {FAMILY_HISTORY.map((item) => (
                <label
                  key={item}
                  className="flex items-center gap-2.5 rounded-2xl bg-paper-50 px-4 py-3 text-sm text-ink-950"
                >
                  <input
                    type="checkbox"
                    name="familyHistory"
                    value={item}
                    className="size-4 rounded border-ink-950/30 text-accent-dark focus:ring-accent-dark"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Field label="Additional detail">
              <textarea
                name="familyHistoryNotes"
                rows={2}
                placeholder="Who was affected and at what age, if known"
                className={inputClass}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Lifestyle & nutrition"
          description="Your answers here shape the nutrition and exercise side of your plan."
        >
          <Field label="Tobacco use" required>
            <Select name="tobacco" required placeholder="Select one" options={TOBACCO_STATUS} />
          </Field>
          <Field label="Alcohol use" required>
            <Select name="alcohol" required placeholder="Select one" options={ALCOHOL_USE} />
          </Field>
          <Field label="Water intake" required>
            <Select name="waterIntake" required placeholder="Select one" options={WATER_INTAKE} />
          </Field>
          <Field label="Exercise" required>
            <Select name="exerciseFrequency" required placeholder="Select one" options={EXERCISE_FREQUENCY} />
          </Field>
          <Field label="Estimated daily calories">
            <input
              name="dailyCalories"
              type="number"
              min="0"
              max="20000"
              placeholder="Your best guess is fine"
              className={inputClass}
            />
          </Field>
          <Field label="Meals per day">
            <input name="mealsPerDay" type="number" min="0" max="12" className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Tell us about how you eat">
              <textarea
                name="dietNotes"
                rows={3}
                placeholder="A typical day of eating, snacking habits, dietary restrictions, or anything else we should know"
                className={inputClass}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Appointment details">
          <Field label="Membership plan">
            <Select
              name="plan"
              defaultValue={selectedPlan}
              options={[{ value: "", label: "I'm not sure yet" }, ...PLANS.map((plan) => ({ value: plan, label: plan }))]}
            />
          </Field>
          <Field label="Reason for visit" required>
            <Select
              name="appointmentType"
              required
              placeholder="Select an appointment type"
              options={APPOINTMENT_TYPES}
            />
          </Field>
          <Field label="Preferred time" required>
            <Select name="preferredTime" required placeholder="Select a preferred time" options={PREFERRED_TIMES} />
          </Field>
          <Field label="Preferred date" required>
            <DatePicker name="preferredDate" required min={today} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Additional notes">
              <textarea
                name="notes"
                rows={3}
                placeholder="Tell us more about what you'd like to discuss"
                className={inputClass}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Consent & signature">
          <div className="space-y-3 sm:col-span-2">
            <label className="flex items-start gap-3 rounded-2xl bg-paper-50 px-4 py-3.5 text-sm text-ink-950">
              <input
                type="checkbox"
                name="consentTelehealth"
                required
                className="mt-0.5 size-4 shrink-0 rounded border-ink-950/30 text-accent-dark focus:ring-accent-dark"
              />
              I consent to receive telehealth services from CorePhia and understand the associated risks and
              benefits. <span className="text-brand-dark">*</span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl bg-paper-50 px-4 py-3.5 text-sm text-ink-950">
              <input
                type="checkbox"
                name="consentHipaa"
                required
                className="mt-0.5 size-4 shrink-0 rounded border-ink-950/30 text-accent-dark focus:ring-accent-dark"
              />
              I acknowledge that I have received and reviewed the Notice of Privacy Practices (HIPAA).{" "}
              <span className="text-brand-dark">*</span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl bg-paper-50 px-4 py-3.5 text-sm text-ink-950">
              <input
                type="checkbox"
                name="consentBilling"
                className="mt-0.5 size-4 shrink-0 rounded border-ink-950/30 text-accent-dark focus:ring-accent-dark"
              />
              I authorize Corephia to bill my insurance provider, if applicable.
            </label>
          </div>
          <Field label="Electronic signature (type your full legal name)" required>
            <input name="signature" type="text" required placeholder="Full legal name" className={inputClass} />
          </Field>
          <Field label="Date" required>
            <input name="signatureDate" type="date" required defaultValue={today} readOnly className={inputClass} />
          </Field>
        </SectionCard>

        {status === "error" && (
          <div role="alert" className="rounded-2xl border border-brand-dark/30 bg-paper-100 p-5">
            <p className="font-medium text-ink-950">We could not send your intake form.</p>
            <p className="mt-1 text-sm text-ink-950/70">
              Nothing was submitted, so your answers are still here — try again in a moment. If it keeps
              failing, call us and we will take your intake over the phone.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded-full bg-ink-950 py-4 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900 disabled:opacity-60 sm:w-auto sm:px-10"
        >
          {status === "sending" ? "Sending…" : "Submit intake form"}
        </button>

        <p className="text-xs text-ink-950/50">
          This form is not for medical emergencies. If you are experiencing a medical emergency, call 911
          immediately.
        </p>
      </form>
    </section>
  )
}
