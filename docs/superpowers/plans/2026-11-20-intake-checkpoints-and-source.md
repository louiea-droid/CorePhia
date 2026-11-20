# Intake checkpoints and source tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two encouraging checkpoint screens in the intake, and a `?src=` ad tag saved on the intake record.

**Architecture:** Checkpoints are ordinary entries in `SCREENS` with no inputs and `ready: () => true`; `question` may be a function of the answers. The source tag is cleaned by one pure function and written to `visit.source`; `firestore.rules` checks the same shape.

**Tech Stack:** React 19, Firestore rules, node `assert` self-checks.

**Spec:** `docs/superpowers/specs/2026-11-20-intake-checkpoints-and-source-design.md`

## Global Constraints

- Tag: lowercased, 1 to 40 characters of `a-z 0-9 - _`, else `""`.
- Checkpoint copy: no numbers except the patient's own lbs to goal, no medication names, no result promises, no em dashes; humanizer pass.
- Checkpoints sit in the section before them on the progress bar; never on the review.

## Review Focus

- `?src=IG` → saved as `ig`; `?src=<script>` or 41+ chars → `""` (Task 1 check).
- A record without `visit.source` (an old tab sending after deploy) is still accepted (Task 1 rules test).
- Exact goal with goal >= current weight → "Great goal." not "Great goal: 0 lbs." (Task 2, by hand).
- Reload on a checkpoint keeps the patient there and Continue still shows (Task 2, browser).
- Progress bar section tag stays on "Your goal" / "Lifestyle" on the checkpoints (Task 2, browser).

---

### Task 1: Source tag end to end

**Files:**
- Create: `src/lib/intakeSource.js`, `src/lib/intakeSource.check.js`
- Modify: `package.json` (`check`), `src/components/PatientIntakeForm.jsx` (`buildIntakeRecord(form, source)`), `firestore.rules` (`visit` keys), `tests/firestore.rules.test.js`, `src/admin/applicants/ApplicantModal.jsx` (Visit section), `src/admin/lib/seedRecords.js`, `src/pages/Legal.jsx` ("What we collect").

**Interfaces:** Produces `cleanSource(raw: string | null) => string`.

- [ ] Check: `cleanSource("IG") === "ig"`, `cleanSource(null) === ""`, `cleanSource("a b") === ""`, `cleanSource("x".repeat(41)) === ""`, `cleanSource("spring-promo_2") === "spring-promo_2"`. Run `node src/lib/intakeSource.check.js` → fails (no module).
- [ ] Implement; run → passes. Add to `npm run check`.
- [ ] Rules: `visit.keys().hasOnly([... 'source'])` and `visit.get('source', '') is string && visit.get('source', '').matches('[a-z0-9_-]{0,40}')`. Tests: accepts `source: "ig"`, accepts no `source`, refuses `"IG"`, `"x".repeat(41)`, `5`.
- [ ] Form passes `cleanSource(searchParams.get("src"))` to `buildIntakeRecord`, written as `visit.source`.
- [ ] Applicants: `{visit?.source && <Field label="Came from" value={visit.source} />}`. Seed: a few records get `ig`/`fb`/`google`.
- [ ] Privacy: add "and, if you came from one of our links or ads, a short tag naming which one" to the intake list.
- [ ] `npm run check`, `npm run test:rules`, `npm run lint` pass. Commit.

### Task 2: Checkpoint screens

**Files:** Modify `src/components/intakeScreens.jsx`, `src/components/PatientIntakeForm.jsx` (render `question` when it is a function).

- [ ] `lbsToGo(answers) => number` shared by `GoalReadout` and checkpoint 1.
- [ ] `checkpoint-goal` after `medication-interest`; `checkpoint-health` after `eating`; both `ready: () => true`, a short `render` with the lines; sections via `SECTION_BY_SCREEN` additions (`"Your goal"`, `"Lifestyle"`).
- [ ] Headline 1: exact goal with lbsToGo > 0 → `Great goal: ${n} lbs.`; `Not sure…` → "You're in the right place."; else "Great goal."
- [ ] Browser: walk the form on the dev build, check both screens, progress tag, reload, Back. Lint, build. Commit.
