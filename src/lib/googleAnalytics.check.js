// node src/lib/googleAnalytics.check.js: Google Analytics may only run on public pages.
import assert from "node:assert/strict"
import { isTrackablePage } from "./googleAnalytics.js"

for (const path of ["/", "/about", "/faq", "/membership", "/programs/medical-care", "/guides/what-a-dietitian-does", "/privacy", "/privacy-practices", "/contact/"]) {
  assert.ok(isTrackablePage(path), path)
}
for (const path of ["/intake", "/intake/", "/account", "/account/messages", "/admin", "/admin/patients/x", "/portal/setup", "/portal/reset", "/pricing", "/programs", "/programs/a/b", "/nope"]) {
  assert.ok(!isTrackablePage(path), path)
}
console.log("googleAnalytics: all checks passed")
