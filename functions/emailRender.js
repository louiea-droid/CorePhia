// Turns a stored email template into subject, HTML and text. Pure and
// browser-safe (no node: imports): the admin preview and the Cloud Function
// both import it, so what staff see is what is sent. The body is TipTap JSON
// and is never trusted: only the nodes and marks below render; anything else
// is dropped and its text kept. Health details never go in an email.
// Same number as SUPPORT_PHONE in src/lib/siteContact.js; change both together.
export const PHONE = "+1 (866) 849-2673"

export const PURPOSES = ["accepted", "declined", "welcome", "manual"]
export const PURPOSE_LABELS = { accepted: "Accepted", declined: "Declined", welcome: "Welcome", manual: "New email" }

// Appended to every email, not editable.
const FIXED_LINES = [
  `Questions? Call us at ${PHONE} or email care@corephia.com.`,
  "For your privacy, this email doesn't include any of your health information.",
]

// The card shell around an already-built HTML body (a white card on the
// site's paper-50 background, with a brand-blue band on top and a serif
// headline; Georgia because the site's Fraunces doesn't load in Gmail). Tables,
// not divs, so Outlook lays it out too (it drops the rounded corners).
export function layoutHtml(title, innerHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7fb">
<tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #dde3ee;border-radius:16px;border-collapse:separate;overflow:hidden">
<tr><td height="5" style="height:5px;line-height:5px;font-size:0;background:#3b5bdb">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0d1a3d">
<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;font-weight:normal;color:#0d1a3d">${title}</h1>
${innerHtml}
</td></tr>
</table>
</td></tr>
</table>`
}

// A headline, paragraphs, the button, then any paragraphs after it.
export function layout({ title, paragraphs, button, after = [] }) {
  const text = [title, ...paragraphs, ...(button ? [`${button.label}: ${button.url}`] : []), ...after].join("\n\n")
  const p = (body) => `<p style="margin:0 0 16px">${body}</p>`
  const inner = `${paragraphs.map(p).join("\n")}
${button ? `<p style="margin:24px 0 16px"><a href="${button.url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">${button.label}</a></p>` : ""}
${after.map(p).join("\n")}`
  return { text, html: layoutHtml(title, inner) }
}

// Apostrophes are left alone: they are safe in text, and attributes use double quotes.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// https only: corephia.com, and Elation's own hosts. Anything else is plain text.
export function isAllowedLink(href) {
  let u
  try { u = new URL(href) } catch { return false }
  if (u.protocol !== "https:") return false
  const h = u.hostname.toLowerCase()
  return h === "corephia.com" || h === "www.corephia.com" || h.endsWith(".elationemr.com") || h.endsWith(".elationpassport.com")
}

const kids = (n) => (Array.isArray(n?.content) ? n.content : [])

function inlineHtml(n, name) {
  if (n.type === "text") {
    let out = esc(n.text ?? "")
    const marks = Array.isArray(n.marks) ? n.marks : []
    const types = marks.map((m) => m?.type)
    const link = marks.find((m) => m?.type === "link")
    // Innermost first, fixed order: link, underline, italic, bold.
    if (link && typeof link.attrs?.href === "string" && isAllowedLink(link.attrs.href)) {
      out = `<a href="${esc(link.attrs.href)}" style="color:#2563eb">${out}</a>`
    }
    if (types.includes("underline")) out = `<u>${out}</u>`
    if (types.includes("italic")) out = `<em>${out}</em>`
    if (types.includes("bold")) out = `<strong>${out}</strong>`
    return out
  }
  if (n.type === "firstName") return esc(name)
  if (n.type === "hardBreak") return "<br>"
  return kids(n).map((c) => inlineHtml(c, name)).join("")
}

// A list item's paragraphs run inline (a <br> between them); a nested list
// renders as its own list inside the item.
const itemHtml = (li, name) =>
  kids(li)
    .map((c, i) => (c.type === "paragraph" ? `${i ? "<br>" : ""}${inlineHtml(c, name)}` : blockHtml(c, name, true)))
    .join("")

function blockHtml(n, name, nested = false) {
  switch (n.type) {
    case "paragraph":
      return `<p style="margin:0 0 16px">${kids(n).map((c) => inlineHtml(c, name)).join("")}</p>`
    case "bulletList":
    case "orderedList": {
      const tag = n.type === "bulletList" ? "ul" : "ol"
      const items = kids(n).map((li) => `<li>${itemHtml(li, name)}</li>`).join("")
      return `<${tag} style="margin:${nested ? "4px 0 0" : "0 0 16px"};padding-left:22px">${items}</${tag}>`
    }
    default:
      // Unknown node (heading, image, ...): keep any text, drop the element.
      return kids(n).map((c) => blockHtml(c, name)).join("") || inlineHtml(n, name)
  }
}

function inlineText(n, name) {
  if (n.type === "text") return n.text ?? ""
  if (n.type === "firstName") return name
  if (n.type === "hardBreak") return "\n"
  return kids(n).map((c) => inlineText(c, name)).join("")
}

const INDENT = "   "

function blockText(n, name, indent = "") {
  switch (n.type) {
    case "bulletList":
    case "orderedList":
      // The item's first paragraph takes the marker; later ones and nested lists sit indented under it.
      return kids(n)
        .map((li, i) => {
          const marker = n.type === "bulletList" ? "-" : `${i + 1}.`
          return kids(li)
            .map((c, j) => {
              const inner = blockText(c, name, indent + INDENT)
              if (c.type === "bulletList" || c.type === "orderedList") return inner
              return (j ? indent + INDENT : `${indent}${marker} `) + inner
            })
            .join("\n")
        })
        .join("\n")
    case "paragraph":
      return inlineText(n, name)
    default:
      return kids(n).map((c) => blockText(c, name)).join("\n\n") || inlineText(n, name)
  }
}

// Paragraphs joined by a blank line, list items prefixed; used for the text part and diffs.
// Without a name, the first-name chip reads as {firstName}.
export function plainText(body, name = "{firstName}") {
  return kids(body).map((n) => blockText(n, name)).join("\n\n")
}

const fill = (s, name) => String(s ?? "").split("{firstName}").join(name)

// Anyone can send the form, so the Welcome receipt would carry whatever was
// typed as a first name. Only a name-shaped one goes in an email: a letter,
// then letters, spaces, apostrophes, dots or hyphens, 40 at most.
export function safeFirstName(firstName) {
  const name = String(firstName ?? "").normalize("NFC").replace(/\s+/g, " ").trim()
  return /^\p{L}[\p{L}' .-]{0,39}$/u.test(name) ? name : "there"
}

export function renderTemplate(template, { firstName } = {}) {
  const name = safeFirstName(firstName)
  const title = fill(template.headline, name)
  const inner = [
    ...kids(template.body).map((n) => blockHtml(n, name)),
    ...FIXED_LINES.map((l) => `<p style="margin:0 0 16px">${esc(l)}</p>`),
  ].join("\n")
  return {
    subject: fill(template.subject, name),
    html: layoutHtml(esc(title), inner),
    text: [title, plainText(template.body, name), ...FIXED_LINES].filter(Boolean).join("\n\n"),
  }
}
