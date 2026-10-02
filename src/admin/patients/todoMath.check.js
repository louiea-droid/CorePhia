// Self-check for todoMath.js: `npm run check`.
import assert from "node:assert/strict"
import { groupTodos } from "./todoMath.js"

const now = new Date("2026-10-02T15:00:00Z")
const item = (id, extra = {}) => ({ id, due: "", done: null, createdAt: new Date("2026-09-01T00:00:00Z"), ...extra })
const ids = (list) => list.map((todo) => todo.id)

const groups = groupTodos(
  [
    item("past", { due: "2026-09-28" }),
    item("today", { due: "2026-10-02" }),
    item("soon", { due: "2026-10-05" }),
    item("edge", { due: "2026-10-09" }),
    item("later", { due: "2026-10-10" }),
    item("undated-new", { createdAt: new Date("2026-09-20T00:00:00Z") }),
    item("undated-old", { createdAt: new Date("2026-09-10T00:00:00Z") }),
    item("done-recent", { done: { uid: "u", name: "U", at: new Date("2026-10-01T10:00:00Z") } }),
    item("done-older", { done: { uid: "u", name: "U", at: new Date("2026-09-20T10:00:00Z") } }),
    item("done-stale", { done: { uid: "u", name: "U", at: new Date("2026-08-31T10:00:00Z") } }),
  ],
  "2026-10-02",
  now,
)
// Past due is overdue; today; within 7 days; beyond 7 days.
assert.deepEqual(ids(groups.overdue), ["past"])
assert.deepEqual(ids(groups.today), ["today"])
assert.deepEqual(ids(groups.week), ["soon", "edge"])
assert.deepEqual(ids(groups.later), ["later"])
// No date: oldest first.
assert.deepEqual(ids(groups.undated), ["undated-old", "undated-new"])
// Done: newest first, older than 30 days hidden.
assert.deepEqual(ids(groups.done), ["done-recent", "done-older"])
// A done item never also shows as open, whatever its due date.
assert.equal(groupTodos([item("x", { due: "2026-09-01", done: { at: now } })], "2026-10-02", now).overdue.length, 0)

console.log("todoMath: all checks passed")
