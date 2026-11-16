// Pure helpers for the email templates page.
import { PURPOSES, plainText } from "../../../functions/emailRender.js"

export function validateTemplate(t) {
  if (!t.name?.trim()) return "Give the template a name."
  if (!t.subject?.trim()) return "Add a subject."
  if (!t.headline?.trim()) return "Add a headline."
  if (t.isDefault && t.status !== "published") return "A default template has to be published."
  if (t.isDefault && t.purpose === "manual") return "New email templates have no default."
  if (!plainText(t.body).trim()) return "Write a message first."
  return null
}

const byDefaultThenName = (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name)

export function groupByPurpose(templates) {
  const groups = Object.fromEntries(PURPOSES.map((p) => [p, []]))
  for (const t of templates) groups[t.purpose]?.push(t)
  for (const p of PURPOSES) groups[p].sort(byDefaultThenName)
  return groups
}

export const pickable = (templates, purpose) =>
  templates.filter((t) => t.purpose === purpose && t.status === "published").sort(byDefaultThenName)

// ponytail: O(n·m) LCS, fine for short emails
export function diffWords(a, b) {
  const x = a.split(/\s+/).filter(Boolean)
  const y = b.split(/\s+/).filter(Boolean)
  const lcs = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out = []
  let i = 0
  let j = 0
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { out.push({ type: "same", text: x[i++] }); j++ }
    else if (i < x.length && (j === y.length || lcs[i + 1][j] >= lcs[i][j + 1])) out.push({ type: "remove", text: x[i++] })
    else out.push({ type: "add", text: y[j++] })
  }
  return out
}
