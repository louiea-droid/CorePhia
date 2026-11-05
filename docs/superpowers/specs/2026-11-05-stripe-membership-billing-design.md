# Stripe membership billing: design

Date: 2026-11-05. Agreed with Louie in conversation the same day. Builds on the
"Billing: Stripe" section of `CLAUDE.md`.

## Why

CorePhia sells a **program**, paid as a monthly membership. Today an admitted
patient gets a portal invite and nothing collects payment. The practice needs
patients to pay before the provider spends time on a first visit, without staff
chasing anyone, and without building card handling, receipts or cancellation
screens of our own.

Compliance boundary (Dr. Antonious, Feb 2026): nothing may read as
"pay money, receive medication". Every charge is a membership in a program;
medication is only ever prescribed when the provider finds it clinically
appropriate.

## Decisions (Louie, 2026-11-05)

- **Monthly only.** No enrollment fee, no first-visit fee.
- **Pay before the first visit.** Until the patient pays, no visit can be booked
  and the program has not started.
- **Paying happens in the portal, after a clinician admits them.** Nobody can
  pay from the public site or the form.
- **Before paying, the portal is only the plan choice:** a welcome ("Welcome,
  {first name}. Choose your plan to start your program."), the plans side by
  side, a choose button on each, and at the bottom a contact line ("Questions
  about the plans? Call {SUPPORT_PHONE} or email info@corephia.com.").
  Progress, Messages and Updates are hidden until the membership starts.
- **Choosing a plan goes straight to payment** (Stripe Checkout, plan already
  filled in), then back to the portal: "You're all set. Our staff will contact
  you to book your first visit."
- **Cancellation and refund policy: waiting on Dr. Antonious.** Not a blocker
  for building; it decides one Stripe customer-portal setting (cancel at period
  end vs immediately) and a paragraph in the Terms. Louie will also raise with
  him what happens if the provider decides at the first visit that the program
  isn't right for someone who has paid.

## Goals

1. An admitted patient picks Core or Core Complete in the portal and pays by card
   through Stripe Checkout, as a monthly subscription.
2. The chart records the membership (plan, status, next billing date) from
   Stripe's own notices, with no staff action.
3. Staff cannot book a visit for a patient whose membership isn't active.
4. The patient manages card, receipts and cancelling through Stripe's hosted
   customer portal, opened from our portal.
5. Everything is built and tested in the Stripe sandbox; going live is swapping
   keys, price IDs and the webhook secret.

## Non-goals

- Our own card forms, invoices, receipts, refund screens or dunning emails
  (Stripe does all of these).
- Insurance, HSA/FSA (unconfirmed; no copy mentions them).
- Plan prices or features changing (they stay in `data/pricingTiers.js`,
  still placeholders awaiting the client).
- Payment from the public `/membership` page.
- Automatic actions on a lapsed membership beyond showing it (cancelling visits,
  locking records). Waits on Dr. Antonious's policy.

## Anti-goals (a failure even if it works)

- Any wording, product name, statement descriptor or receipt line that names or
  implies medication. Stripe product names: "CorePhia Core membership",
  "CorePhia Core Complete membership".
- Anything medical reaching Stripe. Stripe gets the patient's **name, email,
  plan** and an opaque chart id in metadata. Nothing from the intake, notes or
  progress. (This is what keeps Stripe outside the BAA requirement.)
- A secret key or webhook secret in the repo, a `.env` that is committed, or chat.
- A patient able to mark themselves as paid, or pay before being admitted.

## How it fits together

```
Portal (patient)                    Cloud Functions (us-central1)          Stripe
---------------                     -----------------------------          ------
Plan choice  --"Choose Core"-->     startCheckout (callable)  ---------->  Checkout Session
                                      checks login, chart, plan            (subscription mode)
            <---- redirect URL ----                                           |
Stripe Checkout page (card)  <-----------------------------------------------+
            ---- success_url ---->  /account?checkout=done
"Confirming your payment…"          stripeWebhook (https)     <----------  checkout.session.completed
  (listens to the chart)              verifies signature                  customer.subscription.*
                                      writes patients/{chartId}.membership invoice.payment_failed
"You're all set"  <-- chart updates
Manage billing  ------------->      openBillingPortal (callable) ------->  Customer portal session
```

### Data

**`patients/{chartId}.membership`** (map, new field on the chart):

| key | value |
|---|---|
| `plan` | `"Core"` or `"Core Complete"` (the names in `pricingTiers.js`) |
| `status` | `"active"`, `"pastDue"`, `"ended"` |
| `currentPeriodEnd` | timestamp: next billing date (Stripe's `current_period_end`) |
| `cancelAtPeriodEnd` | boolean |
| `since` | timestamp: when it first became active |
| `source` | `"stripe"` or `"manual"` |
| `updatedAt` | server time |

No `membership` key = not paid yet ("Awaiting payment"). The chart is readable
by the linked patient (see the comment on `match /patients/{chartId}`); that is
fine for this map, which holds nothing beyond their own plan and dates.

Status mapping from a Stripe subscription (one pure function,
`membershipFromSubscription()` in `functions/billing.js`, with a self-check):
`active`, `trialing` → `active`; `past_due` → `pastDue`; `canceled`,
`unpaid`, `incomplete_expired` → `ended`; `incomplete` → no change (Checkout
hasn't finished). Price ID → plan via a map in the same file.

**`billing/{chartId}`** (new collection, server only): `customerId`,
`subscriptionId`, `email`, `updatedAt`. Rules: no client read or write
(`allow read, write: if false`). Only the functions (Admin SDK) touch it.

**`patients/{chartId}.formPlan`** (new, optional string): the plan the patient
picked on the form (`visit.membershipPlan`), copied when the chart is created
at admission, so the portal can mark it "You picked this on your form". The
patient can't read their intake record, so it has to live on the chart. Older
charts without it simply show no highlight.

### Cloud Functions (`functions/`, alongside the email ones)

Add the `stripe` npm package. Two new secrets in Secret Manager:
`STRIPE_SECRET_KEY` (test key now, live later) and `STRIPE_WEBHOOK_SECRET`.
Price IDs per mode (test now; live later) as a map in `functions/billing.js`.

1. **`startCheckout`** (`onCall`), input `{ plan }`:
   - caller is signed in; `patientAccounts/{uid}` links them to a chart; the
     chart is `active`; `plan` is one of the shown plans; membership is not
     already `active`/`pastDue` (otherwise return the billing-portal URL
     instead).
   - finds or creates the Stripe customer (name from the chart, email from the
     login, `metadata.chartId`), stores it in `billing/{chartId}`.
   - creates a Checkout Session: `mode: "subscription"`, that plan's price,
     `client_reference_id: chartId`, `subscription_data.metadata.chartId`,
     `success_url: https://corephia.com/account?checkout=done`,
     `cancel_url: https://corephia.com/account`. Returns the session URL.
2. **`openBillingPortal`** (`onCall`): login linked to the chart (the chart
   need **not** be active, so a discharged patient can still cancel); creates a Stripe
   customer-portal session for `billing/{chartId}.customerId`, return URL
   `https://corephia.com/account`. Returns the URL.
3. **`stripeWebhook`** (`onRequest`): verifies the `Stripe-Signature` header
   against the raw body with `STRIPE_WEBHOOK_SECRET` (reject otherwise). Handles
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`. Each one fetches the subscription and **writes the
   whole membership map from Stripe's current state** (not increments), so
   repeats and out-of-order events are harmless. Chart found via
   `metadata.chartId`. Unknown chart or price: log and return 200.

Origins for the callables: `https://corephia.com` (and localhost for dev).
Success and cancel URLs come from a constant, not from the caller.

### Firestore rules

- Clients can't create or change `membership`, with one exception: the
  **admin and super admin** may set it by hand (below) with `source: "manual"`,
  `updatedAt == request.time`, and an audit entry. The chart's current update
  rule (`affectedKeys().hasOnly(['status','updatedAt','lastNote'])`) already
  refuses it for everyone else; extend it only for that case.
- `isNewChart` allows the optional `formPlan` (string, ≤100).
- `billing/*`: nothing from clients.
- **Appointments:** `create` additionally requires, when a chart exists for
  `intakeId`, `membership.status in ['active', 'pastDue']`.
- Tests in `tests/firestore.rules.test.js` for each of the above.

### Portal (`src/portal/`)

- `PortalApp` (or `PortalLayout`) listens to the linked chart. While it has no
  active membership, render the **plan-choice screen** instead of the
  sections/nav. Same look as the public Membership cards, reading `tiers` and
  `PLANS_SHOWN` from `data/pricingTiers.js` so prices match the site.
  Buttons: "Choose Core" / "Choose Core Complete" (an exception to "Get
  started", already noted in CLAUDE.md for plan buttons). Clicking calls
  `startCheckout` and sends the browser to the URL; shows a working state and a
  plain error if it fails.
- Contact line at the bottom, from `SUPPORT_PHONE` in `lib/siteContact.js`.
- Returning with `?checkout=done`: show "Confirming your payment…" while
  listening to the chart; when `membership.status` turns `active`, show
  "You're all set. Our staff will contact you to book your first visit." with a
  button into the portal. If nothing arrives after ~30 seconds: "This is taking
  longer than usual. Refresh in a minute, or call us."
- With an active or past-due membership: full portal as today, plus a
  **Membership** card on Overview: plan, next billing date (or "Ends on …" when
  `cancelAtPeriodEnd`), and **Manage billing** (calls `openBillingPortal`).
  Past due: "We couldn't take your last payment. Update your card." on the
  same card.
- Ended: back to the plan-choice screen, with "Your membership ended on …" above
  the plans.
- Hiding Progress/Messages/Updates is UI only; their data rules stay as they
  are (nothing there is a payment boundary).

### Admin (`src/admin/`)

- **Membership badge** wherever a chart shows: Patients list (new column or
  tag), chart header, the Applicants row for admitted applicants:
  "Awaiting payment", "Member: Core", "Member: Core Complete", "Payment
  problem" (pastDue), "Membership ended".
- **Calendar / AppointmentDialog:** choosing an admitted patient without an
  active membership shows "Waiting for the patient to choose a plan and pay."
  and disables Book. The rule above enforces it.
- **Applicants (not yet admitted) can still be booked** (Louie: "it depends",
  2026-11-05; staff judge case by case, e.g. a screening call). The dialog shows
  "Not admitted yet. Visits for this program start once they're admitted and
  paid." as a warning, without blocking. The rule stays "when a chart exists".
  *(Builder's reading of "it depends"; Louie to confirm.)*
- **Discharge cancels the membership** (Louie, 2026-11-05). A new function,
  **`onChartDischarged`** (`onDocumentUpdated` on `patients/{chartId}`, status
  `active` → `inactive`), cancels the Stripe subscription in `billing/{chartId}`
  if one is live. The webhook then records `ended` (or `cancelAtPeriodEnd`) on
  the chart as usual. Timing follows Dr. Antonious's refund policy; until he
  decides, **cancel at the end of the paid month** (no further charges, no
  refund issued by us). Then it emails the patient a new **`membershipCancelled`**
  email in `functions/emails.js` ("Your CorePhia membership has been cancelled.
  You won't be charged again." plus the end date and the "Questions?" phone
  line, nothing medical), added to `emails.check.js` and `send-test.js`. It is
  an email, not a portal update, because a discharged patient can't open the
  portal. Staff see "Membership ended" on the chart, and the discharge confirm
  dialog says "Their membership will be cancelled." Manual memberships just
  end, with no email. Making the chart active again does not restore the
  membership: the patient pays again from the plan screen.
- **Staff learn a patient has paid** from a To-do item, "Paid: book first
  visit", for an active member with no booked appointment (added to
  `todoMath`/`chartMath.dueTasks()` with its self-check), plus the badge.
  No email. *(Builder's call, 2026-11-05.)*
- **Portal updates and messages to a non-member:** the chart's "Post update"
  and new-message actions are disabled with "Opens once the patient's
  membership starts", so no email sends a patient to a section they can't see.
  Staff reach unpaid patients by phone or email. *(Builder's call.)*
- **Mark as member by hand** (admin and super admin only, on the chart):
  choose plan, short reason; writes `membership` with `source: "manual"`, no
  `currentPeriodEnd`, and an audit event. Also "End manual membership".
  Hidden when the chart has a Stripe membership (`source: "stripe"`, not
  ended). A Stripe event for a chart replaces a manual membership (a real
  payment wins). *(Builder's call.)* For patients who paid another
  way and for test accounts. Adding the audit actions means `AUDIT_ACTIONS`,
  the rules list and `ACTION_LABELS` (CLAUDE.md, "Audit log").
- Help page topic for membership status and booking.

### Stripe dashboard setup (sandbox, by Louie)

- Products named as above, monthly prices (test IDs already in CLAUDE.md).
- Customer portal: update payment method, invoice history, switch between the
  two plans, cancel (mode waits on Dr. Antonious).
- Branding: logo, `#3b5bdb` / `#0d1a3d`.
- Emails: Stripe's successful-payment receipts and failed-payment emails on.
- Webhook endpoint: the deployed `stripeWebhook` URL, the five events above;
  its signing secret goes into `STRIPE_WEBHOOK_SECRET`.

### Site copy (visitor-facing; run through `humanizer`)

- **Terms:** a Billing section: monthly membership billed by card through
  Stripe, starts when paid, renews monthly until cancelled, cancel from the
  portal; cancellation/refund paragraph left as "confirmed in writing at
  enrollment" until Dr. Antonious decides.
- **Privacy policy:** Stripe as a service provider: receives name, email,
  plan; holds card details; no health information.
- **FAQ:** "How do I pay?" (after you're accepted, in your patient portal, by
  card, monthly).
- `public/llms.txt`: one line on payment.

## Testing

- `functions/billing.check.js` (added to `npm run check`): status mapping,
  price→plan map, and that every plan in `pricingTiers.js` has a price ID.
- `npm run test:rules`: membership writes (patient refused, staff refused,
  admin manual allowed with the right shape), `billing` closed, appointment
  blocked without membership.
- End to end in the sandbox with test cards (`4242…` success, `…0002`
  decline, `…3155` 3-D Secure, `…0341` failed renewal) and a test clock for
  renewals; webhook delivered by the deployed function (or `stripe listen
  --forward-to` against the functions emulator).
- Browser check of the portal states (awaiting payment, confirming, active,
  past due, ended) and the admin badge and blocked booking.

## Rollout

- Needs the functions deploy that is currently blocked on the Cloud Build role
  (see CLAUDE.md, Email). Deploy functions, rules and hosting together.
- Charts admitted before this ships show "Awaiting payment"; the admin marks
  any that should count as members by hand.
- Going live: live secret key and webhook secret in Secret Manager, live price
  IDs in `functions/billing.js`, live webhook endpoint, live customer-portal
  settings. Legal entity name for statements comes from the client first.

## Left to the builder

- Exact component split in the portal and admin, and file names beyond those
  named here.
- Whether price IDs per mode live in a map or in function params.
- Copy details beyond the lines quoted above (keep them short, no em dashes).
