# Client portal: notes for later

Status: **login and invites being built** (Louie, 2026-10-05). Spec:
`docs/superpowers/specs/2026-10-05-client-portal-login-design.md`. Sending email and the
Cloud Function are on hold; invites are saved as "Ready to send" until then.

Per Louie, Elation is set aside for this: build what Dr. Antonious asked for in the
meeting, with the site as the system. Revisit if Elation is signed, since EMRs usually
ship their own patient portal and messaging.

---

## What Dr. Antonious asked for

From the 2026-09-29 meeting (`docs/MEETING TRANSCRIPTION.docx`, analysed in
`docs/meeting-analysis.md`).

**The portal itself (¶43–45), agreed: "Okay, let's do it. I like it a lot."**

- The patient sees their progress: "the weight loss and all those metrics that you guys
  are monitoring".
- When there's something new, the patient gets an email: "update from Dr. Dan / from
  CorePhia, check your client portal". The email carries no details.
- He was told SOC 2 would make it HIPAA compliant (¶45). **That is not accurate**: HIPAA
  for a vendor means safeguards plus a signed Business Associate Agreement (BAA). Correct
  this with him before it is promised.

**The back office he described earlier (¶29–38)**, which feeds the portal once Elation
is out of the picture:

- On intake submission, email him and Hyacinth so someone can schedule (¶29). Must be a
  notification only, never a summary (draft below).
- A profile per patient, with dated notes he can write: consultation note, progress note,
  HPI, plan, prescriptions (¶29, 31, 36–37).
- A calendar tab showing upcoming appointments (¶31–32).
- A to-do tab: which patient needs a prescription or a renewal, with notifications (¶32, 38).
- Dietitian and exercise staff add their own notes (¶33).
- Telemedicine "would be wonderful" (¶34).

In the meeting this full back office was dropped in favour of buying an EMR (¶39–40).
With Elation set aside, build only the parts the portal needs, as a portal feed, not a
full medical record.

---

## What exists today

Patient side built 2026-10-05 (plan `docs/superpowers/plans/2026-10-05-client-portal-patient-side.md`):

- **Entry:** header and mobile menu say **Patient portal** (signed in or not). The login panel
  (`LoginPanel.jsx`) is sign-in only: email and password. No sign-up, no Google.
- **`/account`** (`pages/Account.jsx`) is the portal page: signed out ("Sign in to your patient
  portal" + Get started), not linked ("Your portal isn't set up yet", contact details), load
  error (Try again), or linked ("Welcome back, {firstName}" + four "Coming soon" cards:
  Updates, Track progress, Messages, Membership).
- **The link:** `patientAccounts/{uid}` = `{ email, intakeId, firstName, linkedAt }`. Rules: a
  patient reads only their own, clinical staff read all, no client writes. Old self sign-up
  docs (`{ email, createdAt }`, no `intakeId`) show "not set up yet".
- **To test now:** create the patient's login in the Firebase console (Authentication), then
  add `patientAccounts/{that uid}` by hand with the four fields. **Deploy the rules first**
  (`firebase deploy --only firestore:rules`): the live project still has the old rule, which
  refuses the patient read, so the portal shows the error state until then.
- **Not built yet:** `/portal/setup` and the invite email (EmailJS, Louie 2026-10-05).
- **Admin:** lists intake records, opens one, sets a status (pending / admitted / declined)
  and a short staff note (`adminNote`). Same Firebase project as the patient login.
- **`firestore.rules`:** role-based staff access, audit log, and the "only your own data"
  pattern the portal needs.

A hide switch was tried and reverted on 2026-10-01: the login stays visible for now.

---

## Recommendation

**Build the portal on the existing login. Don't add a separate portal product.** The hard
parts (auth, password reset, Google sign-in, rules, same project as the admin) already
work. A second system means a second login for patients and syncing between the two.

**Change who gets an account: invite-only.**

1. Patient submits the intake.
2. Staff mark them **admitted** in the admin (that status exists).
3. The patient gets an email: "Welcome to CorePhia, set up your client portal".
4. They set a password; the account is linked to their intake record from the start.

"Create account" leaves the public site, and the header's "Log in" becomes "Patient
portal". Visitors who aren't patients have nothing to sign up for, which also fits "a
program, never a storefront".

---

## The four sections

Build one at a time, each with its own short design. Suggested order is top to bottom.

| Section | What it needs | Size |
|---|---|---|
| **Updates** (Louie's addition) | Staff post a dated note in the admin; patient sees it on their portal; "check your portal" email | Small |
| **Track progress** | Patient logs weight over time and sees a chart; staff see it in the admin | Medium |
| **Message your care team** | Two-way messages, a staff inbox in the admin, "new message" email alerts | Large |
| **Manage your membership** | Show the plan. Changing or cancelling needs a billing system, and **the site has none** | Large, blocked on billing |

---

## Constraints that apply to all of it

- **HIPAA / BAA.** Weight logs, messages and care updates are health information stored in
  Firebase. A Google Cloud BAA must be signed for the project before real patients use the
  portal. Same blocker as the intake (CLAUDE.md, blocker 1).
- **Emails never carry PHI.** Every email (new intake, new update, new message) says only
  that something is waiting and links to a login.
- **Compliance boundary.** Nothing in the portal may read as pay money, receive medication
  (CLAUDE.md). Membership management shows a program, not orders.
- **One provider today, more later.** Don't hard-code "your provider" as one person, and
  keep email recipients as a setting.

---

## Draft: new-intake notification email

For Dr. Antonious and Hyacinth. Recipients still to be named by the client.

> **Subject:** New patient intake received
>
> A new patient intake was submitted on the CorePhia website.
>
> **Received:** Wednesday, October 1, 2026 at 2:14 PM (Eastern)
> **Reference:** INT-7F3K9
>
> To view it and schedule the first appointment, sign in to the CorePhia admin:
> **Open the intake** (link to `/admin`)
>
> For patient privacy, this email does not include any health information.
>
> CorePhia Health · Tampa, Florida
> This is an automated notification. Please don't reply to this email.

Contact-form version: "A visitor sent a message through the Contact page on [date and
time]. Sign in to the admin to read it and reply."

**Not built (removed for now, Louie 2026-10-01).** A version was built and taken out. When
it comes back: a Firebase function on `intakeRecords` create writes a `mail/{intakeId}` doc
(the doc id stops a duplicate trigger sending twice) and the "Trigger Email from Firestore"
extension sends it. Needs the Blaze plan and SMTP details for the sending mailbox. Recipient:
`info@corephia.com`, later Dr. Antonious. Give the button a link that opens that applicant
(e.g. `/admin/applicants?open={intakeId}`), and drop the draft's reference line, since nothing
in the admin searches by it. Batch alerts if bots ever flood the intake.

---

## Open decision

Decided 2026-10-02 (Louie): **invite-only**. Section order Updates → Track progress →
Messages (Membership waits on billing) is agreed but on hold; **the invite-only login is
built first**.

## Next: the Updates section (saved 2026-10-05)

Agreed as the next portal build after the login (Louie, 2026-10-05). Staff post a dated
update on the patient chart; the patient sees it on their portal; once the Cloud Function
exists it emails "you have a new update, check your portal" with no details. Data idea:
`patients/{chartId}/updates/{id}` `{ body, createdBy, createdAt }`, read by the patient
through their `patientAccounts/{uid}.intakeId` link. Size: small. Its own short design first.
