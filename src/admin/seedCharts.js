// Demo-mode charts (usingSeedData only). Imported dynamically: Vite still
// emits it as its own chunk in dist/, but a production build never loads it,
// because usingSeedData is false there. One chart per admitted seed record, with a
// signed consultation, a signed progress note carrying an addendum, and a
// prescription due for renewal inside a week, so every part of the chart
// page has something real-looking to show.

const DAY = 86400000
const isoDay = (ms) => new Date(ms).toLocaleDateString("en-CA")

const PROVIDER = { uid: "demo-admin", name: "Dr. Antonious", role: "admin" }

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
      notes.set(record.id, [consult, progress])
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

  const staff = [
    { uid: "demo-super", name: "Hyacinth team", email: "team@hyacinth.example", role: "superAdmin", addedAt: null },
    { uid: PROVIDER.uid, name: PROVIDER.name, email: "provider@corephia.example", role: "admin", addedAt: null },
    { uid: "demo-provider", name: "Jordan Lee, NP", email: "jordan@corephia.example", role: "provider", addedAt: new Date(now - 12 * DAY) },
  ]

  return { charts, notes, amendments, staff }
}
