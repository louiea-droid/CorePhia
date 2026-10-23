// node src/lib/googleAnalytics.check.js: Google Analytics may only run on public pages.
import assert from "node:assert/strict"
import { guardHistory, isTrackablePage } from "./googleAnalytics.js"

for (const path of ["/", "/about", "/faq", "/membership", "/programs/medical-care", "/guides/what-a-dietitian-does", "/privacy", "/privacy-practices", "/contact/"]) {
  assert.ok(isTrackablePage(path), path)
}
for (const path of ["/intake", "/intake/", "/account", "/account/messages", "/admin", "/admin/patients/x", "/portal/setup", "/portal/reset", "/pricing", "/programs", "/programs/a/b", "/nope"]) {
  assert.ok(!isTrackablePage(path), path)
}
// Google's own page-change tracking reacts to the address changing, so the
// off switch must already be set for the destination when it changes.
const FLAG = "ga-disable-G-180FKQGVY5"
const fakeWindow = () => {
  const win = { listeners: [], seen: [] }
  win.location = { href: "https://corephia.com/membership", pathname: "/membership" }
  const move = (url) => {
    const next = new URL(url, win.location.href)
    win.location = { href: next.href, pathname: next.pathname }
    win.seen.push([next.pathname, win[FLAG]]) // what Google's listener would see
  }
  win.history = { pushState: (state, title, url) => move(url), replaceState: (state, title, url) => move(url) }
  win.addEventListener = (type, listener) => win.listeners.push([type, listener])
  return win
}
const win = fakeWindow()
guardHistory(win, () => true) // the visitor pressed Accept
win.history.pushState(null, "", "/intake")
win.history.pushState(null, "", "/about")
win.history.replaceState(null, "", "/account/messages?x=1")
win.history.pushState(null, "", "programs/medical-care") // relative to /account/
assert.deepEqual(win.seen, [["/intake", true], ["/about", false], ["/account/messages", true], ["/account/programs/medical-care", true]])
// Back and Forward: the address has changed already, before any listener runs.
win.location = { href: "https://corephia.com/admin", pathname: "/admin" }
win[FLAG] = false
for (const [type, listener] of win.listeners) if (type === "popstate") listener()
assert.equal(win[FLAG], true, "Back to /admin turns tracking off")
// Wrapping twice must not stack.
guardHistory(win)
assert.equal(win.listeners.filter(([type]) => type === "popstate").length, 1)
// Declined after accepting: a public page must not switch tracking back on.
const declined = fakeWindow()
guardHistory(declined, () => false)
declined.history.pushState(null, "", "/about")
assert.deepEqual(declined.seen, [["/about", true]])

console.log("googleAnalytics: all checks passed")
