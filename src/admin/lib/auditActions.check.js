// firestore.rules only accepts audit entries whose action is in its own list
// (isOwnAuditEntry). If AUDIT_ACTIONS in firebase.js gains one the rules don't
// know, that audit write is refused and only logged to the console, so the
// trail quietly misses it. This keeps the two lists equal. Reads both files as
// text, since firebase.js imports the Firebase SDK. Run: node src/admin/lib/auditActions.check.js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")

const appBlock = read("./firebase.js").match(/export const AUDIT_ACTIONS = \{([\s\S]*?)\}/)[1]
const app = [...appBlock.matchAll(/:\s*"([a-z_]+)"/g)].map((match) => match[1]).sort()

const rulesBlock = read("../../../firestore.rules").match(/data\.action in \[([\s\S]*?)\]/)[1]
const rules = [...rulesBlock.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort()

assert.ok(app.length > 0, "found no AUDIT_ACTIONS")
assert.deepEqual(rules, app, "firestore.rules isOwnAuditEntry action list differs from AUDIT_ACTIONS")

console.log("auditActions: all checks passed")
