// Synthetic records for reviewing the dashboard before real intake data exists.
// Deliberately fake names and no real contact details — this is not PHI, and it
// only ever loads in the dev server (see usingSeedData in firebase.js).
// The shape mirrors buildIntakeRecord() in PatientIntakeForm.jsx exactly, so
// swapping to live Firestore records needs no dashboard changes.

const FIRST_NAMES = [
  "Avery", "Jordan", "Riley", "Casey", "Morgan", "Quinn", "Reese", "Devon",
  "Harper", "Elliot", "Rowan", "Sasha", "Micah", "Noel", "Blair", "Tatum",
]
const LAST_NAMES = [
  "Okafor", "Lindqvist", "Marchetti", "Delacroix", "Ferreira", "Nakamura",
  "Abernathy", "Voss", "Calloway", "Ibarra", "Petrov", "Nwosu",
]

const APPOINTMENT_TYPES = [
  "Weight loss consultation",
  "Nutrition consultation",
  "Exercise program consultation",
  "General health check",
  "Follow-up visit",
  "Other",
]
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
]
const FAMILY_HISTORY = [
  "Cancer",
  "Diabetes",
  "Heart disease",
  "High blood pressure",
  "Stroke",
  "Thyroid disorder",
  "Obesity",
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
const EXERCISE_FREQUENCY = [
  "None right now",
  "1-2 days per week",
  "3-4 days per week",
  "5 or more days per week",
]
const STATES = ["FL", "FL", "FL", "FL", "FL", "GA", "GA", "AL", "TX", "NY", "NC", "SC"]

// Seeded so the dashboard shows the same figures on every reload; random data
// that shifts on refresh reads as a bug.
function createRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function buildSeedRecords(count) {
  const random = createRandom(20260914)
  const pick = (list) => list[Math.floor(random() * list.length)]
  const records = []

  for (let index = 0; index < count; index += 1) {
    // Spread submissions across the last ~10 weeks, mildly weighted toward
    // recent so the weekly chart reads as a growing practice rather than a spike.
    const daysAgo = Math.floor(random() ** 1.5 * 70)
    const submittedAt = new Date(Date.now() - daysAgo * 86400000)
    const conditionCount = Math.floor(random() * 3)
    const conditions = []
    while (conditions.length < conditionCount) {
      const condition = pick(CONDITIONS)
      if (!conditions.includes(condition)) conditions.push(condition)
    }
    const familyCount = Math.floor(random() * 3)
    const family = []
    while (family.length < familyCount) {
      const item = pick(FAMILY_HISTORY)
      if (!family.includes(item)) family.push(item)
    }
    const currentWeight = 180 + Math.floor(random() * 120)
    const firstName = pick(FIRST_NAMES)
    const lastName = pick(LAST_NAMES)

    records.push({
      id: `seed-${index + 1}`,
      submittedAt: submittedAt.toISOString(),
      demographics: {
        firstName,
        lastName,
        dateOfBirth: `19${60 + Math.floor(random() * 40)}-0${1 + Math.floor(random() * 9)}-1${Math.floor(random() * 9)}`,
        sexAssignedAtBirth: random() > 0.55 ? "Female" : "Male",
        phone: "",
        email: "",
        address: { line1: "", city: "Tampa", state: pick(STATES), postalCode: "" },
      },
      emergencyContact: { name: "", relationship: "", phone: "" },
      insurance: { provider: "", memberId: "", groupNumber: "", policyholderName: "" },
      vitals: {
        heightFeet: String(5 + Math.floor(random() * 2)),
        heightInches: String(Math.floor(random() * 12)),
        currentWeightLb: String(currentWeight),
        goalWeightLb: String(currentWeight - (25 + Math.floor(random() * 55))),
        highestAdultWeightLb: String(currentWeight + Math.floor(random() * 25)),
        weightLossGoalRange: "",
        highestAdultWeightRange: "",
      },
      medicalHistory: {
        conditions: conditions.length ? conditions : ["None of the above"],
        medications: "",
        allergies: "",
        surgeries: "",
        priorWeightLossTreatment: random() > 0.6 ? "Yes" : "No",
        medicationInterest: pick(["discuss", "unsure", "no"]),
      },
      familyHistory: { conditions: family.length ? family : ["None of the above"], notes: "" },
      socialHistory: {
        tobacco: pick(TOBACCO_STATUS),
        alcohol: pick(ALCOHOL_USE),
        exerciseFrequency: pick(EXERCISE_FREQUENCY),
      },
      nutrition: {
        waterIntake: "",
        estimatedDailyCalories: "",
        estimatedDailyCaloriesRange: pick(["Under 1,500", "1,500 to 2,000", "2,000 to 2,500", "Over 2,500", "Not sure"]),
        mealsPerDay: pick(["1", "2", "3", "4 or more", "It varies"]),
        dietNotes: "",
      },
      visit: {
        membershipPlan: "",
        reason: pick(APPOINTMENT_TYPES),
        preferredDate: "",
        preferredTime: "",
        notes: "",
      },
      consent: {
        telehealth: true,
        hipaaAcknowledged: true,
        insuranceBilling: random() > 0.35,
        signature: `${firstName} ${lastName}`,
        signedOn: submittedAt.toISOString().slice(0, 10),
      },
    })
  }

  return records.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export const seedRecords = buildSeedRecords(48)
