// Self-check for chartMath.js: `npm run check`. No test framework in this
// repo, so plain node:assert. Each block names the behaviour it pins.
import assert from "node:assert/strict"
import {
  ageFrom,
  asDate,
  bmi,
  currentExercisePlan,
  currentPrescriptions,
  daysFrom,
  disciplineOf,
  dueTasks,
  latestSignedByDiscipline,
  nextFollowUps,
} from "./chartMath.js"

const signed = (signedAt, prescriptions) => ({ status: "signed", signedAt, prescriptions })
const start = (id, medication, renewalDue) => ({
  id,
  action: "start",
  medication,
  instructions: "1 weekly",
  startDate: "2026-10-01",
  renewalDue,
})

// A started prescription is current.
assert.deepEqual(
  currentPrescriptions([signed("2026-10-01T10:00:00Z", [start("a", "Med A", "2026-10-31")])]).map((p) => p.id),
  ["a"],
)

// Renewing moves the due date (and instructions when given) but keeps one entry.
{
  const notes = [
    signed("2026-10-01T10:00:00Z", [start("a", "Med A", "2026-10-31")]),
    signed("2026-10-30T10:00:00Z", [{ id: "r1", action: "renew", renewsId: "a", renewalDue: "2026-11-30" }]),
    signed("2026-11-29T10:00:00Z", [
      { id: "r2", action: "renew", renewsId: "r1", renewalDue: "2026-12-30", instructions: "2 weekly" },
    ]),
  ]
  const current = currentPrescriptions(notes)
  assert.equal(current.length, 1)
  assert.equal(current[0].renewalDue, "2026-12-30")
  assert.equal(current[0].instructions, "2 weekly")
  assert.equal(current[0].medication, "Med A")
}

// Stopping a renewal removes the whole chain.
assert.deepEqual(
  currentPrescriptions([
    signed("2026-10-01T10:00:00Z", [start("a", "Med A", "2026-10-31")]),
    signed("2026-10-30T10:00:00Z", [{ id: "r1", action: "renew", renewsId: "a", renewalDue: "2026-11-30" }]),
    signed("2026-11-10T10:00:00Z", [{ id: "s1", action: "stop", renewsId: "r1", stopReason: "Side effects" }]),
  ]),
  [],
)

// Drafts don't count; input order doesn't matter (sorted by signedAt).
{
  const notes = [
    signed("2026-11-10T10:00:00Z", [{ id: "s1", action: "stop", renewsId: "a" }]),
    { status: "draft", signedAt: null, prescriptions: [start("d", "Draft med", "2026-12-01")] },
    signed("2026-10-01T10:00:00Z", [start("a", "Med A", "2026-10-31"), start("b", "Med B", "2026-11-15")]),
  ]
  assert.deepEqual(
    currentPrescriptions(notes).map((p) => p.id),
    ["b"],
  )
}

// Firestore Timestamps (with toMillis) sort too.
assert.equal(
  currentPrescriptions([
    { status: "signed", signedAt: { toMillis: () => 2 }, prescriptions: [{ id: "s", action: "stop", renewsId: "a" }] },
    { status: "signed", signedAt: { toMillis: () => 1 }, prescriptions: [start("a", "Med A", "2026-10-31")] },
  ]).length,
  0,
)

// BMI: missing height or weight gives null, never NaN.
assert.equal(bmi("", "", 200), null)
assert.equal(bmi("5", "10", ""), null)
assert.equal(bmi("5", "10", 220), 31.6)
assert.equal(bmi("6", "", 180), 24.4)

// Age: whole years; a birthday later this year hasn't happened yet.
assert.equal(ageFrom(""), null)
assert.equal(ageFrom("not a date"), null)
assert.equal(ageFrom("1983-10-01", new Date("2026-10-01T12:00:00")), 43)
assert.equal(ageFrom("1983-10-02", new Date("2026-10-01T12:00:00")), 42)

// asDate: Firestore Timestamp, Date, ISO string, or nothing.
assert.equal(asDate({ toDate: () => new Date(5) }).getTime(), 5)
assert.equal(asDate(new Date(7)).getTime(), 7)
assert.equal(asDate("2026-10-01T00:00:00Z").getUTCDate(), 1)
assert.equal(asDate(null), null)
assert.equal(asDate("garbage"), null)

// dueTasks: the To-do page's items for one patient, as of `today`.
const visit = (visitDate, extra = {}) => ({ status: "signed", visitDate, signedAt: `${visitDate}T12:00:00Z`, ...extra })
const summary = (tasks) => tasks.map((task) => `${task.kind}:${task.medication ?? ""}:${task.days ?? ""}`)

// Renewals due within 7 days or overdue show; later ones don't; days is signed.
assert.deepEqual(
  summary(
    dueTasks(
      [
        visit("2026-09-01", {
          prescriptions: [
            start("a", "Med A", "2026-09-28"),
            start("b", "Med B", "2026-10-08"),
            start("c", "Med C", "2026-10-09"),
            start("d", "Med D", ""),
          ],
        }),
      ],
      "2026-10-01",
    ),
  ),
  ["renewal:Med A:-3", "renewal:Med B:7"],
)

// A stopped prescription needs no renewal.
assert.deepEqual(
  dueTasks(
    [
      visit("2026-09-01", { prescriptions: [start("a", "Med A", "2026-10-02")] }),
      visit("2026-09-15", { prescriptions: [{ id: "s", action: "stop", renewsId: "a" }] }),
    ],
    "2026-10-01",
  ),
  [],
)

// The follow-up comes from the latest signed visit only: a newer visit with no
// follow-up date clears an older one, and drafts don't count.
assert.deepEqual(summary(dueTasks([visit("2026-09-01", { nextFollowUp: "2026-10-01" })], "2026-10-01")), ["followUp::0"])
assert.deepEqual(
  dueTasks([visit("2026-09-01", { nextFollowUp: "2026-10-01" }), visit("2026-09-20", { nextFollowUp: "" })], "2026-10-01"),
  [],
)
assert.deepEqual(
  summary(
    dueTasks(
      [
        visit("2026-09-01", { nextFollowUp: "2026-10-03" }),
        { status: "draft", visitDate: "2026-09-30", nextFollowUp: "", prescriptions: [] },
      ],
      "2026-10-01",
    ),
  ),
  ["followUp::2"],
)

// No signed note at all means the first consultation is still to happen.
assert.deepEqual(summary(dueTasks([], "2026-10-01")), ["firstConsult::"])
assert.deepEqual(summary(dueTasks([{ status: "draft", visitDate: "2026-10-01" }], "2026-10-01")), ["firstConsult::"])

// Day counts are calendar days, unaffected by the November DST change.
assert.deepEqual(summary(dueTasks([visit("2026-10-01", { nextFollowUp: "2026-11-02" })], "2026-10-31")), ["followUp::2"])

// Disciplines: consultation and progress (and old notes with no type) are medical.
assert.equal(disciplineOf("consultation"), "medical")
assert.equal(disciplineOf("progress"), "medical")
assert.equal(disciplineOf(undefined), "medical")
assert.equal(disciplineOf("dietitian"), "dietitian")
assert.equal(disciplineOf("exercise"), "exercise")

assert.equal(daysFrom("2026-10-01", "2026-10-04"), 3)

// The latest signed note per discipline; drafts ignored.
{
  const notes = [
    visit("2026-09-01", { type: "consultation", id: "c" }),
    visit("2026-09-20", { type: "dietitian", id: "d1" }),
    visit("2026-09-25", { type: "dietitian", id: "d2" }),
    { status: "draft", type: "exercise", visitDate: "2026-09-30", id: "x" },
  ]
  const latest = latestSignedByDiscipline(notes)
  assert.equal(latest.medical.id, "c")
  assert.equal(latest.dietitian.id, "d2")
  assert.equal(latest.exercise, undefined)
}

// The exercise plan stands from the latest signed exercise note.
{
  const plan = { daysPerWeek: 4, intensity: "moderate", minutesPerSession: 30, kind: "Walking", notes: "" }
  assert.deepEqual(currentExercisePlan([visit("2026-09-01", { type: "exercise", exercisePlan: plan })]), plan)
  assert.equal(currentExercisePlan([visit("2026-09-01", { type: "progress" })]), null)
}

// One next follow-up per discipline, each from its own latest note.
assert.deepEqual(
  nextFollowUps([
    visit("2026-09-01", { type: "progress", nextFollowUp: "2026-10-03" }),
    visit("2026-09-20", { type: "dietitian", nextFollowUp: "2026-10-02" }),
    visit("2026-09-22", { type: "exercise", nextFollowUp: "" }),
  ]),
  [
    { discipline: "medical", date: "2026-10-03" },
    { discipline: "dietitian", date: "2026-10-02" },
  ],
)

// To-do: a newer dietitian note doesn't clear the medical follow-up, and each
// discipline's follow-up shows separately with its discipline.
{
  const tasks = dueTasks(
    [
      visit("2026-09-01", { type: "consultation", nextFollowUp: "2026-10-03" }),
      visit("2026-09-20", { type: "dietitian", nextFollowUp: "2026-10-02" }),
    ],
    "2026-10-01",
  )
  assert.deepEqual(
    tasks.map((task) => `${task.kind}:${task.discipline}:${task.days}`),
    ["followUp:medical:2", "followUp:dietitian:1"],
  )
}

// Only a dietitian note signed: the first consultation is still to happen,
// and the dietitian follow-up still shows.
assert.deepEqual(
  dueTasks([visit("2026-09-20", { type: "dietitian", nextFollowUp: "2026-10-02" })], "2026-10-01").map(
    (task) => `${task.kind}:${task.discipline}`,
  ),
  ["followUp:dietitian", "firstConsult:medical"],
)

// Renewals are medical.
assert.equal(
  dueTasks([visit("2026-09-01", { prescriptions: [start("a", "Med A", "2026-10-02")] })], "2026-10-01")[0].discipline,
  "medical",
)

console.log("chartMath: all checks passed")
