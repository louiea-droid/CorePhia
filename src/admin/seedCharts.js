// Demo-mode charts (usingSeedData only). Imported dynamically: Vite still
// emits it as its own chunk in dist/, but a production build never loads it,
// because usingSeedData is false there. One chart per admitted seed record, with a
// signed consultation, a signed progress note carrying an addendum, and a
// prescription due for renewal inside a week, so every part of the chart
// page has something real-looking to show.

import { addDays, changeFor, fromTampa, todayInTampa } from "./calendarMath"

const DAY = 86400000
const isoDay = (ms) => new Date(ms).toLocaleDateString("en-CA")

const PROVIDER = { uid: "demo-admin", name: "Dr. Antonious", role: "admin" }
const DIETITIAN = { uid: "demo-dietitian", name: "Sam Rivera, RD", role: "dietitian" }

export function buildDemoStore(records) {
  const now = Date.now()
  const charts = new Map()
  const notes = new Map()
  const amendments = new Map()

  records
    .filter((record) => record.status === "admitted")
    .forEach((record, index) => {
      const admitted = now - (40 + index * 9) * DAY
      const consultAt = admitted + 2 * DAY
      const progressAt = consultAt + 30 * DAY
      const weight = Number(record.vitals?.currentWeightLb) || 220
      const startId = `${record.id}-rx1`

      const consult = {
        id: `${record.id}-n1`,
        type: "consultation",
        status: "signed",
        authorUid: PROVIDER.uid,
        authorName: PROVIDER.name,
        authorRole: PROVIDER.role,
        createdAt: new Date(consultAt),
        updatedAt: new Date(consultAt),
        visitDate: isoDay(consultAt),
        sections: {
          chiefConcern: "Wants to lose weight and keep it off.",
          hpi: "Weight has climbed steadily over five years. Tried calorie counting twice, lost 15 lbs each time, regained it.",
          intervalHistory: "",
          pertinentHistory: (record.medicalHistory?.conditions ?? []).filter((c) => c !== "None of the above").join(", ") || "No conditions reported on the intake.",
          assessment: "Obesity, motivated, good candidate for the full program.",
          plan: "Start dietitian plan and the comprehensive exercise plan. Begin medication, review in 30 days.",
        },
        vitals: { weightLb: weight, systolic: 132, diastolic: 84, heartRate: 76 },
        prescriptions: [
          {
            id: startId,
            action: "start",
            medication: "Sample medication",
            instructions: "Starting dose once weekly",
            startDate: isoDay(consultAt),
            renewalDue: isoDay(consultAt + 30 * DAY),
            stopReason: "",
            renewsId: "",
          },
        ],
        nextFollowUp: isoDay(progressAt),
        signedAt: new Date(consultAt + 3600000),
        signedBy: PROVIDER,
      }

      const progress = {
        ...consult,
        id: `${record.id}-n2`,
        type: "progress",
        createdAt: new Date(progressAt),
        updatedAt: new Date(progressAt),
        visitDate: isoDay(progressAt),
        sections: {
          chiefConcern: "",
          hpi: "",
          intervalHistory: "Following the meal plan most days, walking 4 times a week.",
          pertinentHistory: "",
          assessment: "Good early response, tolerating medication.",
          plan: "Continue. Increase activity to 5 days.",
        },
        vitals: { weightLb: weight - 9, systolic: 126, diastolic: 80, heartRate: 72 },
        prescriptions: [
          {
            id: `${record.id}-rx2`,
            action: "renew",
            medication: "",
            instructions: "",
            startDate: "",
            // Spread from 2 days overdue to 3 days out, for the To-do page.
            renewalDue: isoDay(now + ((index % 6) - 2) * DAY),
            stopReason: "",
            renewsId: startId,
          },
        ],
        nextFollowUp: isoDay(now + (index % 2 ? 20 : 3) * DAY),
        signedAt: new Date(progressAt + 3600000),
      }

      const extra = []
      if (index % 2 === 0) {
        const dietAt = consultAt + 7 * DAY
        extra.push({
          ...consult,
          id: `${record.id}-n3`,
          type: "dietitian",
          authorUid: DIETITIAN.uid,
          authorName: DIETITIAN.name,
          authorRole: DIETITIAN.role,
          createdAt: new Date(dietAt),
          updatedAt: new Date(dietAt),
          visitDate: isoDay(dietAt),
          sections: {
            ...consult.sections,
            chiefConcern: "",
            hpi: "",
            pertinentHistory: "",
            plan: "",
            dietHistory: "Two meals a day, skips breakfast, snacks in the evening.",
            assessment: "Low protein early in the day, large evening intake.",
            goals: "Three meals a day, protein at breakfast.",
            mealPlan: "1,600 kcal plan, 30 g protein per meal. Swap evening snacks for a planned dinner.",
          },
          vitals: { weightLb: weight - 4, systolic: null, diastolic: null, heartRate: null },
          prescriptions: [],
          // The first chart's dietitian follow-up lands this week, for To-do.
          nextFollowUp: isoDay(now + (index === 0 ? 2 : 25) * DAY),
          signedAt: new Date(dietAt + 3600000),
          signedBy: DIETITIAN,
        })
      }
      if (index % 3 === 0) {
        const exerciseAt = consultAt + 10 * DAY
        extra.push({
          ...consult,
          id: `${record.id}-n4`,
          type: "exercise",
          createdAt: new Date(exerciseAt),
          updatedAt: new Date(exerciseAt),
          visitDate: isoDay(exerciseAt),
          sections: {
            ...consult.sections,
            chiefConcern: "",
            hpi: "",
            pertinentHistory: "",
            assessment: "",
            plan: "",
            activityLevel: "Walks the dog twice a week.",
            limitations: "Left knee pain on stairs.",
            goals: "Build to 150 minutes a week.",
          },
          exercisePlan: {
            daysPerWeek: 4,
            intensity: "moderate",
            minutesPerSession: 30,
            kind: "Brisk walking, low-impact cycling",
            notes: "Avoid deep squats until the knee settles.",
          },
          vitals: { weightLb: weight - 5, systolic: null, diastolic: null, heartRate: null },
          prescriptions: [],
          nextFollowUp: isoDay(now + 12 * DAY),
          signedAt: new Date(exerciseAt + 3600000),
        })
      }

      charts.set(record.id, {
        id: record.id,
        intakeRecordId: record.id,
        firstName: record.demographics?.firstName ?? "",
        lastName: record.demographics?.lastName ?? "",
        dateOfBirth: record.demographics?.dateOfBirth ?? "",
        sexAssignedAtBirth: record.demographics?.sexAssignedAtBirth ?? "",
        status: "active",
        admittedAt: new Date(admitted),
        admittedBy: PROVIDER,
        updatedAt: progress.signedAt,
        lastNote: { type: "progress", signedAt: progress.signedAt },
      })
      notes.set(record.id, [consult, progress, ...extra])
      amendments.set(consult.id, [
        {
          id: `${consult.id}-a1`,
          text: "Correction: blood pressure was taken after the walk in, recheck at next visit.",
          authorUid: PROVIDER.uid,
          authorName: PROVIDER.name,
          authorRole: PROVIDER.role,
          at: new Date(consultAt + 7200000),
        },
      ])
    })

  // A week of appointments across the first few charts, with one moved and
  // one cancelled so the History list has something to show. The last
  // chart's medical follow-up is left unbooked, for the calendar marker.
  const today = todayInTampa()
  const chartIds = [...charts.keys()]
  const appointments = []
  const appointmentChanges = new Map()
  const SLOTS = [
    [0, "09:00", "medical", PROVIDER],
    [0, "10:30", "dietitian", DIETITIAN],
    [1, "14:00", "exercise", PROVIDER],
    [2, "11:00", "medical", PROVIDER],
    [3, "09:30", "dietitian", DIETITIAN],
  ]
  SLOTS.forEach(([offset, time, discipline, staffMember], index) => {
    const chartId = chartIds[index % Math.max(1, chartIds.length - 1)]
    if (!chartId) return
    const chart = charts.get(chartId)
    appointments.push({
      id: `demo-appt-${index}`,
      intakeId: chartId,
      patientName: `${chart.firstName} ${chart.lastName}`.trim(),
      staffUid: staffMember.uid,
      staffName: staffMember.name,
      discipline,
      start: fromTampa(addDays(today, offset), time),
      minutes: 30,
      status: "scheduled",
      note: "",
      addedBy: { uid: "demo-super", name: "Hyacinth team", role: "superAdmin" },
      addedAt: new Date(now - 3 * DAY),
      updatedAt: new Date(now - 3 * DAY),
    })
  })
  if (appointments[0]) {
    const before = appointments[0]
    const patch = { start: fromTampa(addDays(today, 1), "09:00") }
    const change = changeFor(before, patch)
    appointmentChanges.set(before.id, [{ id: "demo-change-0", ...change, by: PROVIDER, at: new Date(now - DAY) }])
    Object.assign(before, patch, { lastChangeId: "demo-change-0" })
  }
  if (appointments[3]) {
    const change = changeFor(appointments[3], { status: "cancelled" }, "Patient asked to move to next week")
    appointmentChanges.set(appointments[3].id, [{ id: "demo-change-1", ...change, by: PROVIDER, at: new Date(now - 2 * DAY) }])
    Object.assign(appointments[3], { status: "cancelled", lastChangeId: "demo-change-1" })
  }

  const staff = [
    { uid: "demo-super", name: "Hyacinth team", email: "team@hyacinth.example", role: "superAdmin", addedAt: null },
    { uid: PROVIDER.uid, name: PROVIDER.name, email: "provider@corephia.example", role: "admin", addedAt: null },
    { uid: "demo-provider", name: "Jordan Lee, NP", email: "jordan@corephia.example", role: "provider", addedAt: new Date(now - 12 * DAY) },
    { uid: "demo-dietitian", name: "Sam Rivera, RD", email: "sam@corephia.example", role: "dietitian", addedAt: new Date(now - 5 * DAY) },
  ]

  return { charts, notes, amendments, staff, appointments, appointmentChanges }
}
