// Self-check for dateTyping.js (run by npm run check).
import assert from "node:assert/strict"
import { editTyped, hintFor, parseTyped } from "./dateTyping.js"

// Insert `typed` at `at` (replacing `select` characters), as the browser would.
const type = (prev, at, typed, select = 0) =>
  editTyped(prev, prev.slice(0, at) + typed + prev.slice(at + select), at + typed.length)
const backspace = (prev, at) => editTyped(prev, prev.slice(0, at - 1) + prev.slice(at), at - 1, "backward")

// Typing straight through from empty.
let state = { text: "", caret: 0 }
for (const digit of "02151990") state = type(state.text, state.caret, digit)
assert.deepEqual(state, { text: "02/15/1990", caret: 10 })

// The reported bug: Backspace in the month edits the month, the caret stays.
assert.deepEqual(backspace("02/15/1990", 2), { text: "0/15/1990", caret: 1 })
assert.deepEqual(backspace("0/15/1990", 1), { text: "/15/1990", caret: 0 })
assert.deepEqual(type("/15/1990", 0, "5"), { text: "5/15/1990", caret: 1 })
assert.deepEqual(type("5/15/1990", 0, "0"), { text: "05/15/1990", caret: 1 })
assert.equal(parseTyped("5/15/1990"), "1990-05-15")

// Selecting the month and typing over it.
assert.deepEqual(type("02/15/1990", 0, "1", 2), { text: "1/15/1990", caret: 1 })

// Backspace right after a slash removes the digit before it, not the slash.
assert.deepEqual(editTyped("02/15/1990", "0215/1990", 2, "backward"), { text: "0/15/1990", caret: 1 })
// Delete right before a slash removes the digit after it.
assert.deepEqual(editTyped("02/15/1990", "0215/1990", 2, "forward"), { text: "02/5/1990", caret: 3 })
// A trailing slash just goes.
assert.deepEqual(backspace("02/", 3), { text: "02", caret: 2 })

// A full part ignores an extra digit instead of pushing into the next part.
assert.deepEqual(type("02/15/1990", 2, "5"), { text: "02/15/1990", caret: 2 })

// Pasting digits.
assert.deepEqual(type("", 0, "02151990"), { text: "02/15/1990", caret: 10 })

assert.equal(parseTyped("02/30/1990"), "")
assert.equal(parseTyped("02/15/199"), "")
assert.equal(hintFor("02/1"), "d/yyyy")
assert.equal(hintFor("5/15/1990"), "")

console.log("dateTyping: ok")
