# Intake checkpoints and ad source tags (2026-11-20)

From the 2026-11-20 meeting (`docs/meeting-analysis.md` §9, items 1 to 3). Small change.

## Why

Dr. Antonious wants ads to send people straight to the form, and the form to feel encouraging
and informative ("great job, that's a great goal") while staying quick. Louie also wants to know
which ad brought each applicant.

## Approaches (Louie picked B, 2026-11-20)

- A. Inline lines only (encouragement in the goal readout, "why we ask" under questions). No
  added time, but easy to miss.
- **B. Two checkpoint screens between sections, with the encouragement and short information.**
  The Hims/Noom feel he described; adds two taps.
- Pausing auto-advance after each tap to show a reply: rejected, slows every screen.

## Design

### Checkpoint screens

- Two screens with no inputs, a headline, two short lines and Continue:
  1. after the last "Your goal" screen (`medication-interest`), before the health questions;
  2. after the last "Lifestyle" screen (`eating`), before "About you".
- Headline 1 is personal: an exact goal gives "Great goal: {n} lbs." (n as in the goal
  readout); a range gives "Great goal."; "Not sure" gives "You're in the right place."
  Headline 2: "Nice work. The health questions are done."
- Copy says what the program does (provider, dietitian, exercise plan work together; the
  provider reviews every answer before the first visit; what comes next). No numbers, no
  medication names, no promises of results. Draft wording; **Dr. Antonious approves it before
  real patients.**
- Each checkpoint belongs to the section before it on the progress bar (sections stay
  contiguous). Not on the review screen, nothing saved.
- Never praise a health answer: no replies after conditions, medications or family history.
- The goal readout ("That's 30 lbs to your goal.") stays as it is, so "great goal" is said
  once, on the checkpoint.

### Source tags

- Ad links use `/intake?src=<tag>`, e.g. `?src=ig`, `?src=fb`, `?src=google`, `?src=flyer`.
  Any tag works; nothing to set up per ad.
- The form keeps the tag only if it is 1 to 40 characters of `a-z`, `0-9`, `-`, `_`
  (lowercased first); anything else is dropped. Saved as `visit.source` ("" when none).
- `firestore.rules` allows `visit.source` with the same pattern and length.
- Applicants shows it on the record (e.g. "Came from: ig"). Admin seed data gets a few values.
- Privacy policy: one line saying the form records which link the visitor came from, if any.
- Limitation: only a link straight to the form carries the tag. Someone who lands on the home
  page from an ad and then taps Get started has no source.

## Left to the builder

Exact copy (through the humanizer pass), where in the Applicants record the source shows, the
rules test cases (accepts a good tag, refuses a bad one and an over-long one).
