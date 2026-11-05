# Patient portal redesign: design

Date: 2026-11-05. Agreed with Louie in conversation the same day. Mockup (not committed):
`.superpowers/brainstorm/2305-1793905472/content/portal-preview.html`.

## Why

Today a signed-in patient sees the portal inside the marketing website: the site menu,
"Get started" buttons, the footer and the cookie banner, all meant for visitors who have not
joined. Louie wants the portal to feel like the patient's own space once they sign in:
"a calm health app that is a bit closer to the CorePhia website". Most patients will use it on
a phone.

## Decisions (Louie, 2026-11-05)

- The portal gets its **own frame**, like the admin: no website header, footer, menu or cookie
  banner. Patients can still reach the website ("Back to corephia.com").
- **Look:** calm health app, close to the site: same navy (`ink-950`), blue (`accent`,
  `accent-dark`, `brand`), Fraunces headings, Inter body, white cards on `paper-50`. The mockup
  is approved ("the design looks great").
- **"What's next" card** at the top of Overview: one main reminder plus up to two smaller
  lines, **automatic reminders only** (no staff-written reminders for now).
- Patients **see their own booked visits**. The appointment **note stays private** to staff.
- No medication reminders (compliance: medication is never put front and centre; see CLAUDE.md).
- No "follow-up due around …" date from notes for now (clinical; waits for Dr. Antonious).

## Goals

1. `/account/*`, `/portal/setup` and `/portal/reset` render in a portal shell, outside the
   website frame.
2. Computer: left sidebar (logo, Overview, Progress, Messages, Updates, Membership; patient name
   and email, "Back to corephia.com", "Sign out" at the bottom). Phone: top bar (logo, initials)
   and a bottom tab bar (Overview, Progress, Messages, Updates, Account); a dot on Messages when a
   care-team reply is unread.
3. Overview opens with the "What's next" card, then progress, messages, membership and the
   latest update, as in the mockup.
4. Membership becomes its own page (`/account/membership`): plan, next billing date or end date,
   past-due line, Manage billing. On phones it lives under Account with the sign-out.
5. The before-payment plan choice, "Confirming your payment", "You're all set", "program closed"
   and the load-error card all render inside the new shell (no sidebar sections before payment:
   just the logo, the patient, Sign out and Back to corephia.com).

## Non-goals

- New portal features beyond the reminders card and the visits it needs. Progress, Messages
  and Updates keep their current content and behaviour; only the frame and styling change.
- Staff-written reminders; the "follow-up due" date; medication anything.
- Changing the admin or the public website.
- Dark mode for the portal.

## Anti-goals

- Anything that reads as a storefront or puts medication forward.
- A patient able to read another patient's visits, or any staff-only appointment field (the
  note, the change history).
- Overlapping or cramped text at phone or laptop widths (Louie has caught this twice today):
  check 375 px, 768 px, 1100 px and 1440 px.
- Hover effects that move things (CLAUDE.md: hover = colour only).

## "What's next" reminders

Computed on the client from data the portal already reads, plus the patient's visits. A pure
function `whatsNext(input) → { main, more: [≤2] }` in a plain-JS module (node self-check in
`npm run check`). Priority, highest first; each clears itself when handled:

| # | Reminder | Shows when | Action |
|---|---|---|---|
| 1 | "We couldn't take your last payment. Update your card." | `membership.status === "pastDue"` | Manage billing |
| 2 | "Your visit is today at {time} with {staff}" | a scheduled visit today (Tampa time) | Message us |
| 3 | (dropped 2026-11-05, Louie: the Messages card below already shows new replies) | | |
| 4 | "Your next visit: {day, date} at {time} with {staff}" | the soonest future scheduled visit | Message us |
| 5 | "Your care team posted an update" | newest update newer than the last one opened on this device | Read it |
| 6 | "Time for a weigh-in. Your last one was {n} days ago." | no weigh-in or visit weight for more than 7 days, and at least one exists | Log weight |
| 7 | "Your membership ends on {date}" | `cancelAtPeriodEnd` and status active | Manage billing |
| 8 | First visit not booked: "Our team will contact you to book your first visit." / later: "Our team will contact you when it's time for your next visit." | nothing else applies | Message us |

The main card is the highest that applies; the next two applicable ones show as small lines.
Visit times are Tampa time (`calendarMath`).

**Staff are named by role, never by name** (the portal already does this for messages:
`PATIENT_ROLE_LABELS` in `lib/messageMath.js`, and CLAUDE.md: the site never names Dr. Antonious).
"With {staff}" reads "with your provider", "with your dietitian" or "with your care team";
"New message from {name}" reads "New message from your provider / dietitian / care team". The
mockup's "Sam Rivera, RD" lines are placeholders to replace.

**Settled from the builder check (builder's calls, 2026-11-05):**
- The card appears only for members (active or past due). Before payment the portal is the plan
  choice; closed shows the closed card.
- "Visit weight" is already in `patients/{id}/progress` (signing a note writes
  `progress/visit-{noteId}`), which the portal reads; row 6 uses that list (weigh-ins and visit
  weights together).
- Visit statuses are scheduled / completed / cancelled / noShow; only `scheduled` counts. Filter
  on the client (a patient has few visits), so no composite index.
- Row 2 ("today") shows until the visit's end (`start + minutes`), then drops.
- If reading visits fails (rules or function not live yet), the card silently falls back as if
  no visit is booked; no error card.

**"Seen" for updates (builder's call, Louie may change):** remembered in `localStorage` per
device (id of the newest update opened). Opening Updates on the phone clears it there only. A
cross-device version needs a Firestore field and a rules change; not now.

## Patient-visible visits (note stays private)

Firestore rules can't hide one field of a document, so patients never read `appointments`.

- New Cloud Function **`mirrorVisit`** (`onDocumentWritten("appointments/{id}")`, us-central1,
  in `functions/index.js` next to the Stripe ones). On every write it sets
  `patients/{intakeId}/visits/{id}` to `{ start, minutes, discipline, staffRole, status,
  updatedAt }` only (`staffRole` read from `user/{staffUid}.role`, so the portal can say "your
  provider"; no staff name), and deletes it if the appointment is deleted. Nothing else is copied
  (not the note, not the change history, not who booked it).
- Applicants have no chart: skip when `patients/{intakeId}` doesn't exist. A second trigger,
  `onDocumentCreated("patients/{chartId}")`, copies that intake's existing appointments when the
  chart is created, so a screening call booked before admission isn't lost. (There are no real
  patients yet, so no one-off back-fill script is needed.)
- Rules: `match /patients/{chartId}/visits/{visitId}`: `allow read: if isLinkedTo(chartId) ||
  isClinical()`; no client writes. Rules tests for: linked patient reads own, another patient
  refused, writes refused.
- Portal reads upcoming visits (`status == "scheduled"`, start ≥ now) for the card.
- Deployed with the Stripe functions (same blocked Cloud Build role). Until deployed, the card
  never has a visit and falls back to row 8, which is correct behaviour.

## Shell and routing

- `App.jsx` already branches `/admin` out of the website frame; branch `/account`, `/portal/setup`
  and `/portal/reset` the same way into the portal (no Header, Footer, CookieBanner). Analytics
  rules already exclude these paths; keep it that way (`googleAnalytics.check.js`).
- New `PortalShell` (sidebar / top bar + tab bar), used by the linked portal; the signed-out,
  setup and reset screens use a minimal version (logo, Back to corephia.com).
- Without the website footer, the shell carries small "Privacy policy" and "Terms" links (in the
  sidebar foot on computers, on the Account page on phones). No cookie banner is needed: nothing
  is tracked on portal pages (CLAUDE.md, Site analytics), and the website's own banner still
  appears on public pages.
- Keep the existing state machine in `PortalApp` (checking / signed out / not linked / linked;
  loading / error / closed / plan choice / confirming / member) and the idle sign-out.
- The portal demo (`?demoPortal=…`, dev only) must keep working and gain sample visits,
  messages and an update so every reminder can be seen.

## Testing

- `whatsNext` self-check: every row, the priority order, the "≤2 more" limit, Tampa "today",
  cancelled visits ignored, 7-day weigh-in boundary.
- Rules tests for `visits`.
- Browser (portal demo): each reminder state, before payment, closed, at 375 / 768 / 1100 /
  1440 px, keyboard focus visible, no overlapping text.
- `npm run build` (prerender unaffected: portal routes aren't prerendered).

## Left to the builder

- Component split, file names, exact spacing; follow the mockup.
- Icons: inline SVG in the admin's style (no emoji, no new icon library).
- Copy beyond the lines above (humanizer; no em dashes; "form" not "intake").
