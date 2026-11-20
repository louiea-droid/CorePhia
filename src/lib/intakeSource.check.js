// node src/lib/intakeSource.check.js — the ?src= ad tag the intake keeps.
import assert from "node:assert/strict"
import { cleanSource } from "./intakeSource.js"

assert.equal(cleanSource("IG"), "ig")
assert.equal(cleanSource("spring-promo_2"), "spring-promo_2")
assert.equal(cleanSource(null), "")
assert.equal(cleanSource(""), "")
assert.equal(cleanSource("a b"), "")
assert.equal(cleanSource("<script>"), "")
assert.equal(cleanSource("x".repeat(40)), "x".repeat(40))
assert.equal(cleanSource("x".repeat(41)), "")
console.log("intakeSource: ok")
