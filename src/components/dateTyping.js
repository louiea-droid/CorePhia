// The typed mm/dd/yyyy box in DatePicker. Month, day and year are kept as
// separate parts, so editing one never shifts digits into the others, and the
// caret stays where the patient was typing (2026-11-18: it used to re-flow all
// eight digits and jump to the end, so editing the month cleared the year).
// Pure, so dateTyping.check.js can run it in node.

const SIZES = [2, 2, 4]

const pad = (number) => String(number).padStart(2, "0")

// Digits only (typed from empty, or pasted): slashes go in as they fill.
function flow(raw, caret) {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  const text = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/")
  // After as many digits as were before the caret.
  let before = Math.min(raw.slice(0, caret).replace(/\D/g, "").length, digits.length)
  let position = 0
  while (before > 0) if (/\d/.test(text[position++])) before -= 1
  return { text, caret: position }
}

// prev: the box's text before this edit. raw and caret: the box right after
// it. deleting: "backward" (Backspace), "forward" (Delete) or false.
export function editTyped(prev, raw, caret, deleting = false) {
  // Backspace or Delete on a slash between parts removes the digit beside it
  // instead (the slash is structure). A trailing slash just goes.
  if (deleting && prev.length - raw.length === 1 && prev[caret] === "/" && caret < prev.length - 1) {
    if (deleting === "backward" && caret > 0) {
      raw = prev.slice(0, caret - 1) + prev.slice(caret)
      caret -= 1
    } else {
      raw = prev.slice(0, caret + 1) + prev.slice(caret + 2)
      caret += 1
    }
  }
  if (!raw.includes("/")) return flow(raw, caret)

  const parts = raw.split("/").slice(0, 3).map((part) => part.replace(/\D/g, ""))
  const beforeCaret = raw.slice(0, caret).split("/")
  let part = Math.min(beforeCaret.length - 1, 2)
  let offset = beforeCaret.at(-1).replace(/\D/g, "").length
  // A part typed past its size carries into the next one when that one is
  // still empty (typing straight through); otherwise the extra digit is dropped.
  for (let index = 0; index < parts.length; index++) {
    const size = SIZES[index]
    if (parts[index].length <= size) continue
    const extra = parts[index].slice(size)
    parts[index] = parts[index].slice(0, size)
    if (index < 2 && !parts[index + 1]) {
      parts[index + 1] = extra
      if (part === index && offset > size) {
        part = index + 1
        offset -= size
      }
    }
  }
  const text = parts.join("/")
  const start = parts.slice(0, part).reduce((sum, value) => sum + value.length + 1, 0)
  return { text, caret: start + Math.min(offset, parts[part]?.length ?? 0) }
}

// "02/15/1990" or "2/5/1990" -> "1990-02-15"; "" for anything unfinished or
// not a real day (02/30, 13/01), which leaves the hidden input empty so
// `required` catches it.
export function parseTyped(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (!match) return ""
  const [month, day, year] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  const real = year >= 1000 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return real ? `${year}-${pad(month)}-${pad(day)}` : ""
}

// The faint "mm/dd/yyyy" rest shows only while the parts are filled in
// order (a gap in the middle would put it in the wrong place).
export const hintFor = (text) =>
  /^(\d{0,2}|\d{2}\/\d{0,2}|\d{2}\/\d{2}\/\d{0,4})$/.test(text) ? "mm/dd/yyyy".slice(text.length) : ""
