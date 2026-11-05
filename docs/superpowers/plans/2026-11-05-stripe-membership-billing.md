# Stripe Membership Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admitted patient chooses Core or Core Complete in the portal and pays monthly through Stripe Checkout. The chart records the membership from Stripe's notices, and staff can't book an admitted patient's visit until it is active.

**Architecture:** Pure billing logic lives in `functions/billing.js` and gets a node self-check. Four Cloud Functions sit in `functions/index.js`: `startCheckout`, `openBillingPortal`, `stripeWebhook` and `onChartDischarged`. Only they write `patients/{chartId}.membership` (Admin SDK) and `billing/{chartId}`. The one exception is the admin's hand-marked membership, which the rules allow with `source: "manual"`. The portal gates its sections on `membership.status`, and the admin reads the same field.

**Tech Stack:** Firebase Functions v2 (Node 22, `us-central1`), the `stripe` npm package, the Firestore rules emulator tests, React 19 + Tailwind v4, and `firebase/functions` (`httpsCallable`) on the client.

**Spec:** `docs/superpowers/specs/2026-11-05-stripe-membership-billing-design.md` (read it first; this plan argues from it).

## Global Constraints

- Nothing reads as "pay money, receive medication". The Stripe product names are "CorePhia Core membership" and "CorePhia Core Complete membership".
- Stripe receives only name, email, plan and `metadata.chartId`. Nothing from the intake, notes or progress.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` live in Secret Manager only (`defineSecret`). Never put them in a file or a commit.
- Plan names are exactly `"Core"` and `"Core Complete"`, taken from `tiers[].name` in `src/data/pricingTiers.js`.
- Test price IDs: Core `price_1UYAmdGfYKc3UVG5MLvaqCfg`, Core Complete `price_1UYAmIGfYKc3UVG5L161NXEW`.
- Membership status values: `"active"`, `"pastDue"`, `"ended"`. A missing `membership` key means not paid yet ("Awaiting payment").
- Success URL `https://corephia.com/account?checkout=done`; cancel and return URL `https://corephia.com/account`.
- Visitor-facing text has no em dashes, says "form" not "intake", and goes through the `humanizer` skill.
- The `SUPPORT_PHONE` and `info@corephia.com` contact line comes from `src/lib/siteContact.js`.
- When editing `firestore.rules` from a script, never use `String.prototype.replace` (see CLAUDE.md). Keep the file free of a BOM.
- Adding an audit action means `AUDIT_ACTIONS`, the rules action list **and** `ACTION_LABELS` in `Activity.jsx`.
- UI tasks load `frontend-design`, `ui-ux-pro-max`, `react-best-practices` and `senior-frontend` first (CLAUDE.md skills table).

## Review Focus

1. **The webhook arrives before the portal's success screen, or twice, or out of order.** The membership map must end up matching Stripe's current subscription state. Test: `membershipFromSubscription` is the only writer input, and Task 1 checks that it ignores event order.
2. **A patient presses "Choose Core" twice, or already has a live subscription.** There must not be a second subscription. Test: `startCheckout` returns a billing-portal URL when the membership is `active`/`pastDue` (Task 4, manual sandbox check). `checkoutDecision` covers it in Task 1.
3. **Staff book an admitted, unpaid patient through the API, bypassing the UI.** The rule must refuse it. Rules test in Task 3.
4. **A patient tries to write their own `membership` to fake a payment.** The rule must refuse it. Rules test in Task 3.
5. **A discharged patient with a live subscription.** It must be cancelled at period end, they must get the email, and they can still open the billing portal. Test: `cancelOnDischarge` decision in Task 1; sandbox check in Task 4.

---

### Task 1: Pure billing logic and its self-check

**Files:**
- Create: `functions/billing.js`
- Create: `functions/billing.check.js`
- Modify: `package.json` (append `&& node functions/billing.check.js` to `"check"`)

**Interfaces:**
- Produces:
  - `PRICES: { test: { Core: string, "Core Complete": string }, live: {} }` and `MODE = "test"`
  - `priceForPlan(plan: string): string | null`
  - `planForPrice(priceId: string): string | null`
  - `membershipFromSubscription(sub: StripeSubscription, existing?: Membership): Membership | null`. It returns `{ plan, status, currentPeriodEnd: Date, cancelAtPeriodEnd: boolean, since: Date, source: "stripe" }`. `since` is kept from `existing` when it is set, and otherwise is `new Date(sub.start_date * 1000)`. It returns `null` when the status is `incomplete` or the price is unknown. `updatedAt` is added by the caller.
  - `checkoutDecision(chart, membership): "checkout" | "portal" | "refuse"`. `"refuse"` when the chart is missing or `status !== "active"`; `"portal"` when `membership?.status` is `active` or `pastDue`; otherwise `"checkout"`.
  - `cancelOnDischarge(before, after): boolean`. True when `before.status === "active"`, `after.status === "inactive"`, and `after.membership?.source === "stripe"` with a status other than `ended`.

- [ ] **Step 1: Write the self-check** (`functions/billing.check.js`, node `assert/strict`)
  - `priceForPlan("Core") === "price_1UYAmdGfYKc3UVG5MLvaqCfg"`, `planForPrice("price_1UYAmIGfYKc3UVG5L161NXEW") === "Core Complete"`, `planForPrice("x") === null`.
  - Every plan name in `src/data/pricingTiers.js` has a price. Read the file as text and match `name: "..."`, because it imports JSX icons and can't be imported in node.
  - Status map: `active` and `trialing` → `"active"`; `past_due` → `"pastDue"`; `canceled`, `unpaid` and `incomplete_expired` → `"ended"`; `incomplete` → `null`.
  - `currentPeriodEnd` is `new Date(current_period_end * 1000)`. Read it from `sub.items.data[0].current_period_end ?? sub.current_period_end`, since newer API versions moved it onto the item.
  - `since` is kept from `existing.since`.
  - The same subscription passed twice gives deep-equal output (order-independent).
  - `checkoutDecision`: there are 4 cases (no chart, inactive chart, member, non-member). The ended case gives `"checkout"`.
  - `cancelOnDischarge`: true for active to inactive with a live stripe membership; false for manual, for ended, and for inactive to inactive.
- [ ] **Step 2: Run** `node functions/billing.check.js`. Expected: it fails because `billing.js` is missing.
- [ ] **Step 3: Implement** `functions/billing.js` with the exports above. It has no imports, so the client could share it later.
- [ ] **Step 4: Run** `npm run check`. Expected: every self-check prints ok, including `billing: ok`.
- [ ] **Step 5: Commit** `feat(billing): membership mapping and plan prices`.

### Task 2: "Membership cancelled" email

**Files:**
- Modify: `functions/emails.js` (new `case "membershipCancelled"`)
- Modify: `functions/emails.check.js`, `functions/send-test.js`

**Interfaces:**
- Produces: `buildEmail({ kind: "membershipCancelled", to, endsOn: Date | string })`, which returns `{ to, subject, text, html }`.

- [ ] **Step 1: Add the check.** `to` passes through. The subject is `"Your CorePhia membership has been cancelled"`. The text includes `"You won't be charged again."`, the end date formatted like the `newIntake` date (Tampa time zone, e.g. `"December 5, 2026"`) and `PHONE`. The HTML has no `<a href` button.
- [ ] **Step 2: Run** `node functions/emails.check.js`. Expected: it fails on the unknown kind.
- [ ] **Step 3: Implement.** The title is "Your membership has been cancelled". Paragraphs: "Your CorePhia membership has been cancelled. You won't be charged again." and "Your membership stays active until {endsOn}." After the button slot: `Questions? Call us at ${PHONE} or email info@corephia.com.` There is no button. Add it to `send-test.js`'s list. Run the copy through `humanizer`.
- [ ] **Step 4: Run** `npm run check`. Expected: it passes.
- [ ] **Step 5: Commit** `feat(email): membership cancelled notice`.

### Task 3: Firestore rules and audit actions

**Files:**
- Modify: `firestore.rules` (the `isNewChart` keys, the `match /patients/{chartId}` update, a new `match /billing/{chartId}`, the appointments `create`, and the audit action list)
- Modify: `src/admin/lib/firebase.js` (`AUDIT_ACTIONS`), `src/admin/activity/Activity.jsx` or wherever `ACTION_LABELS` lives (grep for it)
- Test: `tests/firestore.rules.test.js` (new `describe("membership", …)`; the header count goes up)

**Interfaces:**
- Produces: the audit actions `setMembership: "set_membership_manually"` and `endMembership: "end_membership_manually"`, with labels "Marked as member" and "Ended membership".
- The chart may hold `formPlan` (string ≤100, optional at create) and `membership` (written by functions; clients only per the manual rule).

- [ ] **Step 1: Write the failing tests.** In `beforeEach`, seed a chart `paid1` with `membership: { plan: "Core", status: "active", source: "stripe", … }` and intake `paid1` with status admitted. The tests:
  - a new chart with `formPlan: "Core"` is accepted; `formPlan` of 101 characters is refused
  - the linked patient (`patient1`, chart `chart1`) can't update `membership` on their own chart
  - a provider and a co-admin can't set `membership`
  - the admin can set `membership: { plan: "Core", status: "active", source: "manual", since: serverTimestamp(), updatedAt: serverTimestamp() }` on `chart1`
  - the admin can't set `source: "stripe"`, can't use a plan outside the two names, and can't add extra keys
  - the admin can end a manual membership (`status: "ended"`), but can't touch a chart whose current membership is `source: "stripe"` and not ended
  - `billing/chart1`: read and write are refused for the admin, super admin and patient
  - an appointment for `chart1` (no membership) is refused; for `paid1` it is accepted; for `pending1` (an applicant, no chart) it is still accepted
  - an appointment for a chart with `membership.status: "pastDue"` is accepted
- [ ] **Step 2: Run** `npm run test:rules`. Expected: the new tests fail.
- [ ] **Step 3: Implement the rules.**
  - Add `'formPlan'` to `isNewChart`'s `hasOnly`, with `(!('formPlan' in data) || (data.formPlan is string && data.formPlan.size() <= 100))`.
  - The chart update gets a second `allow update` for `role() in ['admin','superAdmin']`, where the affected keys are only `['membership','updatedAt']`. The new membership has keys only `plan, status, source, since, updatedAt`, with `source == 'manual'`, `plan in ['Core','Core Complete']`, `status in ['active','ended']`, `updatedAt == request.time`, and `updatedAt == membership.updatedAt`. The old membership must be absent, `source == 'manual'`, or `status == 'ended'`. Leave the existing update rule untouched; it already refuses `membership`.
  - Add `match /billing/{chartId} { allow read, write: if false; }`.
  - The appointment `create` gets `&& (!exists(/databases/$(database)/documents/patients/$(request.resource.data.intakeId)) || get(...patients/$(intakeId)).data.get('membership', {}).get('status', '') in ['active', 'pastDue'])`.
  - Add both new actions to the rules audit list, `AUDIT_ACTIONS` and `ACTION_LABELS`.
- [ ] **Step 4: Run** `npm run test:rules` and `npm run check`. Expected: all tests pass (the earlier 165 plus the new ones), and `auditActions` is ok.
- [ ] **Step 5: Commit** `feat(rules): membership, billing and paid-only booking`.

### Task 4: Cloud Functions for Stripe

**Files:**
- Modify: `functions/package.json` (add `"stripe"`; run `npm install` in `functions/`)
- Modify: `functions/index.js`

**Interfaces:**
- Consumes: Task 1 (`priceForPlan`, `membershipFromSubscription`, `checkoutDecision`, `cancelOnDischarge`) and Task 2 (`kind: "membershipCancelled"` via the existing `send()`).
- Produces (all `region: "us-central1"`):
  - `startCheckout` (`onCall`, `cors: ["https://corephia.com", /localhost/]`, secrets `STRIPE_SECRET_KEY`), input `{ plan }`. Returns `{ url }`. Throws `HttpsError("unauthenticated" | "permission-denied" | "invalid-argument")`.
  - `openBillingPortal` (`onCall`, same options), no input. Returns `{ url }`.
  - `stripeWebhook` (`onRequest`, secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
  - `onChartDischarged` (`onDocumentUpdated("patients/{chartId}")`, secrets `STRIPE_SECRET_KEY`, `SMTP_PASSWORD`).

- [ ] **Step 1: `startCheckout`.**
  1. Read `patientAccounts/{auth.uid}`, take its `intakeId` as the chart id, and read `patients/{chartId}`.
  2. Call `checkoutDecision(chart, chart.membership)`. On `"portal"`, return a billing-portal session URL instead of starting checkout. Also handle the case where the webhook hasn't landed yet: if `billing/{chartId}.subscriptionId` exists and Stripe reports it `active`, `trialing` or `past_due`, go to the portal too, so a double click can't make two subscriptions.
  3. Check that `priceForPlan(plan)` exists; otherwise throw `invalid-argument`.
  4. Find or create the customer: use `billing/{chartId}.customerId`, or else `stripe.customers.create({ name: first + last, email: auth.token.email, metadata: { chartId } })` and set `billing/{chartId}` to `{ customerId, email, updatedAt }`.
  5. Call `stripe.checkout.sessions.create({ mode: "subscription", customer, line_items: [{ price, quantity: 1 }], client_reference_id: chartId, subscription_data: { metadata: { chartId } }, success_url, cancel_url })`.
  6. Return `{ url: session.url }`.
- [ ] **Step 2: `openBillingPortal`.** Require a linked login; the chart does **not** need to be active. Throw `failed-precondition` if there is no `billing/{chartId}.customerId`. Return `stripe.billingPortal.sessions.create({ customer, return_url })`'s URL.
- [ ] **Step 3: `stripeWebhook`.**
  1. Verify with `stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], secret)`. On failure, respond 400.
  2. For `checkout.session.completed`, `customer.subscription.created|updated|deleted` and `invoice.payment_failed`, retrieve the subscription by id and take `chartId` from `sub.metadata.chartId`.
  3. In a transaction: read the chart, call `membershipFromSubscription(sub, chart.membership)`, and if the result isn't null, update `{ membership: { ...m, updatedAt: serverTimestamp() } }`. Also set `billing/{chartId}.subscriptionId` (merge).
  4. Log and respond 200 for an unknown chart or price, and for any other event type.
- [ ] **Step 4: `onChartDischarged`.**
  1. If `cancelOnDischarge(before, after)` is true, call `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })`. This is the default until Dr. Antonious's policy; leave a comment pointing at the spec.
  2. Then send `membershipCancelled` to `billing/{chartId}.email`, with `endsOn` set to the subscription's period end.
  3. If the membership is `source: "manual"` and not ended, update it to `status: "ended"` with no email.
- [ ] **Step 5: Verify in the sandbox.**
  1. Deploy needs the Cloud Build role fix (CLAUDE.md, Email); if it's still blocked, stop and report. Add the secrets with `firebase functions:secrets:set STRIPE_SECRET_KEY` (Louie types the key), deploy functions, register the webhook URL in the Stripe dashboard with the 5 events, then set `STRIPE_WEBHOOK_SECRET` and deploy again.
  2. Check with the test cards from the spec: `4242…` makes the chart `active`; paying twice opens the portal instead; `…0341` plus a test clock gives `pastDue`; cancelling in the portal sets `cancelAtPeriodEnd`; discharging sends the email.
- [ ] **Step 6: Commit** `feat(functions): Stripe checkout, billing portal, webhook, discharge cancel`.

### Task 5: Portal plan choice, confirmation and membership card

**Files:**
- Modify: `src/portal/lib/patientAuth.js` (export the named `"portal"` app as `app`)
- Create: `src/portal/lib/billing.js`
- Modify: `src/portal/lib/messageStore.js` (`listenMyChart`)
- Create: `src/portal/membership/PlanChoice.jsx`, `src/portal/membership/MembershipCard.jsx`
- Modify: `src/portal/PortalApp.jsx`, `src/portal/PortalLayout.jsx` (remove the "Membership" `COMING_SOON` entry), `src/portal/PortalHome.jsx`

**Interfaces:**
- Consumes: the Task 4 callables and the chart `membership` and `formPlan` fields.
- Produces:
  - `startCheckout(plan: string): Promise<string /* url */>`
  - `openBillingPortal(): Promise<string>`
  - These go through `httpsCallable(getFunctions(app, "us-central1"), name)`.
  - `listenMyChart(intakeId, onChange: (chart | null) => void): unsubscribe`. Keep `listenMyChartStatus` and build it on top of this.
  - `isMember(chart): boolean`, true when `chart?.membership?.status` is `"active"` or `"pastDue"`.

- [ ] **Step 1: Load the UI skills** (Global Constraints). Then wire `PortalApp`'s `"linked"` state:
  - It listens to the chart with `listenMyChart`.
  - Not a member: render `<PlanChoice chart link />` in place of the `<Routes>` and tabs, for every `/account/*` path.
  - Member: render the routes as today.
  - `?checkout=done` and not a member yet: "Confirming your payment…". After 30 s: "This is taking longer than usual. Refresh in a minute, or call us at {SUPPORT_PHONE}."
  - It turns member while `?checkout=done` is set: show the "You're all set. Our staff will contact you to book your first visit." card with a "Go to your portal" button that clears the query.
- [ ] **Step 2: Build `PlanChoice`.**
  - Heading `Welcome, {firstName}. Choose your plan to start your program.`
  - If the membership is ended, show `Your membership ended on {date}.` above the plans.
  - Cards: `tiers` filtered by `PLANS_SHOWN`, with the same features and prices as `/membership`. Reuse its card markup if it is exported; otherwise match it. The plan matching `chart.formPlan` gets a "You picked this on your form" tag.
  - Buttons say "Choose {name}" → `startCheckout(name)` → `window.location.assign(url)`. While waiting, show "Opening checkout…" with the button disabled; on error, show "We couldn't open checkout. Please try again, or call us."
  - Bottom line: `Questions about the plans? Call {SUPPORT_PHONE} or email info@corephia.com.`, with the phone as a `tel:` link and the email as a `mailto:`.
  - Contrast rule: text on `brand` gradients is `paper-50/100`. Hover is a colour change only.
- [ ] **Step 3: Build `MembershipCard`** on the Overview, first card.
  - It shows the plan, then `Next billing date: {date}`, or `Ends on {date}` when `cancelAtPeriodEnd`.
  - `pastDue`: "We couldn't take your last payment. Update your card."
  - Manual memberships show the plan only, with no button.
  - A "Manage billing" button calls `openBillingPortal()` and redirects.
- [ ] **Step 4: Verify in a browser** (`webapp-testing`/Playwright MCP, signed in as a sandbox test patient). Check four states:
  - not a member: only the plan choice, no tabs
  - after paying with `4242…`: the confirming screen, then "You're all set"
  - a member: the tabs and the Membership card
  - ended: the plan choice with the ended line

  Check at 375 px and desktop width. Scroll before taking screenshots (reveal animations).
- [ ] **Step 5:** Run `npm run lint` and `npm run build`. Expected: both clean, and the prerender passes.
- [ ] **Step 6: Commit** `feat(portal): plan choice, checkout and membership card`.

### Task 6: Admin: badge, manual membership, admission plan, discharge text

**Files:**
- Modify: `src/admin/patients/chartMath.js` (`membershipLabel`) and `chartMath.check.js`
- Modify: `src/admin/patients/chartStore.js`
  - `chartFromRecord` gets `formPlan` from `record.visit?.membershipPlan` (only when it is one of the plan names)
  - new `setManualMembership(chartId, plan, actor)` and `endManualMembership(chartId, actor)`, with demo-store branches
- Modify: `src/admin/patients/Patients.jsx` (a badge column, and the confirm text adds " Their membership will be cancelled." when `isMember`)
- Modify: `src/admin/patients/PatientChart.jsx` (a badge in the header; for `admin`/`superAdmin` only, "Mark as member" and "End membership" when allowed)
- Modify: `src/admin/applicants/ApplicantsTable.jsx` (a badge for admitted rows; read the chart field already loaded there, or load the charts once with `loadCharts()`)

**Interfaces:**
- Produces:
  - `membershipLabel(chart): { text: string, tone: "muted" | "good" | "warn" }`. The texts are "Awaiting payment", "Member: Core", "Member: Core Complete", "Payment problem" and "Membership ended".
  - `isMember(chart)`, the same definition as Task 5. Put it in `chartMath.js` and have the portal import it, so there is a single definition.

- [ ] **Step 1: Self-check first.** In `chartMath.check.js`, call `membershipLabel` for the 5 states plus a manual Core membership (gives "Member: Core"), and call `isMember` for active, pastDue, ended and missing.
- [ ] **Step 2: Run** `npm run check`. Expected: it fails.
- [ ] **Step 3: Implement** `chartMath` and `chartStore`.
  - The manual write is `updateDoc(chart, { membership: { plan, status: "active", source: "manual", since: serverTimestamp(), updatedAt: serverTimestamp() }, updatedAt: serverTimestamp() })` plus `recordAuditEvent` `setMembership`. End is the same shape with `status: "ended"`.
  - The Mark dialog uses `ui/useDialog.js`, with a plan select and a reason. The reason goes only in the audit `targetLabel`.
  - Hide Mark when `membership?.source === "stripe"` and its status isn't `ended`.
- [ ] **Step 4: Verify in the demo admin** (CLAUDE.md "Testing the admin without a login": port 5190, `?demoRole=admin`, then `provider`). Check that the badges show, that only the admin sees Mark/End, and that the discharge text changes. Clean `.playwright-mcp` afterwards.
- [ ] **Step 5: Commit** `feat(admin): membership badge and manual membership`.

### Task 7: Admin: booking, portal messages and the to-do item follow the membership

**Files:**
- Modify: `src/admin/calendar/AppointmentDialog.jsx`
- Modify: `src/admin/patients/PatientChart.jsx` ("Post update" action) and `src/admin/inbox/NewTopicDialog.jsx`
- Modify: `src/admin/patients/chartMath.js` (`dueTasks`) and `chartMath.check.js`; `src/admin/patients/Todo.jsx` and `src/admin/dashboard/TodayStrip.jsx` (the callers)

**Interfaces:**
- Consumes: `isMember`, `loadChart(chartId)` and `loadAppointments(from, to)`.
- Produces: `dueTasks(notes, today, windowDays = 7, { member = true, hasUpcomingVisit = false } = {})`. When there is no signed medical note:
  - `member && !hasUpcomingVisit` gives `{ kind: "bookFirstVisit", discipline: "medical", due: null, days: null }`, labelled "Paid: book first visit".
  - `member && hasUpcomingVisit` gives nothing.
  - `!member` gives nothing, since they can't be seen yet.
  - The default `member = true` keeps today's callers working until they pass it. `"firstConsult"` is replaced by `"bookFirstVisit"`, so update `TodayStrip`'s filter.

- [ ] **Step 1: Self-check.** Update the `firstConsult` assertions in `chartMath.check.js` to the 3 cases above.
- [ ] **Step 2: Run** `npm run check`. Expected: it fails.
- [ ] **Step 3: Implement `dueTasks`.**
  - `Todo.jsx` loads `loadAppointments(now, now + 180 days)` once and builds a set of `intakeId` with `status === "scheduled"`. It passes `{ member: isMember(chart), hasUpcomingVisit: set.has(chart.id) }`.
  - The label comes from wherever `firstConsult` is labelled today (grep for it).
- [ ] **Step 4: Booking.**
  - When the picked patient's `patientKind === "patient"`, `loadChart(intakeId)`. If `!isMember(chart)`: "Waiting for the patient to choose a plan and pay.", with Book disabled.
  - When `patientKind === "applicant"`: the non-blocking note "Not admitted yet. Visits for this program start once they're admitted and paid."
  - Moving an existing appointment is not blocked.
- [ ] **Step 5: Portal sends.** For a non-member chart, "Post update" and starting a new topic are disabled, with "Opens once the patient's membership starts". `NewTopicDialog` checks the chosen chart.
- [ ] **Step 6: Verify in the demo admin.**
  - An unpaid patient can't be booked; an applicant gets the warning but can be booked.
  - A manually marked member can be booked.
  - The To-do shows "Paid: book first visit" until a visit is booked.

  Then run `npm run check` and `npm run lint`.
- [ ] **Step 7: Commit** `feat(admin): booking and portal sends wait for membership`.

### Task 8: Copy, help and docs

**Files:**
- Modify: `src/pages/Legal.jsx` (a Terms Billing section; Privacy adds Stripe as a service provider)
- Modify: the FAQ data (grep `Do you accept insurance` to find it; add "How do I pay?")
- Modify: `public/llms.txt`, `src/admin/help/Help.jsx` (a membership and booking topic), `CLAUDE.md` (the "Billing: Stripe" section: built, what's where, how to go live), and the memory `resume-2026-11-05` follow-up

- [ ] **Step 1: Write the copy** with the `humanizer` skill loaded, from the spec's "Site copy" section.
  - Terms: billed monthly by card through Stripe, starts when paid, renews until cancelled, cancel from the portal. The cancellation and refund line stays "confirmed in writing at enrollment".
  - Privacy: Stripe receives name, email and plan, and holds card details; no health information.
  - FAQ: "After you're accepted, you choose a plan and pay by card in your patient portal. It's billed monthly."
- [ ] **Step 2: Verify.** `npm run build` passes (the prerender checks the titles, canonicals and h1). Open `/terms`, `/privacy` and `/faq` in the hosting emulator.
- [ ] **Step 3: Commit** `docs: billing in Terms, Privacy, FAQ, help and CLAUDE.md`.

### Task 9: Go-live checklist (no code; for Louie, after Dr. Antonious's answers)

- [ ] Get Dr. Antonious's answers on the cancellation and refund policy, and on what happens when the first visit decides the program isn't a fit. Then set the customer-portal cancel mode, update `onChartDischarged` if needed, and update the Terms paragraph.
- [ ] Get the legal entity name for the statement descriptor.
- [ ] Switch to live: set the live `STRIPE_SECRET_KEY`, fill `PRICES.live` and set `MODE = "live"`, register the live webhook endpoint and set its secret, copy the customer-portal and branding settings to live, and deploy functions, rules and hosting together.
- [ ] Mark existing members by hand, and the test accounts.
