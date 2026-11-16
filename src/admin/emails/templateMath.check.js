// Self-check for templateMath.js: `npm run check`.
import assert from "node:assert/strict"
import { diffWords, groupByPurpose, pickable, validateTemplate } from "./templateMath.js"

const text = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] }
const empty = { type: "doc", content: [{ type: "paragraph" }] }
const ok = { name: "N", purpose: "accepted", status: "published", isDefault: true, subject: "S", headline: "H", body: text }

assert.equal(validateTemplate(ok), null)
assert.ok(validateTemplate({ ...ok, name: " " }))
assert.ok(validateTemplate({ ...ok, subject: "" }))
assert.ok(validateTemplate({ ...ok, headline: "" }))
assert.equal(validateTemplate({ ...ok, status: "draft" }), "A default template has to be published.")
assert.equal(validateTemplate({ ...ok, purpose: "manual" }), "New email templates have no default.")
assert.equal(validateTemplate({ ...ok, isDefault: false, body: empty }), "Write a message first.")
assert.equal(validateTemplate({ ...ok, isDefault: false, status: "draft" }), null)

const t = (name, purpose, isDefault, status = "published") => ({ ...ok, name, purpose, isDefault, status })
const list = [t("B", "accepted", false), t("A", "accepted", false), t("Z", "accepted", true), t("D", "accepted", false, "draft"), t("M", "manual", false)]
const g = groupByPurpose(list)
assert.deepEqual(g.accepted.map((x) => x.name), ["Z", "A", "B", "D"])
assert.deepEqual(Object.keys(g), ["accepted", "declined", "welcome", "manual"])
assert.equal(g.declined.length, 0)
assert.deepEqual(pickable(list, "accepted").map((x) => x.name), ["Z", "A", "B"])

assert.deepEqual(diffWords("a b c", "a x c"), [
  { type: "same", text: "a" },
  { type: "remove", text: "b" },
  { type: "add", text: "x" },
  { type: "same", text: "c" },
])
console.log("templateMath: ok")
