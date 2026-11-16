import assert from "node:assert/strict"
import { renderTemplate, isAllowedLink, plainText } from "./emailRender.js"
import { DEFAULT_TEMPLATES } from "./emailDefaults.js"

const doc = (...content) => ({ type: "doc", content })
const p = (...content) => ({ type: "paragraph", content })
const t = (text, marks) => ({ type: "text", text, ...(marks && { marks }) })
const name = { type: "firstName" }

// first name, escaping, fixed lines
const r = renderTemplate({ subject: "Hi {firstName} & co", headline: "Thank you, {firstName}", body: doc(p(t("Dear "), name, t("."))) }, { firstName: "<Jo>" })
assert.equal(r.subject, "Hi <Jo> & co")
assert.ok(r.html.includes("Thank you, &lt;Jo&gt;"))
assert.ok(r.html.includes("Dear &lt;Jo&gt;."))
assert.ok(!r.html.includes("<Jo>"))
assert.ok(r.text.includes("Dear <Jo>."))
assert.ok(r.text.includes("Questions? Call us at +1 (866) 849-2673 or email care@corephia.com."))
assert.ok(r.text.includes("For your privacy, this email doesn't include any of your health information."))
// empty name falls back to "there"
assert.ok(renderTemplate({ subject: "s", headline: "Hi {firstName}", body: doc() }, { firstName: "  " }).html.includes("Hi there"))

// marks and lists
const marked = renderTemplate({ subject: "s", headline: "h", body: doc(
  p(t("b", [{ type: "bold" }]), t("i", [{ type: "italic" }]), t("u", [{ type: "underline" }])),
  { type: "bulletList", content: [{ type: "listItem", content: [p(t("one"))] }] },
  { type: "orderedList", content: [{ type: "listItem", content: [p(t("first"))] }] },
) }, { firstName: "A" })
for (const s of ["<strong>b</strong>", "<em>i</em>", "<u>u</u>", "<ul", "<ol", "one", "first"]) assert.ok(marked.html.includes(s), s)
assert.ok(marked.text.includes("- one") && marked.text.includes("1. first"))

// links: allowed vs not
assert.ok(isAllowedLink("https://corephia.com/guides/x"))
assert.ok(isAllowedLink("https://app.elationemr.com/membership/1"))
assert.ok(isAllowedLink("https://x.elationpassport.com/"))
for (const bad of ["http://corephia.com", "https://corephia.com.evil.io", "javascript:alert(1)", "https://evil.io"]) assert.equal(isAllowedLink(bad), false, bad)
const linked = renderTemplate({ subject: "s", headline: "h", body: doc(p(
  t("good", [{ type: "link", attrs: { href: "https://corephia.com/faq" } }]),
  t("bad", [{ type: "link", attrs: { href: "https://evil.io" } }]),
)) }, { firstName: "A" })
assert.ok(linked.html.includes('href="https://corephia.com/faq"'))
assert.ok(!linked.html.includes("evil.io") && linked.html.includes("bad"))

// hostile tree: unknown nodes and marks are ignored, their text kept
const hostile = renderTemplate({ subject: "s", headline: "h", body: doc(
  { type: "heading", content: [t("Big")] },
  { type: "image", attrs: { src: "https://evil.io/x.png" } },
  p(t("red", [{ type: "textStyle", attrs: { color: "red" } }])),
) }, { firstName: "A" })
assert.ok(hostile.html.includes("Big") && hostile.html.includes("red"))
assert.ok(!hostile.html.includes("img") && !hostile.html.includes("color:red") && !hostile.html.includes("evil.io"))

assert.equal(plainText(doc(p(t("a")), p(t("b")))), "a\n\nb")

// defaults: three, one per purpose, render without throwing, no em dashes
assert.deepEqual(DEFAULT_TEMPLATES.map((d) => d.purpose).sort(), ["accepted", "declined", "welcome"])
for (const d of DEFAULT_TEMPLATES) {
  const out = renderTemplate(d, { firstName: "Jane" })
  assert.ok(!/[—]/.test(out.text), d.name)
}
assert.ok(renderTemplate(DEFAULT_TEMPLATES.find((d) => d.purpose === "declined"), { firstName: "Jane" }).html.includes("<strong>Your card has not been charged, and it won't be.</strong>"))
console.log("emailRender: ok")
