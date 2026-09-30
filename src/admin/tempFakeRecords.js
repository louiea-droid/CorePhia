// TEMPORARY. Real intake submissions are still zero (the intake form has no
// destination yet — see CLAUDE.md), so the real, Firebase-connected
// Dashboard and Patients pages have nothing to render or tune against.
// These are hand-written sample rows, NOT pulled from Firestore or
// seedRecords.js (that file is dev-server-only demo data, gated behind
// usingSeedData — these load in the real, signed-in admin whenever a real
// query genuinely returns zero documents). Delete this file once real
// submissions exist, and remove its two call sites in Dashboard.jsx and
// Patients.jsx.
const RAW_ROWS = [
  { firstName: "Ava", lastName: "Bennett", daysAgo: 1, plan: "Core+", reason: "Nutrition consultation", state: "FL", weight: 212, goal: 175, condition: "High blood pressure", family: "Diabetes", exercise: "3-4 days per week", tobacco: "Never used tobacco" },
  { firstName: "Miles", lastName: "Carter", daysAgo: 2, plan: "Core", reason: "Weight loss consultation", state: "FL", weight: 245, goal: 200, condition: "Diabetes or prediabetes", family: "Heart disease", exercise: "None right now", tobacco: "Former smoker" },
  { firstName: "Priya", lastName: "Shah", daysAgo: 3, plan: "Core Complete", reason: "Follow-up visit", state: "GA", weight: 198, goal: 160, condition: "Thyroid disorder", family: "Thyroid disorder", exercise: "5 or more days per week", tobacco: "Never used tobacco" },
  { firstName: "Diego", lastName: "Ramos", daysAgo: 4, plan: "Core+", reason: "General health check", state: "FL", weight: 231, goal: 190, condition: "High cholesterol", family: "Cancer", exercise: "1-2 days per week", tobacco: "Current smoker" },
  { firstName: "Hana", lastName: "Kimura", daysAgo: 5, plan: "Core", reason: "Exercise program consultation", state: "NC", weight: 176, goal: 145, condition: "None of the above", family: "High blood pressure", exercise: "3-4 days per week", tobacco: "Never used tobacco" },
  { firstName: "Owen", lastName: "Fitzgerald", daysAgo: 6, plan: "Core Complete", reason: "Nutrition consultation", state: "FL", weight: 264, goal: 210, condition: "Sleep apnea", family: "Obesity", exercise: "None right now", tobacco: "Vape / e-cigarettes only" },
  { firstName: "Zoe", lastName: "Whitfield", daysAgo: 7, plan: "Core+", reason: "Follow-up visit", state: "TX", weight: 189, goal: 155, condition: "High blood pressure", family: "Stroke", exercise: "1-2 days per week", tobacco: "Never used tobacco" },
  { firstName: "Malik", lastName: "Johnson", daysAgo: 8, plan: "Core", reason: "Other", state: "GA", weight: 220, goal: 185, condition: "None of the above", family: "Diabetes", exercise: "5 or more days per week", tobacco: "Former smoker" },
  { firstName: "Isla", lastName: "MacLeod", daysAgo: 9, plan: "Core+", reason: "Weight loss consultation", state: "FL", weight: 205, goal: 165, condition: "Anxiety or depression", family: "Heart disease", exercise: "3-4 days per week", tobacco: "Never used tobacco" },
  { firstName: "Theo", lastName: "Papadakis", daysAgo: 10, plan: "Core Complete", reason: "General health check", state: "NY", weight: 252, goal: 200, condition: "Diabetes or prediabetes", family: "Diabetes", exercise: "None right now", tobacco: "Current smoker" },
  { firstName: "Nadia", lastName: "Hassan", daysAgo: 11, plan: "Core", reason: "Follow-up visit", state: "FL", weight: 183, goal: 150, condition: "PCOS", family: "Thyroid disorder", exercise: "1-2 days per week", tobacco: "Never used tobacco" },
  { firstName: "Leo", lastName: "Brennan", daysAgo: 12, plan: "Core+", reason: "Exercise program consultation", state: "SC", weight: 238, goal: 195, condition: "High cholesterol", family: "High blood pressure", exercise: "3-4 days per week", tobacco: "Former smoker" },
  { firstName: "Freya", lastName: "Solheim", daysAgo: 13, plan: "Core", reason: "Nutrition consultation", state: "FL", weight: 194, goal: 160, condition: "None of the above", family: "Cancer", exercise: "5 or more days per week", tobacco: "Never used tobacco" },
  { firstName: "Samuel", lastName: "Okoro", daysAgo: 14, plan: "Core Complete", reason: "Other", state: "GA", weight: 227, goal: 185, condition: "Kidney disease", family: "Obesity", exercise: "None right now", tobacco: "Never used tobacco" },
]

// Answers to the intake's newer questions, cycled so the charts have a spread.
const INTEREST = ["discuss", "unsure", "no", "discuss"]
const MEALS = ["3", "2", "It varies", "3", "4 or more", "1"]
const CALORIES = ["1,500 to 2,000", "2,000 to 2,500", "Not sure", "Over 2,500", "Under 1,500"]

export const TEMP_FAKE_RECORDS = RAW_ROWS.map((row, index) => ({
  id: `tmp-${index + 1}`,
  submittedAt: new Date(Date.now() - row.daysAgo * 86400000).toISOString(),
  demographics: {
    firstName: row.firstName,
    lastName: row.lastName,
    address: { state: row.state },
  },
  vitals: { currentWeightLb: String(row.weight), goalWeightLb: String(row.goal) },
  medicalHistory: { conditions: [row.condition], medicationInterest: INTEREST[index % INTEREST.length] },
  nutrition: { mealsPerDay: MEALS[index % MEALS.length], estimatedDailyCaloriesRange: CALORIES[index % CALORIES.length] },
  familyHistory: { conditions: [row.family] },
  socialHistory: { exerciseFrequency: row.exercise, tobacco: row.tobacco },
  // No plan: the intake no longer asks for one (data/pricingTiers.js).
  visit: { membershipPlan: "", reason: row.reason },
  consent: { telehealth: true, hipaaAcknowledged: true },
}))
