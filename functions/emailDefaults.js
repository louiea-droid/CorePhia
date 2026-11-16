// The starting wording of the three default templates. Staff edit copies in the
// admin; these seed the first deploy. The Declined wording still needs Dr.
// Antonious's approval before real patients. The contact line and privacy note
// are appended on send (emailRender.js), so they are left out here.
const p = (...content) => ({ type: "paragraph", content })
const t = (text) => ({ type: "text", text })
const b = (text) => ({ type: "text", text, marks: [{ type: "bold" }] })
const doc = (...content) => ({ type: "doc", content })

export const DEFAULT_TEMPLATES = [
  {
    name: "Welcome aboard",
    purpose: "accepted",
    status: "published",
    isDefault: true,
    subject: "Welcome to the CorePhia program",
    headline: "Welcome aboard, {firstName}",
    body: doc(
      p(t("We're happy to let you know that our provider has reviewed your form, and you've been accepted into the CorePhia program.")),
      p(b("What happens next:"), t(" you'll get an email from Elation, the secure patient portal we use, inviting you to create your account. Once you're set up, you can book your first visit and message your care team directly. If it hasn't arrived in a few days, check your spam folder or give us a call.")),
      p(t("Your membership begins when our team activates it, and that's when the card you added is first charged.")),
      p(t("We're looking forward to working with you.")),
    ),
  },
  {
    name: "Not the right fit",
    purpose: "declined",
    status: "published",
    isDefault: true,
    subject: "An update on your CorePhia form",
    headline: "Thank you, {firstName}",
    body: doc(
      p(t("Thank you for taking the time to fill out our form and for considering CorePhia.")),
      p(t("Our provider has carefully reviewed your answers, and we aren't able to offer you a place in the program right now. We know that may be disappointing to hear. It isn't a judgment of you or your goals, only that our program may not be the best way to support you at this time.")),
      p(b("Your card has not been charged, and it won't be.")),
      p(t("Your primary care doctor is a good next step. They know your health history and can talk with you about options that may be a better fit.")),
      p(t("If you have questions about this decision, or your situation changes, we'd be glad to hear from you.")),
    ),
  },
  {
    name: "Welcome to CorePhia",
    purpose: "welcome",
    status: "published",
    isDefault: true,
    subject: "Welcome to CorePhia, we received your form",
    headline: "Welcome to CorePhia!",
    body: doc(
      p(t("We're glad you're here! We've received your form, and taking that first step matters.")),
      p(t("Our care team is reviewing your answers. If the program looks like a good fit, we'll reach out to set up your first visit and send you an invite to your patient portal.")),
    ),
  },
]
